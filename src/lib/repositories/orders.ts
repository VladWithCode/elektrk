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
 * Phase 11B additions:
 *   ✓ updateOrderStripeSession  — saves stripeCheckoutSessionId right after session creation
 *   ✓ updateOrderAfterPayment   — called by webhook on checkout.session.completed
 *   ✓ decrementOrderItemsStock  — called by webhook to reduce variant stock after payment
 *   ✓ updateOrderStatus         — generic status update (expired, failed)
 */

import type {
  OrderDetail,
  OrderSummary,
  OrderCreateInput,
  CreateOrderResult,
} from "@/types/order";
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
    .map(({ id, createdAt, displayDate, status, total, itemCount, customerEmail }) => ({
      id,
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
    return { orderId: `mock-${Date.now()}` };
  }

  const payload = await getPayloadClient();

  // --- 1. Create the parent Order ---
  const order = await payload.create({
    collection: "orders",
    overrideAccess: true,
    data: {
      status: "pending",
      customer: {
        customerAuthId: input.customerAuthId,
        customerEmail: input.customerEmail,
      },
      pricing: {
        subtotal: input.subtotal,
        shipping: input.shipping,
        total: input.total,
        taxIncluded: true,
      },
      stripe: {
        stripePaymentIntentId: null,
        stripeCheckoutSessionId: null,
      },
      internalNotes: _buildInternalNotes(input),
    },
  });

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
          quantity: item.quantity,
          unitPrice: item.price,
          total: item.price * item.quantity,
        },
      });
    })
  );

  return { orderId };
}

// ---------------------------------------------------------------------------
// getOrderFilters
// ---------------------------------------------------------------------------

export async function getOrderFilters(): Promise<{
  statuses: Array<{ value: string; label: string }>;
}> {
  return {
    statuses: [
      { value: "all",       label: "Todos"      },
      { value: "pending",   label: "Pendiente"  },
      { value: "paid",      label: "Pagado"     },
      { value: "fulfilled", label: "Entregado"  },
      { value: "cancelled", label: "Cancelado"  },
      { value: "failed",    label: "Fallido"    },
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
// Private helpers
// ---------------------------------------------------------------------------

/** Pack shipping address + notes into internalNotes for the Phase 10B schema
 *  (Orders collection has no dedicated shipping address group yet). */
function _buildInternalNotes(input: OrderCreateInput): string {
  const lines: string[] = [
    `Envío a: ${input.shippingName}`,
    `${input.shippingAddress}, ${input.shippingCity}, ${input.shippingState} ${input.shippingPostalCode}`,
  ];
  if (input.shippingPhone) lines.push(`Tel: ${input.shippingPhone}`);
  if (input.notes) lines.push(`Nota del cliente: ${input.notes}`);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Phase 11B — Stripe / payment lifecycle helpers
// ---------------------------------------------------------------------------

/**
 * Saves the Stripe Checkout Session ID on the Order immediately after the
 * session is created (before the user is redirected to Stripe).
 * No-op in mock mode.
 */
export async function updateOrderStripeSession(
  orderId: string,
  stripeCheckoutSessionId: string
): Promise<void> {
  if (dataSource() !== "payload") return;
  const payload = await getPayloadClient();
  await payload.update({
    collection: "orders",
    id: orderId,
    overrideAccess: true,
    data: {
      stripe: { stripeCheckoutSessionId, stripePaymentIntentId: null },
    },
  });
}

/**
 * Updates Order status + Stripe IDs after a confirmed payment.
 * Called from the checkout.session.completed webhook handler.
 */
export async function updateOrderAfterPayment(
  orderId: string,
  data: {
    status: "paid" | "failed" | "cancelled";
    stripeCheckoutSessionId: string;
    stripePaymentIntentId: string | null;
  }
): Promise<void> {
  if (dataSource() !== "payload") return;
  const payload = await getPayloadClient();
  await payload.update({
    collection: "orders",
    id: orderId,
    overrideAccess: true,
    data: {
      status: data.status,
      stripe: {
        stripeCheckoutSessionId: data.stripeCheckoutSessionId,
        stripePaymentIntentId: data.stripePaymentIntentId ?? null,
      },
    },
  });
}

/**
 * Updates only the status field of an Order.
 * Used for cancelled / failed / expired transitions.
 */
export async function updateOrderStatus(
  orderId: string,
  status: "pending" | "paid" | "failed" | "cancelled" | "fulfilled"
): Promise<void> {
  if (dataSource() !== "payload") return;
  const payload = await getPayloadClient();
  await payload.update({
    collection: "orders",
    id: orderId,
    overrideAccess: true,
    data: { status },
  });
}

/**
 * Decrements variant stock for every OrderItem belonging to `orderId`.
 *
 * Strategy:
 *   - Fetch all order-items where order = orderId (depth 0 — IDs only).
 *   - For each item, read the linked Variant, subtract quantity (floor 0).
 *   - Update Variant.stock in Payload.
 *   - Products.stock is NOT modified here — it is admin-managed separately.
 *
 * Failures per-item are logged but do not abort the rest; the webhook still
 * returns success so Stripe won't retry the payment-confirmation event.
 */
export async function decrementOrderItemsStock(orderId: string): Promise<void> {
  if (dataSource() !== "payload") return;
  const payload = await getPayloadClient();

  // 1. Fetch all order-items for this order
  const itemsResult = await payload.find({
    collection: "order-items",
    where: { order: { equals: orderId } },
    limit: 100,
    depth: 1, // depth 1 to populate the `variant` relationship
    overrideAccess: true,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = itemsResult.docs as any[];

  await Promise.allSettled(
    items.map(async (item) => {
      try {
        const quantity: number = typeof item.quantity === "number" ? item.quantity : 0;
        if (quantity <= 0) return;

        // The `variant` field is populated at depth 1 — it's the variant doc
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const variantDoc = item.variant as any;
        if (!variantDoc?.id) {
          console.warn(`[orders.decrementStock] No variant on order-item ${item.id}`);
          return;
        }

        const currentStock: number =
          typeof variantDoc.stock === "number" ? variantDoc.stock : 0;
        const newStock = Math.max(0, currentStock - quantity);

        await payload.update({
          collection: "variants",
          id: variantDoc.id,
          overrideAccess: true,
          data: { stock: newStock },
        });

        console.log(
          `[orders.decrementStock] variant ${variantDoc.id} (${variantDoc.sku}): ` +
            `${currentStock} → ${newStock} (−${quantity})`
        );
      } catch (err) {
        console.error(
          `[orders.decrementStock] Failed for order-item ${item.id}:`,
          err instanceof Error ? err.message : err
        );
      }
    })
  );
}

// Re-export mapper types for callers that receive raw Payload docs
export { mapPayloadOrder, mapPayloadOrderToSummary };
export type { RawPayloadOrder };
