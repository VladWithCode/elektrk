/**
 * Order mapper — ElektrK
 *
 * Converts raw Payload CMS order documents into storefront
 * OrderSummary / OrderDetail types.
 *
 * Payload shape (src/collections/Orders.ts + OrderItems.ts) — Phase 10B:
 *
 *   Orders:
 *     - id, status, createdAt, updatedAt
 *     - customer group:  { customerAuthId, customerEmail }
 *     - pricing group:   { subtotal, shipping, total, taxIncluded }
 *     - stripe group:    { stripePaymentIntentId, stripeCheckoutSessionId }
 *     - internalNotes    (top-level text)
 *     - items join → OrderItems[] (populated at depth ≥ 1 as { docs: [...] })
 *
 *   OrderItems:
 *     - id, order (rel), product (rel), variant (rel)
 *     - productNameSnapshot (text, snapshot)
 *     - variantSkuSnapshot  (text, snapshot)
 *     - quantity, unitPrice, total (number)
 *
 * All fields use defensive ?? null / safe fallback — a partially-filled
 * Payload document never throws.
 */

import type {
  OrderDetail,
  OrderSummary,
  OrderItemSummary,
  OrderStatus,
  ShippingAddress,
} from "@/types/order";
import { isValidOrderStatus, ORDER_STATUS_LABELS } from "@/types/order";

// ---------------------------------------------------------------------------
// Raw Payload shapes — aligned with actual collections
// ---------------------------------------------------------------------------

export interface RawPayloadOrderItem {
  id: string;
  quantity?: unknown;
  unitPrice?: unknown;
  /** `total` in the OrderItems collection (quantity × unitPrice). */
  total?: unknown;
  /** Snapshot fields — flat, not nested in a group. */
  productNameSnapshot?: unknown;
  variantSkuSnapshot?: unknown;
}

export interface RawPayloadOrder {
  id: string;
  status?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;

  /** customer group: { customerAuthId, customerEmail } */
  customer?: {
    customerAuthId?: unknown;
    customerEmail?: unknown;
  };

  /** pricing group: { subtotal, shipping, total, taxIncluded } */
  pricing?: {
    subtotal?: unknown;
    shipping?: unknown;
    total?: unknown;
    taxIncluded?: unknown;
  };

  /** stripe group: { stripePaymentIntentId, stripeCheckoutSessionId } */
  stripe?: {
    stripePaymentIntentId?: unknown;
    stripeCheckoutSessionId?: unknown;
  };

  /** Admin-only internal notes field. */
  internalNotes?: unknown;

  /**
   * Populated join — Payload v3 join fields return { docs: [...], hasNextPage: bool }
   * when populated (depth ≥ 1), or remain undefined/null at depth 0.
   */
  items?: unknown;
}

// ---------------------------------------------------------------------------
// mapPayloadOrderItem
// ---------------------------------------------------------------------------

export function mapPayloadOrderItem(raw: RawPayloadOrderItem): OrderItemSummary {
  return {
    id: raw.id,
    productName: str(raw.productNameSnapshot) ?? "Producto",
    // productSlug and imageUrl are not stored in the OrderItems collection —
    // these are intentional nulls; snapshots preserve name/sku/price only.
    productSlug: null,
    variantLabel: "",
    variantSku: str(raw.variantSkuSnapshot) ?? "",
    unitPrice: num(raw.unitPrice),
    quantity: num(raw.quantity, 1),
    lineTotal: num(raw.total),
    imageUrl: null,
  };
}

// ---------------------------------------------------------------------------
// mapPayloadOrder → OrderDetail
// ---------------------------------------------------------------------------

export function mapPayloadOrder(raw: RawPayloadOrder): OrderDetail {
  const status: OrderStatus = isValidOrderStatus(raw.status) ? raw.status : "pending";
  const createdAt = toIso(raw.createdAt);
  const displayDate = formatDisplayDate(createdAt);

  // Items — Payload v3 join returns { docs: [...], hasNextPage: bool } or [] or undefined
  const rawItems: RawPayloadOrderItem[] = extractDocs(raw.items);
  const items = rawItems.map(mapPayloadOrderItem);

  // Totals from `pricing` group
  const subtotal = num(raw.pricing?.subtotal);
  const shipping = num(raw.pricing?.shipping);
  const total = num(raw.pricing?.total) || subtotal + shipping;

  // The Orders collection has no shipping address group (added in a later phase).
  const shippingAddress: ShippingAddress | null = null;

  return {
    id: raw.id,
    createdAt,
    displayDate,
    status,
    total,
    subtotal,
    shipping,
    itemCount: items.length,
    customerEmail: str(raw.customer?.customerEmail) ?? "",
    customerAuthId: str(raw.customer?.customerAuthId) ?? "",
    items,
    shippingAddress,
    stripeCheckoutSessionId: str(raw.stripe?.stripeCheckoutSessionId),
    stripePaymentIntentId: str(raw.stripe?.stripePaymentIntentId),
    notes: str(raw.internalNotes),
  };
}

// ---------------------------------------------------------------------------
// mapPayloadOrderToSummary — lightweight list variant
// ---------------------------------------------------------------------------

export function mapPayloadOrderToSummary(raw: RawPayloadOrder): OrderSummary {
  const status: OrderStatus = isValidOrderStatus(raw.status) ? raw.status : "pending";
  const createdAt = toIso(raw.createdAt);
  const displayDate = formatDisplayDate(createdAt);

  const rawItems: unknown[] = extractDocs(raw.items);

  return {
    id: raw.id,
    createdAt,
    displayDate,
    status,
    total: num(raw.pricing?.total),
    itemCount: rawItems.length,
    customerEmail: str(raw.customer?.customerEmail) ?? "",
  };
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Extracts the docs array from either:
 *   - a Payload v3 join result: { docs: [...], hasNextPage: bool }
 *   - a plain array (legacy / depth-0 fallback)
 *   - undefined / null → []
 */
function extractDocs<T = unknown>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (
    value !== null &&
    typeof value === "object" &&
    "docs" in (value as object) &&
    Array.isArray((value as { docs: unknown }).docs)
  ) {
    return (value as { docs: T[] }).docs;
  }
  return [];
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function num(value: unknown, fallback = 0): number {
  if (typeof value === "number" && isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    if (isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toIso(value: unknown): string {
  if (typeof value === "string" && value.length > 0) return value;
  if (value instanceof Date) return value.toISOString();
  return new Date().toISOString();
}

function formatDisplayDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-MX", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

// Unused but kept to satisfy the ShippingAddress import (used in mapPayloadOrder return type)
const _shippingAddressTypeCheck: ShippingAddress | null = null;
void _shippingAddressTypeCheck;

// Re-export for convenience
export { ORDER_STATUS_LABELS };
