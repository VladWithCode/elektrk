"use server";

/**
 * Checkout Server Actions — /checkout (Phase 15B)
 *
 * submitCheckout flow:
 *   1. Validate Auth.js session (auth gate).
 *   2. Basic cart shape validation (non-empty, sane quantities).
 *   3. Live inventory check against Payload — stock + active status (Phase 15B).
 *      → If ANY item fails: throw immediately, NO order created.
 *   4. Recalculate totals server-side using AUTHORITATIVE prices from Payload.
 *      → Client-supplied prices are NEVER trusted for order totals or Stripe.
 *   5. Create Order (status: "pending") + OrderItems in Payload.
 *   6. Create Stripe Checkout Session with orderId in metadata.
 *   7. Save stripeCheckoutSessionId on the Order.
 *   8. Return { orderId, checkoutUrl } — frontend redirects to Stripe.
 *
 * Security guarantees (Phase 15B):
 *   - Stock is always read from Payload just before order creation (live, not snapshot).
 *   - Prices are always read from Payload (liveVariants map) and override client input.
 *   - An order is NEVER created if any item is out of stock, inactive, or missing.
 *   - Stock is only decremented by the Stripe webhook AFTER confirmed payment.
 */

import { getSessionSafe } from "@/lib/auth/helpers";
import { createOrder, updateOrderStripeSession } from "@/lib/repositories/orders";
import { formatOrderTotals } from "@/lib/pricing";
import { getStoreSettings } from "@/lib/repositories/settings";
import {
  validateCartAgainstInventory,
  buildStockErrorMessage,
} from "@/lib/inventory/stock";
import type { CheckoutCartItem } from "@/types/order";
import type { CartItem } from "@/types/product";
import {
  isStripeConfigured,
  isStripeCheckoutEnabled,
  createCheckoutSession,
  buildLineItems,
  buildOrderMetadata,
  toCentavos,
} from "@/lib/stripe";

export interface CheckoutSubmitInput {
  items: CheckoutCartItem[];
  shippingName: string;
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingPostalCode: string;
  shippingPhone: string;
  notes: string;
}

export interface CheckoutSubmitResult {
  orderId: string;
  checkoutUrl: string;
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

  // ── 3. Live inventory validation (Phase 15B) ──────────────────────────────
  // Fetches authoritative stock + price from Payload for every SKU in parallel.
  // If ANY item is out of stock, inactive, or not found → abort immediately.
  // No order is created until every item passes.
  const { valid, errors, liveVariants } = await validateCartAgainstInventory(
    input.items
  );
  if (!valid) {
    throw new Error(buildStockErrorMessage(errors));
  }

  // ── 4. Server-side totals using AUTHORITATIVE prices from Payload ─────────
  // liveVariants[sku].price overrides whatever the client sent.
  // This means a price change in Payload Admin is reflected immediately.
  const [settings] = await Promise.all([getStoreSettings()]);

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
  const { orderId } = await createOrder({
    customerAuthId: session.user.id,
    customerEmail: session.user.email,
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

  // ── 6. Create Stripe Checkout Session ────────────────────────────────────
  //
  // TWO independent guards must both pass before Stripe is invoked:
  //   1. STRIPE_CHECKOUT_ENABLED=true  — explicit feature flag (on/off switch).
  //      Allows keeping test keys in .env.local without routing real orders.
  //   2. isStripeConfigured()           — STRIPE_SECRET_KEY is present.
  //
  // If either guard fails → return the order as "pending" with a local URL.
  // The Stripe webhook will later promote it to "paid" once keys are live.
  if (!isStripeCheckoutEnabled() || !isStripeConfigured()) {
    return { orderId, checkoutUrl: `/checkout/success?orderId=${orderId}` };
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_SERVER_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const stripeSession = await createCheckoutSession({
    // Line items use server-recalculated cartItems (authoritative prices)
    lineItems: buildLineItems(cartItems),
    customer: {
      name: input.shippingName,
      email: session.user.email,
      phone: input.shippingPhone || undefined,
    },
    totals: {
      subtotalCentavos: toCentavos(totals.subtotal),
      shippingCentavos: toCentavos(totals.shipping),
      totalCentavos: toCentavos(totals.total),
      currency: settings.currency,
    },
    orderMeta: buildOrderMetadata(session.user.email, input.items.length, {
      customerAuthId: session.user.id,
      orderDraftId: orderId,
    }),
    successUrl: `${baseUrl}/checkout/success?orderId=${orderId}`,
    cancelUrl: `${baseUrl}/checkout/cancel?orderId=${orderId}`,
  });

  // ── 7. Save stripeCheckoutSessionId on the Order ──────────────────────────
  await updateOrderStripeSession(orderId, stripeSession.sessionId);

  return { orderId, checkoutUrl: stripeSession.checkoutUrl };
}
