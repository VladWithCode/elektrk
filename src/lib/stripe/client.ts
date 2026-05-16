/**
 * Stripe client — ElektrK
 *
 * Safe lazy loader: never initialises Stripe during build or at module-import
 * time. The SDK is loaded with a dynamic `require()` inside the getter so that:
 *
 *   1. Build succeeds without STRIPE_SECRET_KEY (no env crash at startup).
 *   2. TypeScript never statically resolves the 'stripe' package, so the build
 *      also succeeds even if the package is not yet installed locally.
 *   3. At runtime the error surfaces only when a route actually tries to use
 *      Stripe — never on a page that doesn't need it.
 *
 * TODO (Phase 7B — activate real payments):
 *   Replace `require('stripe')` approach with a proper import once the
 *   stripe package is confirmed installed and STRIPE_SECRET_KEY is set in
 *   the Vercel / .env.local environment.
 */

/** Supported Stripe API version for this integration. */
export const STRIPE_API_VERSION = "2024-06-20" as const;

// ---------------------------------------------------------------------------
// isStripeConfigured
// ---------------------------------------------------------------------------

/**
 * Returns true only when STRIPE_SECRET_KEY is set at runtime.
 * Safe to call at the top level of a module — no side effects.
 */
export function isStripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.length > 0
  );
}

/**
 * Returns true only when STRIPE_CHECKOUT_ENABLED=true is explicitly set.
 *
 * This flag is the primary on/off switch for Stripe Checkout in the checkout
 * flow. Even if STRIPE_SECRET_KEY is present, Stripe will be bypassed unless
 * this flag is "true". This makes it safe to keep test keys in .env.local
 * without accidentally routing orders through Stripe during development.
 *
 * To enable:  STRIPE_CHECKOUT_ENABLED="true"  (in .env.local or hosting dashboard)
 * To disable: omit the variable OR set it to any value other than "true".
 */
export function isStripeCheckoutEnabled(): boolean {
  return process.env.STRIPE_CHECKOUT_ENABLED === "true";
}

// ---------------------------------------------------------------------------
// getStripeClient
// ---------------------------------------------------------------------------

let _stripeInstance: unknown = null;

/**
 * Lazily loads and returns the Stripe SDK instance.
 *
 * @throws {Error} If STRIPE_SECRET_KEY is not set.
 * @throws {Error} If the `stripe` npm package is not installed.
 *
 * Never call this at module-initialisation time. Only call it inside a
 * request handler or Server Action, guarded by `isStripeConfigured()`.
 *
 * @example
 * ```ts
 * if (!isStripeConfigured()) {
 *   return NextResponse.json({ error: "Stripe no configurado" }, { status: 503 });
 * }
 * const stripe = getStripeClient();
 * ```
 */
export function getStripeClient(): ReturnType<typeof _buildStripeInstance> {
  if (_stripeInstance) return _stripeInstance as ReturnType<typeof _buildStripeInstance>;
  _stripeInstance = _buildStripeInstance();
  return _stripeInstance as ReturnType<typeof _buildStripeInstance>;
}

function _buildStripeInstance() {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    throw new Error(
      "[ElektrK] STRIPE_SECRET_KEY is not set. " +
        "Set it in .env.local (test key) or in the Vercel dashboard (live key). " +
        "See docs/STRIPE_SETUP.md for instructions."
    );
  }

  // Dynamic require keeps TypeScript from resolving the 'stripe' module at
  // compile time. If the package is missing at runtime this will throw a
  // MODULE_NOT_FOUND error with a clear message.
  let StripeLib: { new (key: string, opts: Record<string, string>): unknown };
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    StripeLib = require("stripe");
  } catch {
    throw new Error(
      "[ElektrK] The 'stripe' npm package is not installed. " +
        "Run `bun add stripe` (or `npm install stripe`) to install it. " +
        "See docs/STRIPE_SETUP.md."
    );
  }

  return new StripeLib(secret, { apiVersion: STRIPE_API_VERSION }) as StripeInstance;
}

// ---------------------------------------------------------------------------
// Minimal StripeInstance surface — avoids depending on stripe's own types
// ---------------------------------------------------------------------------

/**
 * Minimal type describing the Stripe SDK surface used by ElektrK.
 * Expand this as more Stripe features are integrated.
 *
 * Using a hand-rolled interface instead of importing from 'stripe' keeps
 * the build independent of whether the package is installed.
 */
export interface StripeInstance {
  checkout: {
    sessions: {
      create(params: StripeCheckoutSessionCreateParams): Promise<StripeCheckoutSession>;
      retrieve(id: string): Promise<StripeCheckoutSession>;
    };
  };
  webhooks: {
    constructEvent(
      payload: string | Buffer,
      signature: string,
      secret: string
    ): StripeWebhookEvent;
  };
}

export interface StripeCheckoutSessionCreateParams {
  mode: "payment";
  currency: string;
  line_items: StripeLineItem[];
  success_url: string;
  cancel_url: string;
  customer_email?: string;
  metadata?: Record<string, string>;
  payment_intent_data?: {
    metadata?: Record<string, string>;
  };
  shipping_options?: Array<{
    shipping_rate_data: {
      type: "fixed_amount";
      display_name: string;
      fixed_amount: { amount: number; currency: string };
    };
  }>;
}

export interface StripeLineItem {
  price_data: {
    currency: string;
    unit_amount: number; // centavos
    product_data: { name: string; description?: string; images?: string[] };
  };
  quantity: number;
}

export interface StripeCheckoutSession {
  id: string;
  url: string | null;
  status: "open" | "complete" | "expired" | null;
  payment_status: "paid" | "unpaid" | "no_payment_required";
  payment_intent: string | null;
  customer_email: string | null;
  metadata: Record<string, string> | null;
  amount_total: number | null;
  currency: string | null;
}

export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}
