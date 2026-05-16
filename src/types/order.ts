/**
 * Order domain types — ElektrK
 *
 * Canonical storefront types for orders and order items.
 * Aligned with the Payload Orders / OrderItems collections and
 * the Stripe checkout flow (stripeCheckoutSessionId, stripePaymentIntentId).
 *
 * Phase 10A: used by mock repository and account UI.
 * Phase 7B+: populated from Payload after webhook confirms payment.
 */

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

/**
 * Canonical order lifecycle states.
 * Maps to the `status` field in the Payload Orders collection.
 *
 * pending   → order created, awaiting payment (Stripe session open)
 * paid      → payment confirmed via webhook (checkout.session.completed)
 * failed    → payment failed (payment_intent.payment_failed)
 * cancelled → cancelled by customer or admin before fulfillment
 * fulfilled → shipped / delivered to customer
 */
export type OrderStatus =
  | "pending"
  | "paid"
  | "failed"
  | "cancelled"
  | "fulfilled";

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending:   "Pendiente",
  paid:      "Pagado",
  failed:    "Fallido",
  cancelled: "Cancelado",
  fulfilled: "Entregado",
};

export const ORDER_STATUS_BADGE_VARIANT: Record<
  OrderStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  pending:   "outline",
  paid:      "secondary",
  failed:    "destructive",
  cancelled: "outline",
  fulfilled: "default",
};

export const ORDER_STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: "pending",   label: "Pendiente"  },
  { value: "paid",      label: "Pagado"     },
  { value: "failed",    label: "Fallido"    },
  { value: "cancelled", label: "Cancelado"  },
  { value: "fulfilled", label: "Entregado"  },
];

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function isValidOrderStatus(value: unknown): value is OrderStatus {
  return (
    value === "pending"   ||
    value === "paid"      ||
    value === "failed"    ||
    value === "cancelled" ||
    value === "fulfilled"
  );
}

// ---------------------------------------------------------------------------
// Order item — line-level detail
// ---------------------------------------------------------------------------

/**
 * A single line in an order. Represents a snapshot of the product/variant
 * at the time of purchase (prices may change after fulfillment).
 */
export interface OrderItemSummary {
  /** Payload OrderItems document ID. */
  id: string;
  /** Product name at time of purchase (snapshot). */
  productName: string;
  /** Product slug — allows linking to the current PDP if still exists. */
  productSlug: string | null;
  /** Variant label, e.g. "Caja × 10 piezas". */
  variantLabel: string;
  /** SKU at time of purchase. */
  variantSku: string;
  /** Unit price in MXN at time of purchase. */
  unitPrice: number;
  /** Quantity ordered. */
  quantity: number;
  /** Line total = unitPrice × quantity. */
  lineTotal: number;
  /** First product image URL (snapshot, may be null). */
  imageUrl: string | null;
}

// ---------------------------------------------------------------------------
// Order summary — list-level
// ---------------------------------------------------------------------------

/**
 * Lightweight summary shown in order lists (account dashboard, /account/orders).
 * Does not include full item detail — use OrderDetail for that.
 */
export interface OrderSummary {
  id: string;
  /** ISO 8601 string. */
  createdAt: string;
  status: OrderStatus;
  /** Pre-formatted date for display (e.g. "10 may. 2024"). */
  displayDate: string;
  /** Total amount in MXN pesos. */
  total: number;
  /** Number of line items (not total quantity). */
  itemCount: number;
  /** Customer email at time of purchase. */
  customerEmail: string;
}

// ---------------------------------------------------------------------------
// Order detail — full view for /account/orders/[id]
// ---------------------------------------------------------------------------

export interface OrderDetail extends OrderSummary {
  /** Full shipping address. */
  shippingAddress: ShippingAddress | null;
  /** Line items with product snapshots. */
  items: OrderItemSummary[];
  /** Subtotal before shipping. */
  subtotal: number;
  /** Shipping cost. */
  shipping: number;
  /** Stripe Checkout Session ID — cs_test_... or cs_live_... */
  stripeCheckoutSessionId: string | null;
  /** Stripe PaymentIntent ID. */
  stripePaymentIntentId: string | null;
  /** Auth.js user ID of the customer, if logged in at checkout. */
  customerAuthId: string;
  /** Optional admin notes. */
  notes: string | null;
}

export interface ShippingAddress {
  name: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  phone: string | null;
}

// ---------------------------------------------------------------------------
// Checkout input types — Phase 10B
// ---------------------------------------------------------------------------

/**
 * Slim cart item shape passed from the client to the checkout server action.
 * Only contains what the server needs to create Order + OrderItems in Payload.
 */
export interface CheckoutCartItem {
  /** Payload product document ID. */
  productId: string;
  productSlug: string;
  productName: string;
  variantSku: string;
  variantLabel: string;
  /** Unit price in MXN at time of checkout. */
  price: number;
  quantity: number;
}

/**
 * Full input for createOrder() in the orders repository.
 * The server action validates and builds this from the session + cart.
 */
export interface OrderCreateInput {
  customerAuthId: string;
  customerEmail: string;
  items: CheckoutCartItem[];
  /** Shipping address from the checkout form. */
  shippingName: string;
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingPostalCode: string;
  shippingPhone: string;
  /** Optional buyer notes. */
  notes: string;
  /** Server-recalculated totals. */
  subtotal: number;
  shipping: number;
  total: number;
}

/** Returned by the checkout server action on success. */
export interface CreateOrderResult {
  orderId: string;
}
