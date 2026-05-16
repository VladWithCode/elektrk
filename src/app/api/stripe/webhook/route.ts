/**
 * POST /api/stripe/webhook
 *
 * Stripe webhook handler — ElektrK (Phase 11B — active)
 *
 * Receives Stripe events, verifies the signature with STRIPE_WEBHOOK_SECRET,
 * and dispatches to per-event handlers that update Order status and stock.
 *
 * Required events (configure in Stripe Dashboard → Webhooks → Add endpoint):
 *   - checkout.session.completed
 *   - checkout.session.expired
 *   - payment_intent.payment_failed
 *
 * Security:
 *   - Raw body is used for signature verification (NOT req.json()).
 *   - We trust only data from the verified Stripe event, never from client.
 *   - orderId is read from session.metadata.orderDraftId (set by checkout action).
 *   - Returns 200 for ignored/skipped events so Stripe doesn't retry.
 *   - Returns 4xx/5xx only for genuine errors (Stripe will retry those).
 */

import { NextRequest, NextResponse } from "next/server";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe/client";
import {
  getOrderStatusById,
  updateOrderAfterPayment,
  updateOrderStatus,
  decrementOrderItemsStock,
} from "@/lib/repositories/orders";
import type {
  StripeWebhookEventType,
  WebhookHandlerResult,
} from "@/lib/stripe/types";

// Webhook signature verification requires the raw body.
// Next.js App Router: use req.text() — NOT req.json().
export const runtime = "nodejs"; // required for crypto inside Stripe SDK

export async function POST(req: NextRequest): Promise<NextResponse> {
  // --- Guard: webhook secret must be set ---
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error(
      "[stripe/webhook] STRIPE_WEBHOOK_SECRET is not set. " +
        "Set it in .env.local (from `stripe listen --print-secret`) or Vercel dashboard."
    );
    return NextResponse.json(
      {
        error: "webhook_not_configured",
        message: "El servicio de webhooks no está configurado.",
      },
      { status: 503 }
    );
  }

  // --- Guard: Stripe client must be configured ---
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "stripe_not_configured" },
      { status: 503 }
    );
  }

  // --- Read raw body (must not be parsed as JSON first) ---
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "missing_signature", message: "Falta el header stripe-signature." },
      { status: 400 }
    );
  }

  // --- Verify Stripe signature ---
  const stripe = getStripeClient();
  let event: {
    id: string;
    type: string;
    data: { object: Record<string, unknown> };
    livemode: boolean;
    created: number;
  };

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret
    ) as typeof event;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Signature verification failed.";
    console.error("[stripe/webhook] Signature verification failed:", msg);
    return NextResponse.json(
      { error: "invalid_signature", message: msg },
      { status: 400 }
    );
  }

  console.log(`[stripe/webhook] Received event: ${event.type} (${event.id})`);

  // --- Dispatch ---
  let result: WebhookHandlerResult;

  switch (event.type as StripeWebhookEventType) {
    case "checkout.session.completed":
      result = await handleCheckoutSessionCompleted(
        event.data.object as unknown as CheckoutSessionObject
      );
      break;

    case "checkout.session.expired":
      result = await handleCheckoutSessionExpired(
        event.data.object as unknown as CheckoutSessionObject
      );
      break;

    case "payment_intent.payment_failed":
      result = await handlePaymentIntentFailed(
        event.data.object as unknown as PaymentIntentObject
      );
      break;

    default:
      result = {
        status: "skipped",
        message: `Event type "${event.type}" is not handled by ElektrK.`,
      };
  }

  if (result.status === "error") {
    console.error(`[stripe/webhook] Handler error for ${event.type}:`, result.message);
    return NextResponse.json({ error: result.message }, { status: 500 });
  }

  return NextResponse.json({ received: true, status: result.status });
}

// ---------------------------------------------------------------------------
// Local interfaces — Stripe object shapes extracted from webhook events
// ---------------------------------------------------------------------------

interface CheckoutSessionObject {
  id: string;
  payment_intent: string | null;
  payment_status: string;
  customer_email: string | null;
  metadata: Record<string, string> | null;
  amount_total: number | null;
  currency: string | null;
}

interface PaymentIntentObject {
  id: string;
  status: string;
  metadata: Record<string, string> | null;
  last_payment_error?: { message?: string } | null;
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

/**
 * checkout.session.completed — IDEMPOTENT
 *
 * Stripe may deliver this event more than once. The guard ensures stock
 * is only decremented on the first delivery (when the order transitions
 * from a non-paid status to "paid"). Re-deliveries still update the Stripe
 * IDs (safe — same values every time) but skip the stock decrement.
 *
 * Guard flow:
 *   1. Validate payment_status === "paid".
 *   2. Extract orderId from session.metadata.orderDraftId.
 *   3. Fetch current Order status from Payload (lightweight — depth 0).
 *   4a. If already "paid" → update Stripe IDs only (idempotent), skip stock.
 *   4b. If not "paid"   → update to "paid" + Stripe IDs, then decrement stock.
 */
async function handleCheckoutSessionCompleted(
  session: CheckoutSessionObject
): Promise<WebhookHandlerResult> {
  const orderId = session.metadata?.orderDraftId ?? null;

  console.log(
    `[stripe/webhook] checkout.session.completed — ` +
      `session: ${session.id}, orderId: ${orderId ?? "none"}, ` +
      `payment_status: ${session.payment_status}`
  );

  // --- Guard 1: only act on confirmed payments ---
  if (session.payment_status !== "paid") {
    return {
      status: "skipped",
      message: `payment_status is "${session.payment_status}", not "paid". Skipping.`,
    };
  }

  // --- Guard 2: need an orderId to do anything ---
  if (!orderId) {
    console.warn(
      `[stripe/webhook] No orderDraftId in session metadata. session: ${session.id}`
    );
    return {
      status: "handled",
      message: "No orderId in metadata — skipped Order update.",
    };
  }

  // --- Guard 3: idempotency — fetch current Order status ---
  let previousStatus: string;
  try {
    const orderMeta = await getOrderStatusById(orderId);
    if (!orderMeta) {
      // Order doesn't exist in Payload (e.g. DATA_SOURCE mismatch or deleted).
      console.warn(
        `[stripe/webhook] Order ${orderId} not found in Payload. ` +
          `session: ${session.id}`
      );
      return {
        status: "handled",
        message: `Order ${orderId} not found — skipped.`,
      };
    }
    previousStatus = orderMeta.status;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[stripe/webhook] Could not fetch Order ${orderId} status:`, msg);
    return { status: "error", message: `Order status fetch failed: ${msg}` };
  }

  const stripePaymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : null;

  const alreadyPaid = previousStatus === "paid";

  if (alreadyPaid) {
    // Duplicate delivery — update Stripe IDs (safe, same values) but skip stock.
    console.log(
      `[stripe/webhook] Order ${orderId} already paid (status="${previousStatus}"). ` +
        `Updating Stripe IDs only — skipping stock decrement. session: ${session.id}`
    );
    try {
      await updateOrderAfterPayment(orderId, {
        status: "paid",
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId,
      });
    } catch (err) {
      // Non-fatal for a duplicate — log and acknowledge.
      console.error(
        `[stripe/webhook] Stripe ID re-save failed for order ${orderId}:`,
        err instanceof Error ? err.message : err
      );
    }
    return {
      status: "handled",
      message:
        `Order ${orderId} was already paid — stock unchanged (idempotent). ` +
        `session: ${session.id}`,
    };
  }

  // --- First delivery: transition pending/failed/cancelled → paid ---
  console.log(
    `[stripe/webhook] Order ${orderId}: "${previousStatus}" → "paid". session: ${session.id}`
  );

  // Update status + Stripe IDs
  try {
    await updateOrderAfterPayment(orderId, {
      status: "paid",
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId,
    });
    console.log(`[stripe/webhook] Order ${orderId} → paid ✓`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[stripe/webhook] Failed to update Order ${orderId}:`, msg);
    return { status: "error", message: `Order update failed: ${msg}` };
  }

  // Decrement variant stock (best-effort — per-item failures are logged internally)
  try {
    await decrementOrderItemsStock(orderId);
    console.log(`[stripe/webhook] Stock decremented for order ${orderId} ✓`);
  } catch (err) {
    // Non-fatal: stock can be corrected manually. Don't return error — Stripe
    // should not retry the payment-confirmation event due to a stock issue.
    console.error(
      `[stripe/webhook] Stock decrement failed for order ${orderId}:`,
      err instanceof Error ? err.message : err
    );
  }

  return {
    status: "handled",
    message:
      `Order ${orderId} "${previousStatus}" → "paid". ` +
      `Stock decremented. session: ${session.id}`,
  };
}

/**
 * checkout.session.expired
 *
 * Fires when the Stripe Checkout Session expires without payment.
 * Mark the Order as cancelled so the customer knows to try again.
 */
async function handleCheckoutSessionExpired(
  session: CheckoutSessionObject
): Promise<WebhookHandlerResult> {
  const orderId = session.metadata?.orderDraftId ?? null;

  console.log(
    `[stripe/webhook] checkout.session.expired — session: ${session.id}, ` +
      `orderId: ${orderId ?? "none"}`
  );

  if (!orderId) {
    return {
      status: "handled",
      message: "No orderId in metadata — skipped Order update.",
    };
  }

  try {
    await updateOrderStatus(orderId, "cancelled");
    console.log(`[stripe/webhook] Order ${orderId} → cancelled (session expired)`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { status: "error", message: `Order status update failed: ${msg}` };
  }

  return {
    status: "handled",
    message: `Order ${orderId} marked cancelled. session: ${session.id}`,
  };
}

/**
 * payment_intent.payment_failed
 *
 * Fires when a PaymentIntent fails (card declined, insufficient funds, etc.).
 * Mark the linked Order as failed if we can identify it from the PI metadata.
 *
 * Note: the PI metadata mirrors the session metadata (set in payment_intent_data
 * when creating the Checkout Session), so orderDraftId is available there too.
 */
async function handlePaymentIntentFailed(
  paymentIntent: PaymentIntentObject
): Promise<WebhookHandlerResult> {
  const orderId = paymentIntent.metadata?.orderDraftId ?? null;
  const failureMessage =
    paymentIntent.last_payment_error?.message ?? "Unknown failure";

  console.log(
    `[stripe/webhook] payment_intent.payment_failed — PI: ${paymentIntent.id}, ` +
      `orderId: ${orderId ?? "none"}, reason: ${failureMessage}`
  );

  if (!orderId) {
    return {
      status: "handled",
      message: "No orderId in PI metadata — skipped Order update.",
    };
  }

  try {
    await updateOrderStatus(orderId, "failed");
    console.log(`[stripe/webhook] Order ${orderId} → failed (payment_intent failed)`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { status: "error", message: `Order status update failed: ${msg}` };
  }

  return {
    status: "handled",
    message: `Order ${orderId} marked failed. PI: ${paymentIntent.id}`,
  };
}

// ---------------------------------------------------------------------------
// Reject other methods
// ---------------------------------------------------------------------------

export function GET(): NextResponse {
  return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
}
