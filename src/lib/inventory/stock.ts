/**
 * Inventory / stock helpers — ElektrK Phase 15B
 *
 * Single source of truth for live stock and price validation.
 * Called from server actions (never from client code) so secrets and
 * DB credentials are never exposed to the browser.
 *
 * DATA_SOURCE resolution:
 *   "payload" → queries live Variants collection in Payload CMS.
 *   "mock"    → reads MOCK_PRODUCTS (no DB required, safe for local dev).
 *
 * Authoritative field: Variants.stock (not Products.stock).
 *   Products.stock is an admin-managed summary field and is NOT used here.
 *
 * Price security:
 *   This module returns the server-authoritative price for every variant so
 *   submitCheckout() can override whatever the client sent. Client prices are
 *   never trusted for order totals.
 */

import type { CheckoutCartItem } from "@/types/order";
import { MOCK_PRODUCTS } from "@/data/mock-products";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface LiveVariantData {
  /** Payload document ID (or mock SKU when DATA_SOURCE=mock) */
  id: string;
  sku: string;
  /** Authoritative available stock — use this, never the client value */
  stock: number;
  /** Authoritative price (MXN, IVA included) */
  price: number;
  isActive: boolean;
}

export type StockErrorType =
  | "not_found"          // SKU not in DB
  | "inactive"           // variant.isActive = false
  | "out_of_stock"       // stock === 0
  | "insufficient_stock";// stock > 0 but < requestedQty

export interface StockError {
  sku: string;
  productName: string;
  requestedQty: number;
  /** 0 for out_of_stock/inactive/not_found */
  availableStock: number;
  type: StockErrorType;
}

export interface StockValidationResult {
  valid: boolean;
  errors: StockError[];
  /**
   * SKU → authoritative live data.
   * Present for every successfully found active variant, even when stock
   * is insufficient (so callers can show available qty in error messages).
   * Use liveVariants[sku].price to override client-supplied prices.
   */
  liveVariants: Record<string, LiveVariantData>;
}

// ---------------------------------------------------------------------------
// Lazy Payload client (mirrors pattern in other repositories)
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

function resolveDataSource(): "mock" | "payload" {
  return (process.env.DATA_SOURCE ?? "mock") === "payload" ? "payload" : "mock";
}

// ---------------------------------------------------------------------------
// getVariantLive
// ---------------------------------------------------------------------------

/**
 * Fetches a single variant's live stock, price, and active status by SKU.
 * Returns null when the SKU is not found.
 */
export async function getVariantLive(sku: string): Promise<LiveVariantData | null> {
  if (resolveDataSource() === "payload") {
    const payload = await getPayloadClient();
    const result = await payload.find({
      collection: "variants",
      where: { sku: { equals: sku } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = (result.docs as any[])[0];
    if (!doc) return null;
    return {
      id: String(doc.id),
      sku: doc.sku as string,
      stock: typeof doc.stock === "number" ? doc.stock : 0,
      price: typeof doc.price === "number" ? doc.price : 0,
      isActive: doc.isActive !== false,
    };
  }

  // --- Mock path ---
  for (const product of MOCK_PRODUCTS) {
    const variant = product.variants.find((v) => v.sku === sku);
    if (variant) {
      return {
        id: variant.sku, // mock has no separate ID
        sku: variant.sku,
        stock: variant.stock,
        price: variant.price,
        isActive: true, // mock variants are always active
      };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// validateCartAgainstInventory
// ---------------------------------------------------------------------------

/**
 * Validates every cart item against live Payload (or mock) inventory.
 *
 * Checks (in order):
 *   1. SKU exists in the DB.
 *   2. Variant is active (isActive = true).
 *   3. Stock > 0 (not completely out of stock).
 *   4. Stock >= requestedQty (sufficient for the requested quantity).
 *
 * Returns:
 *   - valid: false if ANY item fails.
 *   - errors: list of specific failures (multiple can occur in one call).
 *   - liveVariants: authoritative price + stock for every found variant.
 *     Use liveVariants[sku].price to recalculate server-side totals.
 *
 * Performance: all Payload queries are fired in parallel (Promise.allSettled).
 */
export async function validateCartAgainstInventory(
  items: CheckoutCartItem[]
): Promise<StockValidationResult> {
  const errors: StockError[] = [];
  const liveVariants: Record<string, LiveVariantData> = {};

  // Fire all variant lookups in parallel
  const results = await Promise.allSettled(
    items.map((item) => getVariantLive(item.variantSku))
  );

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const result = results[i];

    if (result.status === "rejected" || result.value === null) {
      // SKU not found in DB (or lookup threw)
      errors.push({
        sku: item.variantSku,
        productName: item.productName,
        requestedQty: item.quantity,
        availableStock: 0,
        type: "not_found",
      });
      continue;
    }

    const live = result.value;
    liveVariants[item.variantSku] = live;

    if (!live.isActive) {
      errors.push({
        sku: item.variantSku,
        productName: item.productName,
        requestedQty: item.quantity,
        availableStock: 0,
        type: "inactive",
      });
      continue;
    }

    if (live.stock === 0) {
      errors.push({
        sku: item.variantSku,
        productName: item.productName,
        requestedQty: item.quantity,
        availableStock: 0,
        type: "out_of_stock",
      });
      continue;
    }

    if (live.stock < item.quantity) {
      errors.push({
        sku: item.variantSku,
        productName: item.productName,
        requestedQty: item.quantity,
        availableStock: live.stock,
        type: "insufficient_stock",
      });
      // Still add to liveVariants so callers can show available qty
    }
  }

  return { valid: errors.length === 0, errors, liveVariants };
}

// ---------------------------------------------------------------------------
// buildStockErrorMessage
// ---------------------------------------------------------------------------

/**
 * Converts an array of StockErrors into a single human-readable string
 * suitable for display in the checkout error banner.
 *
 * Each error occupies one line. Multi-error messages list all failures so
 * the user can fix everything in one go rather than hitting errors one by one.
 */
export function buildStockErrorMessage(errors: StockError[]): string {
  if (errors.length === 0) return "";

  const lines = errors.map((err) => {
    switch (err.type) {
      case "not_found":
        return `"${err.productName}" (${err.sku}): este producto ya no está disponible.`;
      case "inactive":
        return `"${err.productName}" (${err.sku}): este producto ya no está activo en el catálogo.`;
      case "out_of_stock":
        return `"${err.productName}" (${err.sku}): sin stock disponible.`;
      case "insufficient_stock":
        return (
          `"${err.productName}" (${err.sku}): solo quedan ` +
          `${err.availableStock} unidad${err.availableStock === 1 ? "" : "es"}, ` +
          `pediste ${err.requestedQty}.`
        );
    }
  });

  const intro =
    errors.length === 1
      ? "No se pudo crear tu orden por el siguiente problema de stock:"
      : "No se pudo crear tu orden por problemas de stock:";

  return `${intro}\n${lines.join("\n")}`;
}
