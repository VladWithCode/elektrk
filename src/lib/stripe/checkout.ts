/**
 * Stripe checkout service — ElektrK
 *
 * Handles the construction and creation of Stripe Checkout Sessions.
 *
 * Hard constraints (Phase 7A — architecture only):
 *   ✗ Does NOT create Orders in Payload CMS
 *   ✗ Does NOT touch Neon / DATABASE_URL
 *   ✗ Does NOT decrement stock
 *   ✗ Does NOT run real payments from the UI
 *
 * TODO (Phase 7B — activate real payments):
 *   1. Before calling createCheckoutSession:
 *      a. Re-validate stock from Payload (CartItem.stock is a stale snapshot).
 *      b. Create a "pending" Order + OrderItems in Payload.
 *      c. Pass the new Order ID as orderMeta.orderDraftId.
 *   2. After checkout.session.completed webhook fires:
 *      a. Retrieve the session and its payment_intent.
 *      b. Update Order.status → "paid".
 *      c. Store Order.stripeCheckoutSessionId and Order.stripePaymentIntentId.
 *      d. Decrement stock for each OrderItem.
 *      e. Send confirmation email (optional, Phase 8).
 */

import type { CartItem } from "@/types/product";
import type { StorefrontSettings } from "@/data/mock-settings";
import {
  getStripeClient,
  isStripeConfigured,
  type StripeLineItem,
} from "./client";
import type {
  CheckoutLineItem,
  CheckoutSessionInput,
  CheckoutSessionResult,
  StripeOrderMetadata,
} from "./types";

// ---------------------------------------------------------------------------
// buildLineItems
// ---------------------------------------------------------------------------

/**
 * Converts CartItem[] → CheckoutLineItem[] for the session builder.
 * Prices are converted from MXN pesos to centavos (× 100).
 */
export function buildLineItems(items: CartItem[]): CheckoutLineItem[] {
  return items.map((item) => ({
    name: item.productName,
    description: item.variantLabel,
    unitAmountCentavos: Math.round(item.price * 100),
    quantity: item.quantity,
    imageUrl: item.image ?? undefined,
    sku: item.variantSku,
  }));
}

// ---------------------------------------------------------------------------
// buildOrderMetadata
// ---------------------------------------------------------------------------

/**
 * Builds the StripeOrderMetadata object to embed in the session.
 * All values are coerced to strings (Stripe requirement).
 */
export function buildOrderMetadata(
  customerEmail: string,
  cartItemCount: number,
  opts: { customerAuthId?: string; orderDraftId?: string } = {}
): StripeOrderMetadata {
  return {
    source: "storefront",
    customerAuthId: opts.customerAuthId ?? "",
    customerEmail,
    orderDraftId: opts.orderDraftId,
    cartItemCount: String(cartItemCount),
    createdAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// toCentavos / fromCentavos helpers
// ---------------------------------------------------------------------------

/** Converts a peso amount (e.g. 350.00) to centavos (35000). */
export function toCentavos(amount: number): number {
  return Math.round(amount * 100);
}

/** Converts centavos back to pesos for display. */
export function fromCentavos(centavos: number): number {
  return centavos / 100;
}

// ---------------------------------------------------------------------------
// buildStripeLineItems
// ---------------------------------------------------------------------------

/**
 * Converts CheckoutLineItem[] to the shape expected by the Stripe SDK.
 */
function buildStripeLineItems(
  lineItems: CheckoutLineItem[],
  currency: string
): StripeLineItem[] {
  return lineItems.map((item) => ({
    price_data: {
      currency: currency.toLowerCase(),
      unit_amount: item.unitAmountCentavos,
      product_data: {
        name: item.name,
        ...(item.description ? { description: item.description } : {}),
        ...(item.imageUrl ? { images: [item.imageUrl] } : {}),
      },
    },
    quantity: item.quantity,
  }));
}

// ---------------------------------------------------------------------------
// createCheckoutSession
// ---------------------------------------------------------------------------

/**
 * Creates a Stripe Checkout Session and returns the session ID + URL.
 *
 * @throws {Error} If Stripe is not configured (STRIPE_SECRET_KEY missing).
 * @throws {Error} If the `stripe` package is not installed.
 * @throws {Error} If total is not positive.
 * @throws {Error} If no line items are provided.
 *
 * Guard with `isStripeConfigured()` before calling from a route handler.
 */
export async function createCheckoutSession(
  input: CheckoutSessionInput
): Promise<CheckoutSessionResult> {
  // --- Precondition: Stripe must be configured ---
  if (!isStripeConfigured()) {
    throw new Error(
      "[ElektrK] Stripe is not configured. Set STRIPE_SECRET_KEY in your " +
        "environment variables. See docs/STRIPE_SETUP.md."
    );
  }

  // --- Precondition: Must have at least one line item ---
  if (input.lineItems.length === 0) {
    throw new Error("[ElektrK] Cannot create a Stripe session with no line items.");
  }

  // --- Precondition: Total must be positive ---
  if (input.totals.totalCentavos <= 0) {
    throw new Error(
      `[ElektrK] Invalid total: ${input.totals.totalCentavos} centavos. ` +
        "Total must be greater than zero."
    );
  }

  const currency = input.totals.currency.toLowerCase(); // "mxn"

  // Convert our internal line items to Stripe's format
  const stripeLineItems = buildStripeLineItems(input.lineItems, currency);

  // Build metadata record (all values must be strings)
  const metadata: Record<string, string> = {
    source: input.orderMeta.source,
    customerAuthId: input.orderMeta.customerAuthId,
    customerEmail: input.orderMeta.customerEmail,
    cartItemCount: input.orderMeta.cartItemCount,
    createdAt: input.orderMeta.createdAt,
    ...(input.orderMeta.orderDraftId
      ? { orderDraftId: input.orderMeta.orderDraftId }
      : {}),
  };

  const stripe = getStripeClient();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    currency,
    line_items: stripeLineItems,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    customer_email: input.customer.email,
    metadata,
    // Shipping is included as a separate line item rather than a shipping_rate
    // so we can display the carrier-agnostic "Envío estándar" label.
    // TODO (Phase 7B): replace with a real Stripe shipping_rate object.
    shipping_options: [
      {
        shipping_rate_data: {
          type: "fixed_amount",
          display_name: "Envío estándar",
          fixed_amount: {
            amount: input.totals.shippingCentavos,
            currency,
          },
        },
      },
    ],
    payment_intent_data: {
      metadata,
    },
  });

  if (!session.url) {
    throw new Error(
      "[ElektrK] Stripe returned a session without a checkout URL. " +
        `Session ID: ${session.id}`
    );
  }

  return {
    sessionId: session.id,
    checkoutUrl: session.url,
  };
}

// ---------------------------------------------------------------------------
// buildCheckoutInput  (convenience factory)
// ---------------------------------------------------------------------------

/**
 * Convenience factory: builds a CheckoutSessionInput from the raw cart data
 * and settings without the caller needing to know about centavo conversion.
 *
 * @param items      - CartItem[] from CartContext
 * @param settings   - StorefrontSettings (or MOCK_SETTINGS)
 * @param totals     - Pre-computed OrderTotals from formatOrderTotals()
 * @param customer   - Contact info from the checkout form
 * @param opts       - Optional auth ID, draft order ID, base URL
 */
export function buildCheckoutInput(
  items: CartItem[],
  settings: Pick<StorefrontSettings, "currency">,
  totals: { subtotal: number; shipping: number; total: number },
  customer: { name: string; email: string; phone?: string },
  opts: {
    customerAuthId?: string;
    orderDraftId?: string;
    baseUrl?: string;
  } = {}
): CheckoutSessionInput {
  const baseUrl = opts.baseUrl ?? process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3000";
  const lineItems = buildLineItems(items);
  const orderMeta = buildOrderMetadata(customer.email, items.length, {
    customerAuthId: opts.customerAuthId,
    orderDraftId: opts.orderDraftId,
  });

  return {
    lineItems,
    customer,
    totals: {
      subtotalCentavos: toCentavos(totals.subtotal),
      shippingCentavos: toCentavos(totals.shipping),
      totalCentavos: toCentavos(totals.total),
      currency: settings.currency,
    },
    orderMeta,
    successUrl: `${baseUrl}/checkout/success`,
    cancelUrl: `${baseUrl}/checkout/cancel`,
  };
}
