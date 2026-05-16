/**
 * Stripe checkout types — ElektrK
 *
 * Domain types for the Stripe integration layer. Aligned with:
 *   - CartItem (src/types/product.ts)
 *   - pricing engine (src/lib/pricing/index.ts)
 *   - MOCK_SETTINGS / StorefrontSettings (src/data/mock-settings.ts)
 *   - Future Orders / OrderItems Payload collections
 *
 * These are ElektrK's own types — not imported from 'stripe' — so the build
 * works regardless of whether the stripe package is installed.
 */

// ---------------------------------------------------------------------------
// Line items
// ---------------------------------------------------------------------------

/**
 * A single product line prepared for a Stripe Checkout Session.
 * Values are already converted to centavos (unit_amount × 100).
 */
export interface CheckoutLineItem {
  /** Display name shown in Stripe-hosted checkout UI. */
  name: string;
  /** Optional product subtitle / variant label. */
  description?: string;
  /** Unit price in centavos (e.g. $350 MXN → 35000). */
  unitAmountCentavos: number;
  /** Requested quantity. */
  quantity: number;
  /** First product image URL, if available. Shown in Stripe Checkout UI. */
  imageUrl?: string;
  /** Internal SKU — stored in Stripe product metadata for reconciliation. */
  sku: string;
}

// ---------------------------------------------------------------------------
// Checkout session input / output
// ---------------------------------------------------------------------------

/**
 * Everything createCheckoutSession() needs to build a Stripe session.
 */
export interface CheckoutSessionInput {
  /** Prepared line items (from CartItem[] via buildLineItems helper). */
  lineItems: CheckoutLineItem[];
  /** Customer contact details captured in the checkout form. */
  customer: {
    name: string;
    email: string;
    phone?: string;
  };
  /** Pre-computed totals from formatOrderTotals(). */
  totals: {
    subtotalCentavos: number;
    shippingCentavos: number;
    totalCentavos: number;
    currency: string; // "MXN"
  };
  /** Metadata to embed in the Stripe session for post-payment reconciliation. */
  orderMeta: StripeOrderMetadata;
  /** Absolute URL to redirect on successful payment. */
  successUrl: string;
  /** Absolute URL to redirect on cancelled payment. */
  cancelUrl: string;
}

/**
 * Result returned by createCheckoutSession().
 */
export interface CheckoutSessionResult {
  /** Stripe Checkout Session ID (cs_test_… or cs_live_…). */
  sessionId: string;
  /** URL to redirect the browser to for hosted checkout. */
  checkoutUrl: string;
}

// ---------------------------------------------------------------------------
// Order metadata embedded in Stripe session
// ---------------------------------------------------------------------------

/**
 * Key/value pairs stored in Stripe session.metadata.
 * All values must be strings (Stripe restriction, max 500 chars each).
 *
 * Used post-payment to:
 *   - Locate / create the matching Order in Payload
 *   - Associate the order with the authenticated user
 *   - Update order status and store stripeCheckoutSessionId
 */
export interface StripeOrderMetadata {
  /** Where the checkout originated. Always "storefront" for ElektrK. */
  source: "storefront";
  /** Auth.js user ID (session.user.id) — empty string when not authenticated. */
  customerAuthId: string;
  /** Customer email (from form, not from Auth session — always present). */
  customerEmail: string;
  /**
   * Draft order ID from Payload Orders collection, if created before checkout.
   * Optional — will be added in Phase 7B when Order creation is wired.
   */
  orderDraftId?: string;
  /**
   * Serialised cart item count for a quick sanity check in the webhook.
   * Example: "3"
   */
  cartItemCount: string;
  /** ISO timestamp of session creation. */
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Webhook event types
// ---------------------------------------------------------------------------

/**
 * Stripe event types that ElektrK's webhook handler cares about.
 * Extend this union as more events are handled.
 */
export type StripeWebhookEventType =
  | "checkout.session.completed"
  | "checkout.session.expired"
  | "payment_intent.payment_failed"
  | "payment_intent.succeeded"; // future: used for deferred capture

/**
 * Typed wrapper around a verified Stripe webhook event payload.
 */
export interface VerifiedStripeEvent<T = Record<string, unknown>> {
  id: string;
  type: StripeWebhookEventType;
  /** The Stripe object for this event (e.g. a CheckoutSession or PaymentIntent). */
  object: T;
  /** Raw Stripe livemode flag — false in test mode. */
  livemode: boolean;
  /** Unix timestamp of event creation. */
  created: number;
}

// ---------------------------------------------------------------------------
// Webhook handler results
// ---------------------------------------------------------------------------

export type WebhookHandlerStatus =
  | "handled"      // Event processed successfully
  | "skipped"      // Event type not handled — safe to return 200
  | "error";       // Processing failed — return 500

export interface WebhookHandlerResult {
  status: WebhookHandlerStatus;
  message: string;
}
