import { NextResponse } from "next/server";
import { expireStalePendingOrders } from "@/lib/repositories/orders";
import { getStoreSettings } from "@/lib/repositories/settings";

/**
 * Auto-expire stale unpaid orders (§4.2).
 *
 * Invoked by Vercel Cron (see vercel.json). Guarded by CRON_SECRET: Vercel sends
 * `Authorization: Bearer <CRON_SECRET>`. Cancels `pending` (and `payment_pending`
 * without an accepted proof) orders older than the configured TTL
 * (settings.payment.pendingOrderTtlDays, default 7). Never touches stock.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET no está configurado." },
      { status: 500 }
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const settings = await getStoreSettings();
  const ttlDays = settings.payment.pendingOrderTtlDays ?? 7;

  try {
    const result = await expireStalePendingOrders(ttlDays);
    return NextResponse.json({ ok: true, ttlDays, ...result });
  } catch (err) {
    console.error("[cron/expire-orders] failed:", err);
    return NextResponse.json({ ok: false, error: "Error interno." }, { status: 500 });
  }
}
