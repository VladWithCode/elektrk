import type {
  CollectionConfig,
  CollectionBeforeValidateHook,
  CollectionAfterChangeHook,
} from "payload";
import { isAdmin } from "../lib/payload-access";
import { guardOrderDelete } from "../lib/payload-delete-guards";
import { validateNumber } from "../lib/payload-validation-guards";
// NOTE: relative import — collection files are loaded by the Payload CLI under
// plain Node ESM where the "@/" path alias is unavailable. order-message.ts is
// kept alias-free for this reason.
import { formatOrderNumber } from "../lib/whatsapp/order-message";

const validateOrderFields: CollectionBeforeValidateHook = ({ data }) => {
  if (!data) return data;
  validateNumber(data.pricing?.subtotal, "El subtotal", 0);
  validateNumber(data.pricing?.shipping, "El costo de envío", 0);
  validateNumber(data.pricing?.total, "El total", 0);
  return data;
};

// ---------------------------------------------------------------------------
// afterChange hook
//
//  1. On create, backfill the human-friendly `orderNumber` (ORD-000042) from
//     the serial id (only available after insert). The follow-up update is
//     flagged with context.skipOrderHooks so it does not re-enter this hook.
//  2. When the status transitions INTO "paid" (admin confirms payment), reduce
//     the stock of every variant in the order. Stock is intentionally NOT
//     decremented at order creation — orders sit as "pending" until the admin
//     confirms payment via WhatsApp, so reserving stock early would leak it on
//     abandoned orders.
// ---------------------------------------------------------------------------

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
          (err instanceof Error ? err.message : String(err))
      );
    }
  }

  // 2. Decrement stock when the order is confirmed as paid.
  //    Only fire on the forward transition from a pre-payment state
  //    (pending / payment_pending) → paid, so toggling e.g. fulfilled → paid
  //    again never double-decrements.
  const becamePaid =
    operation === "update" &&
    (previousDoc?.status === "pending" ||
      previousDoc?.status === "payment_pending") &&
    doc.status === "paid";
  if (becamePaid) {
    await decrementOrderStock(req, doc.id);
  }

  return doc;
};

/**
 * Reduces variant stock for every order-item belonging to `orderId`.
 * Per-item failures are logged but never abort the admin save (the status
 * change already succeeded; stock is best-effort).
 *
 * Inlined here (rather than importing from the orders repository) because the
 * repository uses "@/" path aliases that the Payload CLI cannot resolve.
 */
async function decrementOrderStock(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  req: any,
  orderId: string | number
): Promise<void> {
  const payload = req.payload;
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
            `[orders.decrementStock] No variant on order-item ${item.id}`
          );
          return;
        }

        const currentStock: number =
          typeof variantDoc.stock === "number" ? variantDoc.stock : 0;
        const newStock = Math.max(0, currentStock - quantity);

        await payload.update({
          collection: "variants",
          id: variantDoc.id,
          req,
          overrideAccess: true,
          data: { stock: newStock },
        });

        payload.logger.info(
          `[orders.decrementStock] variant ${variantDoc.id} (${variantDoc.sku}): ` +
            `${currentStock} → ${newStock} (−${quantity})`
        );
      })
    );
  } catch (err) {
    payload.logger.error(
      `[orders.decrementStock] Failed for order ${orderId}: ` +
        (err instanceof Error ? err.message : String(err))
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
        { label: "Recibida        — esperando contacto/pago", value: "pending" },
        { label: "Pago solicitado — esperando comprobante", value: "payment_pending" },
        { label: "Pago confirmado — verificado por admin", value: "paid" },
        { label: "Entregada       — enviada/entregada al cliente", value: "fulfilled" },
        { label: "Cancelada       — cancelada por cliente o admin", value: "cancelled" },
      ],
      admin: {
        description:
          "Flujo manual: el cliente inicia la orden por WhatsApp. Solicita el pago, " +
          "recibe el comprobante y marca «Pago confirmado» (esto descuenta el stock). " +
          "Marca «Entregada» al completar el envío.",
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
