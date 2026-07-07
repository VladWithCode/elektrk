import type {
  CollectionConfig,
  CollectionBeforeValidateHook,
  CollectionBeforeChangeHook,
  CollectionAfterChangeHook,
} from "payload";
import { isAdmin } from "../lib/payload-access";
import { guardOrderDelete } from "../lib/payload-delete-guards";
import { validateNumber } from "../lib/payload-validation-guards";
// NOTE: relative import — collection files are loaded by the Payload CLI under
// plain Node ESM where the "@/" path alias is unavailable. order-message.ts is
// kept alias-free for this reason.
import { formatOrderNumber } from "../lib/whatsapp/order-message";
import {
  appendStatusHistory,
  type StatusHistoryActor,
} from "../lib/orders/status-history";
import {
  sendOrderStatusEmail,
  sendProofRejectedEmail,
} from "../lib/email/order-emails";
import { ORDER_STATUS_OPTIONS } from "../types/order";

const validateOrderFields: CollectionBeforeValidateHook = ({ data }) => {
  if (!data) return data;
  validateNumber(data.pricing?.subtotal, "El subtotal", 0);
  validateNumber(data.pricing?.shipping, "El costo de envío", 0);
  validateNumber(data.pricing?.total, "El total", 0);
  return data;
};

/**
 * Defaults `uploadedAt` on payment proofs that don't have one yet (§8.4).
 * The field is readOnly in the admin UI, so admin-added proofs would otherwise
 * be saved with a blank timestamp.
 */
const fillProofTimestamps: CollectionBeforeChangeHook = ({ data }) => {
  if (!data || !Array.isArray(data.paymentProofs)) return data;
  const now = new Date().toISOString();
  data.paymentProofs = data.paymentProofs.map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (proof: any) =>
      proof && !proof.uploadedAt ? { ...proof, uploadedAt: now } : proof
  );
  return data;
};

// ---------------------------------------------------------------------------
// afterChange hook
//
//  1. On create, backfill the human-friendly `orderNumber` (ORD-000042) from
//     the serial id (only available after insert). The follow-up update is
//     flagged with context.skipOrderHooks so it does not re-enter this hook.
//  2. Record every status transition in the append-only `statusHistory` audit
//     trail. The actor is taken from `context.statusActor` (server actions /
//     cron set it) and defaults to "admin" for edits made in the Payload admin.
//  3. When the order transitions INTO "paid", decrement variant stock (once,
//     guarded by `stockDecremented`). When a previously-decremented order is
//     cancelled, restore that stock. Stock is intentionally NOT decremented at
//     order creation — orders sit as "pending" until the admin confirms payment
//     via WhatsApp, so reserving stock early would leak it on abandoned orders.
//
//  Every side-effect below is best-effort: failures are logged and never abort
//  the save that triggered them.
// ---------------------------------------------------------------------------

const errMsg = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

const handleOrderAfterChange: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  req,
  operation,
  context,
}) => {
  if (context?.skipOrderHooks) return doc;

  // 1. Backfill orderNumber on create.
  //    `req` MUST be passed so the update joins the same transaction as the
  //    insert — otherwise it runs in a separate transaction that cannot see the
  //    not-yet-committed row, the update matches 0 rows, and orderNumber stays
  //    null.
  if (operation === "create" && !doc.orderNumber) {
    try {
      await req.payload.update({
        collection: "orders",
        id: doc.id,
        data: { orderNumber: formatOrderNumber(doc.id) },
        req,
        overrideAccess: true,
        context: { skipOrderHooks: true },
      });
    } catch (err) {
      req.payload.logger.error(
        `[orders.afterChange] Failed to set orderNumber for order ${doc.id}: ` +
          errMsg(err)
      );
    }
  }

  // 2. Record the status transition in the audit trail.
  const actor: StatusHistoryActor =
    (context?.statusActor as StatusHistoryActor | undefined) ??
    (operation === "create" ? "customer" : "admin");
  const statusChanged =
    operation === "create" || previousDoc?.status !== doc.status;
  if (statusChanged) {
    try {
      await appendStatusHistory({
        payload: req.payload,
        req,
        orderId: doc.id,
        entry: {
          status: doc.status,
          changedBy: actor,
          note: (context?.statusNote as string | undefined) ?? null,
        },
      });
    } catch (err) {
      req.payload.logger.error(
        `[orders.afterChange] statusHistory append failed for order ${doc.id}: ` +
          errMsg(err)
      );
    }

    // Notify the customer on transitions into paid / fulfilled / cancelled.
    // (Order-created email is sent from the createOrder repo path, after the
    // order-items exist.) sendOrderStatusEmail is a no-op for other statuses
    // and never throws.
    if (operation === "update") {
      try {
        await sendOrderStatusEmail(req.payload, doc.id, doc.status);
      } catch (err) {
        req.payload.logger.error(
          `[orders.afterChange] status email failed for order ${doc.id}: ` +
            errMsg(err)
        );
      }
    }
  }

  // 2b. Email the customer when a proof is newly rejected (§8.2). One email per
  //     proof that moves into "rejected" (guarded against re-sends by comparing
  //     with the previous review state).
  if (operation === "update") {
    await notifyRejectedProofs(req, previousDoc, doc);
  }

  // 3a. Decrement stock the first time an order becomes "paid".
  //     `stockDecremented` guards against double-decrementing when the order
  //     later toggles e.g. fulfilled → paid, or paid → cancelled → paid.
  const becamePaid =
    operation === "update" &&
    previousDoc?.status !== "paid" &&
    doc.status === "paid";
  if (becamePaid && !doc.stockDecremented) {
    await adjustOrderStock(req, doc.id, -1);
    await setStockDecremented(req, doc.id, true);
  }

  // 3b. Restore stock when a previously-decremented order is cancelled.
  const becameCancelled =
    operation === "update" &&
    previousDoc?.status !== "cancelled" &&
    doc.status === "cancelled";
  if (becameCancelled && doc.stockDecremented) {
    await adjustOrderStock(req, doc.id, 1);
    await setStockDecremented(req, doc.id, false);
  }

  return doc;
};

/**
 * Sends the "proof rejected" email for each proof that moved into "rejected"
 * since the previous save. Best-effort; never throws.
 */
async function notifyRejectedProofs(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  req: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  previousDoc: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc: any
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prev: any[] = Array.isArray(previousDoc?.paymentProofs)
    ? previousDoc.paymentProofs
    : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const current: any[] = Array.isArray(doc?.paymentProofs)
    ? doc.paymentProofs
    : [];
  if (current.length === 0) return;

  const prevById = new Map(prev.map((p) => [String(p.id), p]));

  for (const proof of current) {
    const before = prevById.get(String(proof.id));
    const newlyRejected =
      proof?.reviewStatus === "rejected" && before?.reviewStatus !== "rejected";
    if (!newlyRejected) continue;
    try {
      await sendProofRejectedEmail(req.payload, doc.id, proof.reviewNote ?? null);
    } catch (err) {
      req.payload.logger.error(
        `[orders.afterChange] proof-rejected email failed for order ${doc.id}: ` +
          errMsg(err)
      );
    }
  }
}

/**
 * Persists the `stockDecremented` bookkeeping flag without re-entering hooks.
 */
async function setStockDecremented(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  req: any,
  orderId: string | number,
  value: boolean
): Promise<void> {
  try {
    await req.payload.update({
      collection: "orders",
      id: orderId,
      req,
      overrideAccess: true,
      context: { skipOrderHooks: true },
      data: { stockDecremented: value },
    });
  } catch (err) {
    req.payload.logger.error(
      `[orders.setStockDecremented] Failed for order ${orderId}: ` + errMsg(err)
    );
  }
}

/**
 * Adjusts variant stock for every order-item belonging to `orderId`.
 *   sign = -1 → decrement (order confirmed paid)
 *   sign = +1 → increment (paid order cancelled — restore stock)
 * Per-item failures are logged but never abort the admin save (the status
 * change already succeeded; stock is best-effort).
 *
 * Inlined here (rather than importing from the orders repository) because the
 * repository uses "@/" path aliases that the Payload CLI cannot resolve.
 */
async function adjustOrderStock(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  req: any,
  orderId: string | number,
  sign: 1 | -1
): Promise<void> {
  const payload = req.payload;
  const verb = sign < 0 ? "decrement" : "increment";
  try {
    const itemsResult = await payload.find({
      collection: "order-items",
      where: { order: { equals: orderId } },
      limit: 200,
      depth: 1, // populate the `variant` relationship
      req,
      overrideAccess: true,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = itemsResult.docs as any[];

    await Promise.allSettled(
      items.map(async (item) => {
        const quantity: number =
          typeof item.quantity === "number" ? item.quantity : 0;
        if (quantity <= 0) return;

        const variantDoc = item.variant;
        if (!variantDoc?.id) {
          payload.logger.warn(
            `[orders.${verb}Stock] No variant on order-item ${item.id}`
          );
          return;
        }

        const currentStock: number =
          typeof variantDoc.stock === "number" ? variantDoc.stock : 0;
        const newStock = Math.max(0, currentStock + sign * quantity);

        await payload.update({
          collection: "variants",
          id: variantDoc.id,
          req,
          overrideAccess: true,
          data: { stock: newStock },
        });

        payload.logger.info(
          `[orders.${verb}Stock] variant ${variantDoc.id} (${variantDoc.sku}): ` +
            `${currentStock} → ${newStock} (${sign < 0 ? "−" : "+"}${quantity})`
        );
      })
    );
  } catch (err) {
    payload.logger.error(
      `[orders.${verb}Stock] Failed for order ${orderId}: ` + errMsg(err)
    );
  }
}

export const Orders: CollectionConfig = {
  slug: "orders",
  labels: { singular: "Orden", plural: "Órdenes" },
  admin: {
    useAsTitle: "orderNumber",
    defaultColumns: ["orderNumber", "status", "createdAt"],
    // Let the admin list search box match the order number sent over WhatsApp.
    listSearchableFields: ["orderNumber"],
    group: "Ventas",
    description: "Órdenes de compra de clientes del storefront.",
  },
  access: {
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  timestamps: true,
  hooks: {
    beforeValidate: [validateOrderFields],
    beforeChange: [fillProofTimestamps],
    afterChange: [handleOrderAfterChange],
    beforeDelete: [
      async ({ id, req }) => {
        await guardOrderDelete(req, id);
      },
    ],
  },
  fields: [
    // -------------------------------------------------------------------------
    // Order number — human-friendly reference (ORD-000042)
    // -------------------------------------------------------------------------
    {
      name: "orderNumber",
      type: "text",
      label: "Número de orden",
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        description:
          "Se genera automáticamente al crear la orden (ej. ORD-000042). " +
          "Es el identificador que el cliente envía por WhatsApp y el que puedes " +
          "buscar en este listado.",
      },
    },

    // -------------------------------------------------------------------------
    // Idempotency key — dedupes checkout resubmissions (§2.4)
    // -------------------------------------------------------------------------
    {
      name: "idempotencyKey",
      type: "text",
      label: "Clave de idempotencia",
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        description:
          "Evita órdenes duplicadas si el checkout se reenvía. Se genera en el " +
          "cliente. No editar manualmente.",
      },
    },

    // -------------------------------------------------------------------------
    // Group: Cliente
    // -------------------------------------------------------------------------
    {
      type: "group",
      name: "customer",
      label: "Cliente",
      fields: [
        {
          name: "customerName",
          type: "text",
          label: "Nombre del cliente",
        },
        {
          name: "customerEmail",
          type: "email",
          label: "Email del cliente",
          required: true,
        },
        {
          name: "customerAuthId",
          type: "text",
          label: "Auth.js userId",
          admin: {
            description:
              "ID del usuario en la tabla `users` de Auth.js. No editar manualmente.",
            readOnly: true,
          },
        },
      ],
    },

    // -------------------------------------------------------------------------
    // Group: Estado
    // -------------------------------------------------------------------------
    {
      name: "status",
      type: "select",
      label: "Estado de la orden",
      required: true,
      defaultValue: "pending",
      options: [
        { label: "Recibida         — esperando contacto/pago", value: "pending" },
        { label: "Pago en revisión — comprobante recibido, por revisar", value: "payment_pending" },
        { label: "Pago confirmado  — verificado por admin", value: "paid" },
        { label: "Entregada        — enviada/entregada al cliente", value: "fulfilled" },
        { label: "Cancelada        — cancelada por cliente o admin", value: "cancelled" },
      ],
      admin: {
        description:
          "Flujo manual: el cliente inicia la orden por WhatsApp. Solicita el pago, " +
          "recibe el comprobante y marca «Pago confirmado» (esto descuenta el stock). " +
          "Marca «Entregada» al completar el envío.",
      },
    },

    // -------------------------------------------------------------------------
    // Stock bookkeeping — managed automatically by the afterChange hook
    // -------------------------------------------------------------------------
    {
      name: "stockDecremented",
      type: "checkbox",
      label: "Stock descontado",
      defaultValue: false,
      admin: {
        readOnly: true,
        description:
          "Indica si el inventario ya se descontó por esta orden. Se administra " +
          "automáticamente: se descuenta al confirmar el pago y se restaura si la " +
          "orden se cancela. No editar manualmente.",
      },
    },
    {
      name: "whatsappSentAt",
      type: "date",
      label: "Enviado por WhatsApp",
      admin: {
        readOnly: true,
        description:
          "Fecha en que el cliente abrió el mensaje de WhatsApp desde su orden. " +
          "Sirve para saber si ya inició contacto. Se registra automáticamente.",
      },
    },

    // -------------------------------------------------------------------------
    // Group: Envío
    // -------------------------------------------------------------------------
    {
      type: "group",
      name: "shipping",
      label: "Datos de envío",
      fields: [
        {
          name: "name",
          type: "text",
          label: "Nombre de quien recibe",
        },
        {
          name: "address",
          type: "text",
          label: "Dirección",
        },
        {
          name: "city",
          type: "text",
          label: "Ciudad",
        },
        {
          name: "state",
          type: "text",
          label: "Estado",
        },
        {
          name: "postalCode",
          type: "text",
          label: "Código postal",
        },
        {
          name: "phone",
          type: "text",
          label: "Teléfono de contacto",
        },
      ],
    },

    // -------------------------------------------------------------------------
    // Group: Totales
    // -------------------------------------------------------------------------
    {
      type: "group",
      name: "pricing",
      label: "Totales",
      fields: [
        {
          name: "subtotal",
          type: "number",
          label: "Subtotal (MXN)",
          required: true,
          min: 0,
          admin: {
            description: "Suma de artículos antes de envío.",
          },
        },
        {
          name: "shipping",
          type: "number",
          label: "Costo de envío (MXN)",
          required: true,
          min: 0,
          defaultValue: 0,
        },
        {
          name: "total",
          type: "number",
          label: "Total (MXN)",
          required: true,
          min: 0,
          admin: {
            description: "Subtotal + envío. IVA incluido.",
          },
        },
        {
          name: "taxIncluded",
          type: "checkbox",
          label: "IVA incluido en el total",
          defaultValue: true,
        },
      ],
    },

    // -------------------------------------------------------------------------
    // Payment proofs — receipts uploaded by the customer or the admin
    // -------------------------------------------------------------------------
    {
      name: "paymentProofs",
      type: "array",
      label: "Comprobantes de pago",
      labels: { singular: "Comprobante", plural: "Comprobantes" },
      admin: {
        description:
          "Comprobantes de transferencia o pago (imagen o PDF). Los sube el cliente " +
          "desde el detalle de su orden, o el administrador si los recibió por otro medio " +
          "(WhatsApp, correo, etc.). Revísalos antes de confirmar el pago.",
      },
      fields: [
        {
          name: "file",
          type: "upload",
          relationTo: "media",
          required: true,
          label: "Archivo",
        },
        {
          name: "uploadedBy",
          type: "select",
          label: "Subido por",
          defaultValue: "admin",
          options: [
            { label: "Cliente", value: "customer" },
            { label: "Administrador", value: "admin" },
          ],
        },
        {
          name: "uploadedAt",
          type: "date",
          label: "Fecha de subida",
          admin: { readOnly: true },
        },
        {
          name: "reviewStatus",
          type: "select",
          label: "Estado de revisión",
          defaultValue: "pending",
          options: [
            { label: "Pendiente", value: "pending" },
            { label: "Aceptado", value: "accepted" },
            { label: "Rechazado", value: "rejected" },
          ],
          admin: {
            description:
              "Revisa cada comprobante. «Aceptado» no confirma el pago por sí solo " +
              "(usa el estado de la orden para eso); «Rechazado» notifica al cliente.",
          },
        },
        {
          name: "reviewNote",
          type: "text",
          label: "Nota de revisión",
          admin: {
            description:
              "Motivo visible para el cliente (ej. «el monto no coincide»). " +
              "Se incluye en el correo al rechazar.",
          },
        },
      ],
    },

    // -------------------------------------------------------------------------
    // Status history — append-only audit trail (populated by the afterChange
    // hook and by server actions / cron via context.statusActor).
    // -------------------------------------------------------------------------
    {
      name: "statusHistory",
      type: "array",
      label: "Historial de estado",
      labels: { singular: "Cambio de estado", plural: "Cambios de estado" },
      admin: {
        readOnly: true,
        description:
          "Registro automático de cada cambio de estado (quién, cuándo y por qué). " +
          "Solo lectura.",
      },
      fields: [
        {
          name: "status",
          type: "select",
          label: "Estado",
          options: ORDER_STATUS_OPTIONS,
        },
        {
          name: "changedAt",
          type: "date",
          label: "Fecha",
          admin: { date: { pickerAppearance: "dayAndTime" } },
        },
        {
          name: "changedBy",
          type: "text",
          label: "Cambiado por",
          admin: {
            description: '"customer", "admin" o "system".',
          },
        },
        {
          name: "note",
          type: "text",
          label: "Nota",
        },
      ],
    },

    // -------------------------------------------------------------------------
    // Buyer notes — visible to the customer (delivery instructions)
    // -------------------------------------------------------------------------
    {
      name: "notes",
      type: "textarea",
      label: "Notas del cliente",
      admin: {
        description:
          "Instrucciones de entrega proporcionadas por el cliente al hacer el pedido.",
      },
    },

    // -------------------------------------------------------------------------
    // Internal notes — admin only
    // -------------------------------------------------------------------------
    {
      name: "internalNotes",
      type: "textarea",
      label: "Notas internas",
      admin: {
        description:
          "Notas privadas del equipo sobre esta orden. Nunca visibles para el cliente.",
      },
    },

    // -------------------------------------------------------------------------
    // Virtual join — order-items that belong to this order
    //
    // Note: a reverse join from orders → tickets is intentionally omitted.
    // The `order` relationship in the Tickets collection is nested inside the
    // `relations` group, so Payload cannot resolve a top-level `on: "order"`
    // path for it.  Navigate in the other direction: open a Ticket and use its
    // "Orden relacionada" relationship field to reach the order.
    // -------------------------------------------------------------------------
    {
      name: "items",
      type: "join",
      collection: "order-items",
      on: "order",
      label: "Artículos de la orden",
    },
  ],
};
