/**
 * POST /api/checkout/session
 *
 * Creates a Stripe Checkout Session and returns the URL for redirect.
 *
 * Phase 7A status: PREPARED but not called from UI.
 *   - Full validation and session creation logic is wired.
 *   - Frontend does NOT call this endpoint yet (see checkout/page.tsx).
 *   - Returns 503 when Stripe is not configured (safe default).
 *
 * TODO (Phase 7B — activate real payments):
 *   1. Validate live stock from Payload before session creation.
 *   2. Create Order (status: "pending") + OrderItems in Payload.
 *   3. Pass Order.id as orderDraftId in the session metadata.
 *   4. After webhook confirms payment, update Order status + stock.
 *   5. Remove the STRIPE_PAYMENT_ENABLED guard if you want permanent activation.
 */

import { NextRequest, NextResponse } from "next/server";
import { isStripeConfigured } from "@/lib/stripe/client";
import {
  createCheckoutSession,
  buildCheckoutInput,
} from "@/lib/stripe/checkout";
import { validateCartItems, validateCartStock } from "@/lib/pricing";
import { getStoreSettings } from "@/lib/repositories/settings";
import type { CartItem } from "@/types/product";

// ---------------------------------------------------------------------------
// Request body schema
// ---------------------------------------------------------------------------

interface CheckoutSessionRequestBody {
  items: CartItem[];
  customer: {
    name: string;
    email: string;
    phone?: string;
  };
  totals: {
    subtotal: number;
    shipping: number;
    total: number;
  };
  /** Optional: Auth.js session.user.id — empty string if not logged in. */
  customerAuthId?: string;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  // --- Guard: Stripe must be configured ---
  if (!isStripeConfigured()) {
    return NextResponse.json(
      {
        error: "stripe_not_configured",
        message:
          "El servicio de pagos no está disponible en este momento. " +
          "Contacta al administrador de la tienda.",
      },
      { status: 503 }
    );
  }

  // --- Parse request body ---
  let body: CheckoutSessionRequestBody;
  try {
    body = (await req.json()) as CheckoutSessionRequestBody;
  } catch {
    return NextResponse.json(
      { error: "invalid_body", message: "El cuerpo de la solicitud no es JSON válido." },
      { status: 400 }
    );
  }

  const { items, customer, totals, customerAuthId } = body;

  // --- Validate required fields ---
  if (!items || !Array.isArray(items)) {
    return NextResponse.json(
      { error: "missing_items", message: "Se requiere un arreglo de productos (items)." },
      { status: 400 }
    );
  }
  if (!customer?.email || !customer?.name) {
    return NextResponse.json(
      { error: "missing_customer", message: "Se requieren nombre y correo del cliente." },
      { status: 400 }
    );
  }
  if (
    typeof totals?.total !== "number" ||
    totals.total <= 0
  ) {
    return NextResponse.json(
      { error: "invalid_totals", message: "El total del pedido no es válido." },
      { status: 400 }
    );
  }

  // --- Validate cart integrity ---
  const itemErrors = validateCartItems(items);
  if (itemErrors.length > 0) {
    return NextResponse.json(
      { error: "cart_validation_failed", details: itemErrors },
      { status: 422 }
    );
  }

  const stockErrors = validateCartStock(items);
  if (stockErrors.length > 0) {
    return NextResponse.json(
      { error: "stock_validation_failed", details: stockErrors },
      { status: 422 }
    );
  }

  // --- Build checkout input ---
  const storeSettings = await getStoreSettings();
  const input = buildCheckoutInput(
    items,
    { currency: storeSettings.currency },
    totals,
    customer,
    {
      customerAuthId: customerAuthId ?? "",
      // orderDraftId: will be set once Order creation is wired in Phase 7B
    }
  );

  // --- Create Stripe session ---
  try {
    const result = await createCheckoutSession(input);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado.";
    console.error("[/api/checkout/session]", message);
    return NextResponse.json(
      { error: "session_creation_failed", message },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Reject other methods
// ---------------------------------------------------------------------------

export function GET(): NextResponse {
  return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
}
