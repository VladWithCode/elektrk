/**
 * Stripe barrel export — ElektrK
 * Single import point for the Stripe integration layer.
 */
export { isStripeConfigured, isStripeCheckoutEnabled, getStripeClient } from "./client";
export {
  createCheckoutSession,
  buildCheckoutInput,
  buildLineItems,
  buildOrderMetadata,
  toCentavos,
  fromCentavos,
} from "./checkout";
export type {
  CheckoutLineItem,
  CheckoutSessionInput,
  CheckoutSessionResult,
  StripeOrderMetadata,
  StripeWebhookEventType,
  WebhookHandlerResult,
} from "./types";
