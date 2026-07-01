/**
 * Order domain types — ElektrK
 *
 * Canonical storefront types for orders and order items.
 * Aligned with the Payload Orders / OrderItems collections and
 * the WhatsApp order flow (no online payment — the buyer sends a
 * pre-filled WhatsApp message to the store and the admin manages
 * payment + status manually from the dashboard).
 */

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

/**
 * Canonical order lifecycle states.
 * Maps to the `status` field in the Payload Orders collection.
 *
 * pending         → order created, buyer has not yet been contacted for payment
 * payment_pending → admin requested payment / awaiting payment proof
 * paid            → payment confirmed by the admin (transfer or in-store)
 * fulfilled       → shipped / delivered to customer
 * cancelled       → cancelled by customer or admin before fulfillment
 */
export type OrderStatus =
  | "pending"
  | "payment_pending"
  | "paid"
  | "fulfilled"
  | "cancelled";

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending:         "Recibida",
  payment_pending: "Pago en revisión",
  paid:            "Pago confirmado",
  fulfilled:       "Entregada",
  cancelled:       "Cancelada",
};

export const ORDER_STATUS_BADGE_VARIANT: Record<
  OrderStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  pending:         "outline",
  payment_pending: "secondary",
  paid:            "default",
  fulfilled:       "default",
  cancelled:       "destructive",
};

export const ORDER_STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: "pending",         label: "Recibida"        },
  { value: "payment_pending", label: "Pago en revisión" },
  { value: "paid",            label: "Pago confirmado"  },
  { value: "fulfilled",       label: "Entregada"        },
  { value: "cancelled",       label: "Cancelada"        },
];

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function isValidOrderStatus(value: unknown): value is OrderStatus {
  return (
    value === "pending"         ||
    value === "payment_pending" ||
    value === "paid"            ||
    value === "fulfilled"       ||
    value === "cancelled"
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
// Payment proof — receipt attached to an order
// ---------------------------------------------------------------------------

/** Who attached a given payment proof. */
export type PaymentProofUploader = "customer" | "admin";

/** Admin review state of a payment proof. */
export type PaymentProofReviewStatus = "pending" | "accepted" | "rejected";

export const PROOF_REVIEW_LABELS: Record<PaymentProofReviewStatus, string> = {
  pending:  "Por revisar",
  accepted: "Aceptado",
  rejected: "Rechazado",
};

/**
 * A receipt (image or PDF) attached to an order as proof of payment.
 * Uploaded by the customer from their order detail page, or by the admin.
 */
export interface PaymentProof {
  /** Payload array-row id. */
  id: string;
  /** Public URL of the file (image or PDF), or null if unresolved. */
  url: string | null;
  /** Original filename. */
  filename: string;
  /** True when the file is an image (renderable as a thumbnail). */
  isImage: boolean;
  /** Who uploaded it. */
  uploadedBy: PaymentProofUploader;
  /** ISO 8601 upload timestamp, or null. */
  uploadedAt: string | null;
  /** Admin review state (defaults to "pending"). */
  reviewStatus: PaymentProofReviewStatus;
  /** Admin note explaining an acceptance/rejection, shown to the customer. */
  reviewNote: string | null;
}

// ---------------------------------------------------------------------------
// Status history — append-only audit trail
// ---------------------------------------------------------------------------

/** Who caused a status change. Stored as free text, conventionally one of these. */
export type StatusHistoryActor = "customer" | "admin" | "system";

/** A single status-change record, shown to the customer as a timeline entry. */
export interface OrderStatusChange {
  /** Status the order moved into. */
  status: OrderStatus;
  /** ISO 8601 timestamp, or null. */
  changedAt: string | null;
  /** Raw actor value ("customer" | "admin" | "system"). */
  changedBy: string;
  /** Optional reason shown to the customer. */
  note: string | null;
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
  /** Human-friendly order reference, e.g. "ORD-000042". Searchable in admin. */
  orderNumber: string;
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
  /** Payment receipts uploaded by the customer or admin. */
  paymentProofs: PaymentProof[];
  /** Append-only status-change audit trail (oldest → newest). */
  statusHistory: OrderStatusChange[];
  /** Subtotal before shipping. */
  subtotal: number;
  /** Shipping cost. */
  shipping: number;
  /** Auth.js user ID of the customer, if logged in at checkout. */
  customerAuthId: string;
  /** Buyer notes / admin notes (delivery instructions). */
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
  /** Client-generated UUID (once per checkout mount) that dedupes resubmits. */
  idempotencyKey?: string;
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

/** Returned by createOrder() in the orders repository. */
export interface CreateOrderResult {
  orderId: string;
  /** Human-friendly order reference, e.g. "ORD-000042". */
  orderNumber: string;
}
