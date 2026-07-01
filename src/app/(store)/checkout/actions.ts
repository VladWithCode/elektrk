"use server";

/**
 * Checkout Server Action — /checkout (WhatsApp order flow)
 *
 * submitCheckout flow:
 *   1. Validate Auth.js session (auth gate).
 *   2. Basic cart shape validation (non-empty, sane quantities).
 *   3. Live inventory check against Payload — stock + active status.
 *      → If ANY item fails: throw immediately, NO order created.
 *   4. Recalculate totals server-side using AUTHORITATIVE prices from Payload.
 *      → Client-supplied prices are NEVER trusted for order totals.
 *   5. Create Order (status: "pending") + OrderItems in Payload.
 *   6. Return the order id + number; the client redirects to /checkout/success,
 *      which rebuilds the pre-filled WhatsApp message from the saved order.
 *
 * There is no online payment: the order is initiated by the buyer sending the
 * WhatsApp message. The admin then requests payment, collects proof, confirms,
 * and updates the order status from the dashboard (which decrements stock).
 *
 * Security guarantees:
 *   - Stock is always read from Payload just before order creation (live, not snapshot).
 *   - Prices are always read from Payload (liveVariants map) and override client input.
 *   - An order is NEVER created if any item is out of stock, inactive, or missing.
 */

import { getSessionSafe } from "@/lib/auth/helpers";
import { createOrder } from "@/lib/repositories/orders";
import { formatOrderTotals } from "@/lib/pricing";
import { getStoreSettings } from "@/lib/repositories/settings";
import {
  validateCartAgainstInventory,
  buildStockErrorMessage,
} from "@/lib/inventory/stock";
import type { CheckoutCartItem } from "@/types/order";
import type { CartItem } from "@/types/product";

export interface CheckoutSubmitInput {
  items: CheckoutCartItem[];
  shippingName: string;
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingPostalCode: string;
  shippingPhone: string;
  notes: string;
  /** Client-generated UUID (once per checkout mount) to dedupe resubmissions. */
  idempotencyKey?: string;
}

export interface CheckoutSubmitResult {
  orderId: string;
  orderNumber: string;
}

export async function submitCheckout(
  input: CheckoutSubmitInput
): Promise<CheckoutSubmitResult> {
  // ── 1. Auth gate ─────────────────────────────────────────────────────────
  const session = await getSessionSafe();
  if (!session?.user?.id || !session.user.email) {
    throw new Error("Debes iniciar sesión para realizar una compra.");
  }

  // ── 2. Basic cart shape validation ───────────────────────────────────────
  if (!input.items || input.items.length === 0) {
    throw new Error("El carrito está vacío.");
  }
  for (const item of input.items) {
    if (!item.productId || !item.variantSku) {
      throw new Error("Un artículo del carrito tiene datos incompletos.");
    }
    if (item.quantity < 1) {
      throw new Error(`La cantidad de "${item.productName}" debe ser al menos 1.`);
    }
  }

  // ── 3. Live inventory validation ──────────────────────────────────────────
  // Fetches authoritative stock + price from Payload for every SKU in parallel.
  // If ANY item is out of stock, inactive, or not found → abort immediately.
  const { valid, errors, liveVariants } = await validateCartAgainstInventory(
    input.items
  );
  if (!valid) {
    throw new Error(buildStockErrorMessage(errors));
  }

  // ── 4. Server-side totals using AUTHORITATIVE prices from Payload ─────────
  const settings = await getStoreSettings();

  const cartItems: CartItem[] = input.items.map((item) => {
    const live = liveVariants[item.variantSku];
    return {
      productId: item.productId,
      productSlug: item.productSlug,
      productName: item.productName,
      brand: "",
      variantSku: item.variantSku,
      variantType: "piece" as const,
      variantLabel: item.variantLabel,
      // Use server price — never trust the client
      price: live?.price ?? item.price,
      quantity: item.quantity,
      // Real stock from Payload
      stock: live?.stock ?? 0,
      image: "",
    };
  });

  const totals = formatOrderTotals(cartItems, settings);

  // ── 5. Create Order + OrderItems in Payload ───────────────────────────────
  const { orderId, orderNumber } = await createOrder({
    customerAuthId: session.user.id,
    customerEmail: session.user.email,
    idempotencyKey: input.idempotencyKey,
    items: input.items.map((item) => ({
      ...item,
      // Persist authoritative price in the order item, not client price
      price: liveVariants[item.variantSku]?.price ?? item.price,
    })),
    shippingName: input.shippingName,
    shippingAddress: input.shippingAddress,
    shippingCity: input.shippingCity,
    shippingState: input.shippingState,
    shippingPostalCode: input.shippingPostalCode,
    shippingPhone: input.shippingPhone,
    notes: input.notes,
    subtotal: totals.subtotal,
    shipping: totals.shipping,
    total: totals.total,
  });

  // ── 6. Return — the success page rebuilds the WhatsApp message from the
  //      persisted order and renders the "Enviar por WhatsApp" button.
  return { orderId, orderNumber };
}
