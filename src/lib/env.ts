/**
 * Environment validation helper — ElektrK
 *
 * Design rules:
 *  - NEVER throws at module-import time (build-safe).
 *  - NEVER logs secrets or their values.
 *  - `assertEnv()` throws only when called explicitly (e.g. inside a route handler).
 *  - `warnMissingProductionVars()` logs once per process to stdout (safe for server logs).
 *  - All helpers are pure functions — no side effects at the module level.
 *
 * Usage:
 *  - import { assertStripeConfigured } from "@/lib/env"  → in route handlers
 *  - import { warnMissingProductionVars } from "@/lib/env"  → in app startup / instrumentation
 *  - import { isStripeReady, isAuthReady, isPayloadReady } from "@/lib/env"  → boolean guards
 */

// ---------------------------------------------------------------------------
// DATA_SOURCE
// ---------------------------------------------------------------------------

export type DataSource = "mock" | "payload";

export function getDataSource(): DataSource {
  const raw = process.env.DATA_SOURCE ?? "mock";
  return raw === "payload" ? "payload" : "mock";
}

export const isMockMode = (): boolean => getDataSource() === "mock";
export const isPayloadMode = (): boolean => getDataSource() === "payload";

// ---------------------------------------------------------------------------
// Boolean guards — safe to call anywhere, including module level
// ---------------------------------------------------------------------------

/** True when Neon DATABASE_URL is present (Payload + Auth can connect). */
export function isDatabaseReady(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/** True when all Payload-required env vars are present. */
export function isPayloadReady(): boolean {
  return Boolean(process.env.DATABASE_URL && process.env.PAYLOAD_SECRET);
}

/**
 * True when Auth.js can use the Neon adapter.
 * Mirrors the `isAuthConfigured()` in auth.ts — kept separate so importing
 * from `@/lib/env` never drags in next-auth at module parse time.
 */
export function isAuthReady(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/** True when the Stripe secret key is configured. */
export function isStripeReady(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** True when the Stripe webhook secret is configured. */
export function isStripeWebhookReady(): boolean {
  return Boolean(process.env.STRIPE_WEBHOOK_SECRET);
}

/** True when Google OAuth credentials are present. */
export function isGoogleAuthReady(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );
}

/** True when Facebook OAuth credentials are present. */
export function isFacebookAuthReady(): boolean {
  return Boolean(
    process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET
  );
}

// ---------------------------------------------------------------------------
// assertEnv — throws with actionable message, call only inside route handlers
// ---------------------------------------------------------------------------

/**
 * Asserts that a required env var is present.
 * @throws {Error} with a descriptive message (never logs the value).
 */
export function assertEnv(name: string, docRef?: string): void {
  if (!process.env[name]) {
    const ref = docRef ? ` See ${docRef}.` : "";
    throw new Error(
      `[ElektrK] Required environment variable "${name}" is not set.${ref}`
    );
  }
}

/**
 * Asserts that Stripe is fully configured for checkout creation.
 * Call this inside the /api/checkout/session route handler — never at build time.
 * @throws {Error} if STRIPE_SECRET_KEY is missing.
 */
export function assertStripeConfigured(): void {
  assertEnv("STRIPE_SECRET_KEY", "docs/STRIPE_SETUP.md");
}

/**
 * Asserts that the Stripe webhook secret is set.
 * Call this inside the /api/stripe/webhook route handler.
 * @throws {Error} if STRIPE_WEBHOOK_SECRET is missing.
 */
export function assertStripeWebhookConfigured(): void {
  assertEnv("STRIPE_WEBHOOK_SECRET", "docs/STRIPE_SETUP.md");
}

/**
 * Asserts that Payload CMS is fully configured.
 * Call this at the top of a Payload-dependent route.
 * @throws {Error} if DATABASE_URL or PAYLOAD_SECRET is missing.
 */
export function assertPayloadConfigured(): void {
  assertEnv("DATABASE_URL", "docs/DEPLOYMENT.md");
  assertEnv("PAYLOAD_SECRET", "docs/DEPLOYMENT.md");
}

// ---------------------------------------------------------------------------
// warnMissingProductionVars — safe one-time startup log (no secret values)
// ---------------------------------------------------------------------------

let _warned = false;

/**
 * Logs a single warning to stdout if production-required vars are missing.
 * Designed to be called in server instrumentation (e.g. `instrumentation.ts`)
 * or the app layout — never at module level.
 *
 * Safe rules:
 *  - Only runs once per process (memoised with `_warned`).
 *  - Only logs in non-test environments.
 *  - Never prints the value of any variable.
 *  - In mock mode: only warns, never throws.
 *  - In payload mode: throws if DATABASE_URL is absent in production.
 */
export function warnMissingProductionVars(): void {
  if (_warned) return;
  _warned = true;

  if (process.env.NODE_ENV === "test") return;

  const isProd = process.env.NODE_ENV === "production";
  const dataSource = getDataSource();
  const missing: string[] = [];

  // --- Always required in production ---
  if (isProd && !process.env.AUTH_SECRET)           missing.push("AUTH_SECRET");
  if (isProd && !process.env.AUTH_URL)              missing.push("AUTH_URL");
  if (isProd && !process.env.NEXT_PUBLIC_SERVER_URL) missing.push("NEXT_PUBLIC_SERVER_URL");

  // --- Required when payload mode is active ---
  if (dataSource === "payload") {
    if (!process.env.DATABASE_URL)       missing.push("DATABASE_URL");
    if (!process.env.PAYLOAD_SECRET)     missing.push("PAYLOAD_SECRET");
    if (isProd && !process.env.DATABASE_URL_UNPOOLED) missing.push("DATABASE_URL_UNPOOLED");
  }

  // --- Stripe — warn only, never throw ---
  const stripeVars: string[] = [];
  if (!process.env.STRIPE_SECRET_KEY)              stripeVars.push("STRIPE_SECRET_KEY");
  if (!process.env.STRIPE_WEBHOOK_SECRET)          stripeVars.push("STRIPE_WEBHOOK_SECRET");
  if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
    stripeVars.push("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");

  // --- OAuth — informational ---
  const oauthWarnings: string[] = [];
  if (!isGoogleAuthReady())   oauthWarnings.push("Google (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)");
  if (!isFacebookAuthReady()) oauthWarnings.push("Facebook (FACEBOOK_CLIENT_ID / FACEBOOK_CLIENT_SECRET)");

  // --- Report ---
  if (missing.length > 0) {
    const prefix = isProd
      ? "[ElektrK] PRODUCTION WARNING"
      : "[ElektrK] DEVELOPMENT NOTICE";
    console.warn(
      `${prefix}: The following required environment variables are not set:\n` +
        missing.map((v) => `  • ${v}`).join("\n") +
        "\n  → See docs/DEPLOYMENT.md for setup instructions."
    );

    // In payload mode + production, missing DATABASE_URL is fatal at request time.
    // Surface the error early so it's caught at startup, not mid-request.
    if (isProd && dataSource === "payload" && !process.env.DATABASE_URL) {
      throw new Error(
        "[ElektrK] Cannot start in production with DATA_SOURCE=payload and no DATABASE_URL. " +
          "Add DATABASE_URL to your Vercel environment variables. See docs/DEPLOYMENT.md."
      );
    }
  }

  if (stripeVars.length > 0) {
    console.info(
      "[ElektrK] Stripe is not fully configured (payments will be unavailable):\n" +
        stripeVars.map((v) => `  • ${v}`).join("\n") +
        "\n  → See docs/STRIPE_SETUP.md to enable real payments."
    );
  }

  if (oauthWarnings.length > 0 && isProd) {
    console.info(
      "[ElektrK] OAuth providers not configured (social login will be hidden):\n" +
        oauthWarnings.map((v) => `  • ${v}`).join("\n")
    );
  }
}

// ---------------------------------------------------------------------------
// getEnvSummary — returns a safe (no secret values) status object for logging
// ---------------------------------------------------------------------------

export interface EnvSummary {
  dataSource: DataSource;
  database: boolean;
  payload: boolean;
  auth: boolean;
  stripe: boolean;
  stripeWebhook: boolean;
  googleOAuth: boolean;
  facebookOAuth: boolean;
  serverUrl: string | null;
  nodeEnv: string;
}

/**
 * Returns a snapshot of which env features are active.
 * Safe to log — contains no secret values, only booleans and the server URL.
 */
export function getEnvSummary(): EnvSummary {
  return {
    dataSource: getDataSource(),
    database: isDatabaseReady(),
    payload: isPayloadReady(),
    auth: isAuthReady(),
    stripe: isStripeReady(),
    stripeWebhook: isStripeWebhookReady(),
    googleOAuth: isGoogleAuthReady(),
    facebookOAuth: isFacebookAuthReady(),
    serverUrl: process.env.NEXT_PUBLIC_SERVER_URL ?? null,
    nodeEnv: process.env.NODE_ENV ?? "development",
  };
}
