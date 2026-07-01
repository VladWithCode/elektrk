/**
 * Order mapper — ElektrK
 *
 * Converts raw Payload CMS order documents into storefront
 * OrderSummary / OrderDetail types.
 *
 * Payload shape (src/collections/Orders.ts + OrderItems.ts):
 *
 *   Orders:
 *     - id, orderNumber, status, createdAt, updatedAt
 *     - customer group:  { customerName, customerAuthId, customerEmail }
 *     - shipping group:  { name, address, city, state, postalCode, phone }
 *     - pricing group:   { subtotal, shipping, total, taxIncluded }
 *     - notes            (buyer notes, customer-facing)
 *     - internalNotes    (admin-only — never mapped to OrderDetail)
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
  PaymentProof,
  PaymentProofUploader,
  PaymentProofReviewStatus,
  OrderStatusChange,
} from "@/types/order";
import { isValidOrderStatus, ORDER_STATUS_LABELS } from "@/types/order";
import { formatOrderNumber } from "@/lib/whatsapp/order-message";

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
  variantLabelSnapshot?: unknown;
}

export interface RawPayloadOrder {
  id: string;
  orderNumber?: unknown;
  status?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;

  /** customer group: { customerName, customerAuthId, customerEmail } */
  customer?: {
    customerName?: unknown;
    customerAuthId?: unknown;
    customerEmail?: unknown;
  };

  /** shipping group: { name, address, city, state, postalCode, phone } */
  shipping?: {
    name?: unknown;
    address?: unknown;
    city?: unknown;
    state?: unknown;
    postalCode?: unknown;
    phone?: unknown;
  };

  /** pricing group: { subtotal, shipping, total, taxIncluded } */
  pricing?: {
    subtotal?: unknown;
    shipping?: unknown;
    total?: unknown;
    taxIncluded?: unknown;
  };

  /** Buyer-facing delivery notes. */
  notes?: unknown;

  /** paymentProofs array: [{ id, file: media, uploadedBy, uploadedAt }] */
  paymentProofs?: unknown;

  /** statusHistory array: [{ status, changedAt, changedBy, note }] */
  statusHistory?: unknown;

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
    // these are intentional nulls; snapshots preserve name/sku/label/price only.
    productSlug: null,
    variantLabel: str(raw.variantLabelSnapshot) ?? "",
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

  const shippingAddress = mapShippingAddress(raw.shipping);

  return {
    id: raw.id,
    orderNumber: str(raw.orderNumber) ?? formatOrderNumber(raw.id),
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
    paymentProofs: mapPaymentProofs(raw.paymentProofs),
    statusHistory: mapStatusHistory(raw.statusHistory),
    shippingAddress,
    notes: str(raw.notes),
  };
}

// ---------------------------------------------------------------------------
// Status history
// ---------------------------------------------------------------------------

function mapStatusHistory(value: unknown): OrderStatusChange[] {
  if (!Array.isArray(value)) return [];
  const entries: OrderStatusChange[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as {
      status?: unknown;
      changedAt?: unknown;
      changedBy?: unknown;
      note?: unknown;
    };
    entries.push({
      status: isValidOrderStatus(row.status) ? row.status : "pending",
      changedAt: str(row.changedAt),
      changedBy: str(row.changedBy) ?? "system",
      note: str(row.note),
    });
  }
  // Oldest → newest (rows are appended chronologically, but sort defensively).
  entries.sort((a, b) => {
    const ta = a.changedAt ? new Date(a.changedAt).getTime() : 0;
    const tb = b.changedAt ? new Date(b.changedAt).getTime() : 0;
    return ta - tb;
  });
  return entries;
}

// ---------------------------------------------------------------------------
// Payment proofs
// ---------------------------------------------------------------------------

const UPLOADTHING_PUBLIC_BASE = "https://utfs.io/f/";

interface RawMediaRef {
  id?: unknown;
  _key?: unknown;
  filename?: unknown;
  mimeType?: unknown;
  url?: unknown;
  sizes?: Record<string, { _key?: unknown } | null> | null;
}

/** Resolves the public URL for a media doc (uploadthing key first, else url). */
function resolveProofUrl(file: RawMediaRef): string | null {
  if (typeof file._key === "string" && file._key) {
    return UPLOADTHING_PUBLIC_BASE + file._key;
  }
  const sizes = file.sizes;
  if (sizes) {
    for (const s of Object.values(sizes)) {
      if (s && typeof s._key === "string" && s._key) {
        return UPLOADTHING_PUBLIC_BASE + s._key;
      }
    }
  }
  return str(file.url);
}

function mapPaymentProofs(value: unknown): PaymentProof[] {
  if (!Array.isArray(value)) return [];
  const proofs: PaymentProof[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as {
      id?: unknown;
      file?: unknown;
      uploadedBy?: unknown;
      uploadedAt?: unknown;
      reviewStatus?: unknown;
      reviewNote?: unknown;
    };
    // `file` is the populated media doc at depth ≥ 2; skip if not populated.
    if (!row.file || typeof row.file !== "object") continue;
    const file = row.file as RawMediaRef;
    const mimeType = str(file.mimeType) ?? "";
    const reviewStatus: PaymentProofReviewStatus =
      row.reviewStatus === "accepted" || row.reviewStatus === "rejected"
        ? row.reviewStatus
        : "pending";
    proofs.push({
      id: str(row.id) ?? String(file.id ?? ""),
      url: resolveProofUrl(file),
      filename: str(file.filename) ?? "comprobante",
      isImage: mimeType.startsWith("image/"),
      uploadedBy: (row.uploadedBy === "customer" ? "customer" : "admin") as PaymentProofUploader,
      uploadedAt: str(row.uploadedAt),
      reviewStatus,
      reviewNote: str(row.reviewNote),
    });
  }
  return proofs;
}

/**
 * Builds a ShippingAddress from the Orders `shipping` group.
 * Returns null when no shipping data was captured (e.g. legacy orders).
 */
function mapShippingAddress(
  shipping: RawPayloadOrder["shipping"]
): ShippingAddress | null {
  if (!shipping) return null;
  const name = str(shipping.name);
  const address = str(shipping.address);
  const city = str(shipping.city);
  const state = str(shipping.state);
  const postalCode = str(shipping.postalCode);
  // Treat the address as present only when there is something meaningful.
  if (!name && !address && !city && !state && !postalCode) return null;
  return {
    name: name ?? "",
    address: address ?? "",
    city: city ?? "",
    state: state ?? "",
    postalCode: postalCode ?? "",
    phone: str(shipping.phone),
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
    orderNumber: str(raw.orderNumber) ?? formatOrderNumber(raw.id),
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

// Re-export for convenience
export { ORDER_STATUS_LABELS };
