/**
 * Order repository — ElektrK
 *
 * Single access point for order data, source-agnostic.
 *
 *   DATA_SOURCE="mock"    → in-memory mocks from src/data/mock-orders.ts
 *   DATA_SOURCE="payload" → Payload CMS (Phase 10B+)
 *
 * All read queries use overrideAccess: true because the Orders collection
 * restricts access to admin users only. The customerAuthId filter ensures
 * customers only receive their own orders.
 *
 * WhatsApp flow: createOrder persists a "pending" order with structured
 * customer + shipping data. The order is initiated by the buyer sending a
 * WhatsApp message; the admin then requests payment and updates the status
 * from the dashboard. Stock is decremented by the Orders collection
 * afterChange hook when the status transitions to "paid".
 */

import type {
  OrderDetail,
  OrderSummary,
  OrderCreateInput,
  CreateOrderResult,
} from "@/types/order";
import { formatOrderNumber } from "@/lib/whatsapp/order-message";
import type { StatusHistoryActor } from "@/lib/orders/status-history";
import { sendOrderCreatedEmails } from "@/lib/email/order-emails";
import {
  getMockOrdersByCustomer,
  getMockRecentOrders,
  findMockOrderById,
} from "@/data/mock-orders";
import {
  mapPayloadOrder,
  mapPayloadOrderToSummary,
  type RawPayloadOrder,
} from "@/lib/mappers/order.mapper";

// ---------------------------------------------------------------------------
// Lazy Payload client — only initialised when DATA_SOURCE=payload
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _payloadClient: any = null;

async function getPayloadClient() {
  if (_payloadClient) return _payloadClient;
  const { getPayload } = await import("payload");
  const { default: config } = await import("@payload-config");
  _payloadClient = await getPayload({ config });
  return _payloadClient;
}

// ---------------------------------------------------------------------------
// Data source guard
// ---------------------------------------------------------------------------

function dataSource(): "mock" | "payload" {
  return (process.env.DATA_SOURCE ?? "mock") === "payload" ? "payload" : "mock";
}

// ---------------------------------------------------------------------------
// getOrdersByCustomer
// ---------------------------------------------------------------------------

/**
 * Returns all orders (as OrderDetail) for a given customer.
 * Sorted newest-first.
 */
export async function getOrdersByCustomer(
  customerAuthId: string
): Promise<OrderDetail[]> {
  if (dataSource() === "payload") {
    return _payloadGetOrdersByCustomer(customerAuthId);
  }
  return getMockOrdersByCustomer(customerAuthId).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

// ---------------------------------------------------------------------------
// getOrderSummariesByCustomer
// ---------------------------------------------------------------------------

/**
 * Returns lightweight OrderSummary[] for list pages.
 */
export async function getOrderSummariesByCustomer(
  customerAuthId: string
): Promise<OrderSummary[]> {
  if (dataSource() === "payload") {
    return _payloadGetOrderSummariesByCustomer(customerAuthId);
  }
  return getMockOrdersByCustomer(customerAuthId)
    .sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .map(({ id, orderNumber, createdAt, displayDate, status, total, itemCount, customerEmail }) => ({
      id,
      orderNumber,
      createdAt,
      displayDate,
      status,
      total,
      itemCount,
      customerEmail,
    }));
}

// ---------------------------------------------------------------------------
// getOrderStatusById  (lightweight — webhook idempotency guard)
// ---------------------------------------------------------------------------

/**
 * Returns only the `status` field of an Order, or null if not found.
 *
 * Used by the webhook to check whether a payment event has already been
 * processed without fetching the full order and all its items.
 */
export async function getOrderStatusById(
  id: string
): Promise<{ status: string } | null> {
  if (dataSource() !== "payload") {
    // Mock mode — look up the mock order just for its status
    const order = findMockOrderById(id);
    return order ? { status: order.status } : null;
  }

  const payload = await getPayloadClient();
  try {
    const doc = await payload.findByID({
      collection: "orders",
      id,
      depth: 0,       // no population needed — status is top-level
      overrideAccess: true,
    });
    if (!doc) return null;
    const status =
      typeof (doc as Record<string, unknown>).status === "string"
        ? ((doc as Record<string, unknown>).status as string)
        : "pending";
    return { status };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// getOrderById
// ---------------------------------------------------------------------------

/**
 * Returns a single order by ID, or null if not found.
 */
export async function getOrderById(id: string): Promise<OrderDetail | null> {
  if (dataSource() === "payload") {
    return _payloadGetOrderById(id);
  }
  return findMockOrderById(id);
}

// ---------------------------------------------------------------------------
// getRecentOrdersByCustomer
// ---------------------------------------------------------------------------

/**
 * Returns the N most recent orders for the account dashboard preview.
 * Default limit: 3.
 */
export async function getRecentOrdersByCustomer(
  customerAuthId: string,
  limit = 3
): Promise<OrderSummary[]> {
  if (dataSource() === "payload") {
    return _payloadGetRecentOrders(customerAuthId, limit);
  }
  return getMockRecentOrders(customerAuthId, limit);
}

// ---------------------------------------------------------------------------
// createOrder — Phase 10B
// ---------------------------------------------------------------------------

/**
 * Creates an Order document + one OrderItem per cart line in Payload.
 *
 * Steps:
 *   1. Create the parent Order (status: "pending", pricing from recalculated totals).
 *   2. For each cart item, look up the Variant by SKU to get its Payload ID.
 *   3. Create an OrderItem linked to the Order + Product + Variant.
 *
 * Uses overrideAccess: true on all writes because the collections restrict
 * write access to admin users; the server action has already verified the
 * caller's Auth.js session.
 */
export async function createOrder(
  input: OrderCreateInput
): Promise<CreateOrderResult> {
  if (dataSource() !== "payload") {
    // Mock mode — return a fake orderId so the UI still works in development
    const mockId = `mock-${Date.now()}`;
    return { orderId: mockId, orderNumber: formatOrderNumber(mockId) };
  }

  const payload = await getPayloadClient();

  // --- 0. Idempotency: return the existing order for a repeated submit ---
  if (input.idempotencyKey) {
    const existing = await _findOrderByIdempotencyKey(
      payload,
      input.idempotencyKey,
      input.customerAuthId
    );
    if (existing) return existing;
  }

  // --- 1. Create the parent Order ---
  // The Orders afterChange hook backfills `orderNumber` from the serial id.
  let order;
  try {
    order = await payload.create({
      collection: "orders",
      overrideAccess: true,
      data: {
        status: "pending",
        idempotencyKey: input.idempotencyKey || null,
        customer: {
          customerName: input.shippingName,
          customerAuthId: input.customerAuthId,
          customerEmail: input.customerEmail,
        },
        shipping: {
          name: input.shippingName,
          address: input.shippingAddress,
          city: input.shippingCity,
          state: input.shippingState,
          postalCode: input.shippingPostalCode,
          phone: input.shippingPhone || null,
        },
        pricing: {
          subtotal: input.subtotal,
          shipping: input.shipping,
          total: input.total,
          taxIncluded: true,
        },
        notes: input.notes || null,
      },
    });
  } catch (err) {
    // A concurrent submit with the same key may have inserted first, tripping
    // the unique index. Recover by returning that order instead of failing.
    if (input.idempotencyKey) {
      const existing = await _findOrderByIdempotencyKey(
        payload,
        input.idempotencyKey,
        input.customerAuthId
      );
      if (existing) return existing;
    }
    throw err;
  }

  const orderId: string = order.id as string;

  // --- 2 + 3. Create OrderItems ---
  await Promise.all(
    input.items.map(async (item) => {
      // Look up the Variant document by SKU to get its Payload ID
      const variantResult = await payload.find({
        collection: "variants",
        where: { sku: { equals: item.variantSku } },
        limit: 1,
        overrideAccess: true,
        depth: 0,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const variantDoc = (variantResult.docs as any[])[0];
      const variantId: string = variantDoc?.id ?? item.variantSku;

      await payload.create({
        collection: "order-items",
        overrideAccess: true,
        data: {
          order: orderId,
          product: item.productId,
          variant: variantId,
          productNameSnapshot: item.productName,
          variantSkuSnapshot: item.variantSku,
          variantLabelSnapshot: item.variantLabel,
          quantity: item.quantity,
          unitPrice: item.price,
          total: item.price * item.quantity,
        },
      });
    })
  );

  // Fire the order-received (customer) + new-order (admin) emails now that the
  // order-items exist, so the templates include the full line-item list.
  // Best-effort: sendOrderCreatedEmails swallows its own failures.
  try {
    await sendOrderCreatedEmails(payload, orderId);
  } catch {
    // never block order creation on email
  }

  return { orderId, orderNumber: formatOrderNumber(orderId) };
}

/**
 * Looks up an order by its idempotency key, scoped to the same customer, and
 * returns it in CreateOrderResult shape. Null when none exists.
 */
async function _findOrderByIdempotencyKey(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  idempotencyKey: string,
  customerAuthId: string
): Promise<CreateOrderResult | null> {
  const result = await payload.find({
    collection: "orders",
    where: {
      and: [
        { idempotencyKey: { equals: idempotencyKey } },
        { "customer.customerAuthId": { equals: customerAuthId } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = (result.docs as any[])[0];
  if (!doc) return null;
  return {
    orderId: String(doc.id),
    orderNumber:
      (typeof doc.orderNumber === "string" && doc.orderNumber) ||
      formatOrderNumber(doc.id),
  };
}

// ---------------------------------------------------------------------------
// getOrderFilters
// ---------------------------------------------------------------------------

export async function getOrderFilters(): Promise<{
  statuses: Array<{ value: string; label: string }>;
}> {
  return {
    statuses: [
      { value: "all",             label: "Todas"           },
      { value: "pending",         label: "Recibida"        },
      { value: "payment_pending", label: "Pago en revisión" },
      { value: "paid",            label: "Pago confirmado"  },
      { value: "fulfilled",       label: "Entregada"        },
      { value: "cancelled",       label: "Cancelada"        },
    ],
  };
}

// ---------------------------------------------------------------------------
// Payload implementations
// ---------------------------------------------------------------------------

async function _payloadGetOrdersByCustomer(
  customerAuthId: string
): Promise<OrderDetail[]> {
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: "orders",
    where: { "customer.customerAuthId": { equals: customerAuthId } },
    sort: "-createdAt",
    depth: 2,
    overrideAccess: true,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (result.docs as any[]).map((doc) => mapPayloadOrder(doc as RawPayloadOrder));
}

async function _payloadGetOrderSummariesByCustomer(
  customerAuthId: string
): Promise<OrderSummary[]> {
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: "orders",
    where: { "customer.customerAuthId": { equals: customerAuthId } },
    sort: "-createdAt",
    depth: 1,
    overrideAccess: true,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (result.docs as any[]).map((doc) => mapPayloadOrderToSummary(doc as RawPayloadOrder));
}

async function _payloadGetOrderById(id: string): Promise<OrderDetail | null> {
  const payload = await getPayloadClient();
  try {
    const doc = await payload.findByID({
      collection: "orders",
      id,
      depth: 2,
      overrideAccess: true,
    });
    return doc ? mapPayloadOrder(doc as RawPayloadOrder) : null;
  } catch {
    return null;
  }
}

async function _payloadGetRecentOrders(
  customerAuthId: string,
  limit: number
): Promise<OrderSummary[]> {
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: "orders",
    where: { "customer.customerAuthId": { equals: customerAuthId } },
    sort: "-createdAt",
    limit,
    depth: 1,
    overrideAccess: true,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (result.docs as any[]).map((doc) => mapPayloadOrderToSummary(doc as RawPayloadOrder));
}

// ---------------------------------------------------------------------------
// Status lifecycle helper
// ---------------------------------------------------------------------------

/**
 * Updates only the status field of an Order.
 *
 * Stock is decremented/restored automatically by the Orders collection
 * afterChange hook on transitions into "paid"/"cancelled" — callers do not
 * handle stock here. The `actor` is forwarded via `context.statusActor` so the
 * hook attributes the resulting statusHistory entry correctly (defaults to
 * "admin" for edits made directly in the Payload admin UI).
 */
export async function updateOrderStatus(
  orderId: string,
  status: "pending" | "payment_pending" | "paid" | "fulfilled" | "cancelled",
  options?: { actor?: StatusHistoryActor; note?: string | null }
): Promise<void> {
  if (dataSource() !== "payload") return;
  const payload = await getPayloadClient();
  await payload.update({
    collection: "orders",
    id: orderId,
    overrideAccess: true,
    data: { status },
    context: {
      statusActor: options?.actor ?? "admin",
      ...(options?.note ? { statusNote: options.note } : {}),
    },
  });
}

// ---------------------------------------------------------------------------
// Payment proofs
// ---------------------------------------------------------------------------

export interface PaymentProofFile {
  buffer: Buffer;
  mimetype: string;
  filename: string;
  size: number;
}

/**
 * Uploads a payment-proof file to Media and appends it to the order's
 * `paymentProofs` array. When the order is still "pending", it is advanced to
 * "payment_pending" (a "proof submitted, awaiting review" signal). The admin
 * still decides "paid" manually.
 *
 * Access is overridden because Orders/Media writes are admin-only; the caller
 * (server action) is responsible for auth + ownership + status checks.
 */
export async function attachPaymentProof(
  orderId: string,
  file: PaymentProofFile,
  uploadedBy: "customer" | "admin"
): Promise<void> {
  if (dataSource() !== "payload") {
    throw new Error("La carga de comprobantes requiere DATA_SOURCE=payload.");
  }

  const payload = await getPayloadClient();

  // 1. Upload the file to Media (uploadthing storage).
  const media = await payload.create({
    collection: "media",
    overrideAccess: true,
    data: {
      documentType: "document",
      alt: `Comprobante de pago — ${file.filename}`,
    },
    file: {
      data: file.buffer,
      mimetype: file.mimetype,
      name: file.filename,
      size: file.size,
    },
  });

  // 2. Read the existing proofs + status (depth 0 → file is the media id).
  const order = await payload.findByID({
    collection: "orders",
    id: orderId,
    depth: 0,
    overrideAccess: true,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing: any[] = Array.isArray(order?.paymentProofs)
    ? order.paymentProofs
    : [];
  const normalizedExisting = existing.map((p) => ({
    id: p.id,
    file: p.file && typeof p.file === "object" ? p.file.id : p.file,
    uploadedBy: p.uploadedBy ?? "admin",
    uploadedAt: p.uploadedAt ?? null,
    reviewStatus: p.reviewStatus ?? "pending",
    reviewNote: p.reviewNote ?? null,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {
    paymentProofs: [
      ...normalizedExisting,
      {
        file: media.id,
        uploadedBy,
        uploadedAt: new Date().toISOString(),
        reviewStatus: "pending",
        reviewNote: null,
      },
    ],
  };

  // 3. Auto-advance the status on the first move out of "pending".
  const advancing = order?.status === "pending";
  if (advancing) {
    data.status = "payment_pending";
  }

  await payload.update({
    collection: "orders",
    id: orderId,
    overrideAccess: true,
    data,
    // Attribute the resulting statusHistory entry to the uploader. Only the
    // customer path advances the status; admin uploads don't change it.
    context:
      advancing && uploadedBy === "customer"
        ? { statusActor: "customer", statusNote: "Comprobante subido" }
        : undefined,
  });
}

/**
 * Records that the customer re-opened the WhatsApp hand-off from their order
 * page (§7.1). No status change — skips the order hooks entirely.
 */
export async function markWhatsAppSent(orderId: string): Promise<void> {
  if (dataSource() !== "payload") return;
  const payload = await getPayloadClient();
  await payload.update({
    collection: "orders",
    id: orderId,
    overrideAccess: true,
    context: { skipOrderHooks: true },
    data: { whatsappSentAt: new Date().toISOString() },
  });
}

/**
 * Removes a payment proof from an order and deletes its underlying media doc.
 *
 * Caller (server action) must enforce ownership + that the proof is still
 * removable (customer-uploaded, reviewStatus === "pending"). This just performs
 * the mutation. No-op when the proof id is not found.
 */
export async function removePaymentProof(
  orderId: string,
  proofId: string
): Promise<void> {
  if (dataSource() !== "payload") {
    throw new Error("La gestión de comprobantes requiere DATA_SOURCE=payload.");
  }

  const payload = await getPayloadClient();
  const order = await payload.findByID({
    collection: "orders",
    id: orderId,
    depth: 0,
    overrideAccess: true,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing: any[] = Array.isArray(order?.paymentProofs)
    ? order.paymentProofs
    : [];
  const target = existing.find((p) => String(p.id) === String(proofId));
  if (!target) return;

  const mediaId =
    target.file && typeof target.file === "object" ? target.file.id : target.file;

  const remaining = existing
    .filter((p) => String(p.id) !== String(proofId))
    .map((p) => ({
      id: p.id,
      file: p.file && typeof p.file === "object" ? p.file.id : p.file,
      uploadedBy: p.uploadedBy ?? "admin",
      uploadedAt: p.uploadedAt ?? null,
      reviewStatus: p.reviewStatus ?? "pending",
      reviewNote: p.reviewNote ?? null,
    }));

  await payload.update({
    collection: "orders",
    id: orderId,
    overrideAccess: true,
    context: { skipOrderHooks: true },
    data: { paymentProofs: remaining },
  });

  // Delete the now-orphaned media (best-effort — the array row is already gone).
  if (mediaId) {
    try {
      await payload.delete({
        collection: "media",
        id: mediaId,
        overrideAccess: true,
      });
    } catch (err) {
      console.error("[removePaymentProof] media delete failed:", err);
    }
  }
}

/**
 * Auto-expires stale unpaid orders (§4.2). Cancels `pending` orders — and
 * `payment_pending` orders with no accepted proof — created before the TTL
 * cutoff. Cancelling never touches stock (it was never decremented) and, via
 * updateOrderStatus → the afterChange hook, appends a statusHistory entry with
 * changedBy "system" (and sends the cancellation email).
 *
 * Returns the ids that were cancelled.
 */
export async function expireStalePendingOrders(
  ttlDays: number
): Promise<{ cancelled: number; orderIds: string[] }> {
  if (dataSource() !== "payload") return { cancelled: 0, orderIds: [] };
  const days = Number.isFinite(ttlDays) && ttlDays > 0 ? ttlDays : 7;

  const payload = await getPayloadClient();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const result = await payload.find({
    collection: "orders",
    where: {
      and: [
        { createdAt: { less_than: cutoff } },
        {
          or: [
            { status: { equals: "pending" } },
            { status: { equals: "payment_pending" } },
          ],
        },
      ],
    },
    limit: 200,
    depth: 0,
    overrideAccess: true,
  });

  const orderIds: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const doc of result.docs as any[]) {
    // A payment_pending order with an accepted proof is effectively paid-in-fact
    // pending the admin's confirmation — never auto-cancel it.
    if (doc.status === "payment_pending") {
      const proofs = Array.isArray(doc.paymentProofs) ? doc.paymentProofs : [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hasAccepted = proofs.some((p: any) => p?.reviewStatus === "accepted");
      if (hasAccepted) continue;
    }
    try {
      await updateOrderStatus(String(doc.id), "cancelled", {
        actor: "system",
        note: "Cancelada automáticamente por falta de pago.",
      });
      orderIds.push(String(doc.id));
    } catch (err) {
      payload.logger?.error?.(
        `[expireStalePendingOrders] Failed to cancel order ${doc.id}: ` +
          (err instanceof Error ? err.message : String(err))
      );
    }
  }

  return { cancelled: orderIds.length, orderIds };
}

// Re-export mapper types for callers that receive raw Payload docs
export { mapPayloadOrder, mapPayloadOrderToSummary };
export type { RawPayloadOrder };
