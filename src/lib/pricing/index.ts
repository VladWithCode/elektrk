/**
 * Pricing engine — ElektrK
 *
 * Pure functions: no side effects, no DB calls.
 * Works with CartItem[] from CartContext and StorefrontSettings from mock or Payload.
 * The checkout server action uses these totals to create the Order before the
 * buyer sends the WhatsApp message.
 */

import type { CartItem } from "@/types/product";
import type { StorefrontSettings } from "@/data/mock-settings";
import { formatCurrency } from "@/lib/currency";

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

export interface OrderTotals {
  subtotal: number;
  shipping: number;
  total: number;
  currency: string;
  taxIncluded: boolean;
  itemCount: number;
  /** Pre-formatted strings ready for display (avoids repeated formatCurrency calls) */
  formatted: {
    subtotal: string;
    shipping: string;
    total: string;
  };
}

export type CartValidationErrorType =
  | "EMPTY_CART"
  | "INVALID_QUANTITY"
  | "EXCEEDS_STOCK"
  | "INVALID_PRICE"
  | "INVALID_SUBTOTAL";

export interface CartValidationError {
  type: CartValidationErrorType;
  /** SKU of the offending item, absent for cart-level errors */
  sku?: string;
  message: string;
}

// ---------------------------------------------------------------------------
// calculateSubtotal
// ---------------------------------------------------------------------------

/**
 * Sum of (price × quantity) for all cart items.
 * Rounds to 2 decimal places to avoid floating-point drift.
 */
export function calculateSubtotal(items: CartItem[]): number {
  const raw = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  return Math.round(raw * 100) / 100;
}

// ---------------------------------------------------------------------------
// calculateShipping
// ---------------------------------------------------------------------------

/**
 * Returns the flat shipping rate from storefront settings.
 * Future: could return 0 for orders above a free-shipping threshold.
 */
export function calculateShipping(
  settings: Pick<StorefrontSettings, "flatShippingRate">
): number {
  return settings.flatShippingRate;
}

// ---------------------------------------------------------------------------
// calculateTotal
// ---------------------------------------------------------------------------

export function calculateTotal(subtotal: number, shipping: number): number {
  return Math.round((subtotal + shipping) * 100) / 100;
}

// ---------------------------------------------------------------------------
// formatOrderTotals
// ---------------------------------------------------------------------------

/**
 * Computes and formats all order totals in one call.
 * Returns both raw numbers (for logic) and pre-formatted strings (for display).
 */
export function formatOrderTotals(
  items: CartItem[],
  settings: Pick<
    StorefrontSettings,
    "flatShippingRate" | "currency" | "taxIncludedByDefault"
  >
): OrderTotals {
  const subtotal = calculateSubtotal(items);
  const shipping = calculateShipping(settings);
  const total = calculateTotal(subtotal, shipping);
  const itemCount = items.reduce((acc, i) => acc + i.quantity, 0);

  return {
    subtotal,
    shipping,
    total,
    currency: settings.currency,
    taxIncluded: settings.taxIncludedByDefault,
    itemCount,
    formatted: {
      subtotal: formatCurrency(subtotal),
      shipping: formatCurrency(shipping),
      total: formatCurrency(total),
    },
  };
}

// ---------------------------------------------------------------------------
// validateCartItems
// ---------------------------------------------------------------------------

/**
 * Validates cart items for basic integrity (not stock — see validateCartStock).
 * Returns an array of errors; empty array means the cart is valid.
 *
 * Checks:
 *   - Cart is not empty
 *   - Each item has quantity > 0
 *   - Each item has price > 0
 *   - Computed subtotal > 0
 */
export function validateCartItems(items: CartItem[]): CartValidationError[] {
  const errors: CartValidationError[] = [];

  if (items.length === 0) {
    errors.push({
      type: "EMPTY_CART",
      message: "El carrito está vacío. Agrega al menos un producto antes de continuar.",
    });
    return errors; // no point checking individual items
  }

  for (const item of items) {
    if (!item.quantity || item.quantity <= 0) {
      errors.push({
        type: "INVALID_QUANTITY",
        sku: item.variantSku,
        message: `Cantidad inválida para "${item.productName}" (${item.variantSku}).`,
      });
    }
    if (!item.price || item.price <= 0) {
      errors.push({
        type: "INVALID_PRICE",
        sku: item.variantSku,
        message: `Precio inválido para "${item.productName}" (${item.variantSku}).`,
      });
    }
  }

  const subtotal = calculateSubtotal(items);
  if (subtotal <= 0) {
    errors.push({
      type: "INVALID_SUBTOTAL",
      message: "El subtotal calculado no es válido. Revisa los precios del carrito.",
    });
  }

  return errors;
}

// ---------------------------------------------------------------------------
// validateCartStock
// ---------------------------------------------------------------------------

/**
 * Validates that requested quantities don't exceed available stock.
 * Uses the `stock` field stored in each CartItem (snapshot at add-to-cart time).
 *
 * Note: this is the client-side snapshot check. The checkout server action
 * re-validates against live stock from Payload (validateCartAgainstInventory)
 * before creating the order to prevent overselling.
 */
export function validateCartStock(items: CartItem[]): CartValidationError[] {
  const errors: CartValidationError[] = [];

  for (const item of items) {
    if (item.quantity > item.stock) {
      errors.push({
        type: "EXCEEDS_STOCK",
        sku: item.variantSku,
        message: `"${item.productName}" (${item.variantLabel}): solo hay ${item.stock} unidad${item.stock === 1 ? "" : "es"} disponible${item.stock === 1 ? "" : "s"}, pero tienes ${item.quantity} en el carrito.`,
      });
    }
  }

  return errors;
}
