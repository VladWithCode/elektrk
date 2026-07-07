import { createHmac, timingSafeEqual } from "crypto";

/**
 * Guest order access token — HMAC over the order id, keyed by PAYLOAD_SECRET
 * (falls back to AUTH_SECRET). Lets a guest who just completed checkout view
 * their own /checkout/success page (order number + WhatsApp hand-off) without
 * a session, while keeping enumerable serial order ids unguessable.
 *
 * The token is only ever issued in the createOrder response for guest orders;
 * it grants access to that single order and nothing else.
 */

function secret(): string | null {
  return process.env.PAYLOAD_SECRET ?? process.env.AUTH_SECRET ?? null;
}

export function buildGuestOrderToken(orderId: string): string | null {
  const key = secret();
  if (!key) return null;
  return createHmac("sha256", key).update(`guest-order:${orderId}`).digest("hex");
}

export function verifyGuestOrderToken(
  orderId: string,
  token: string | undefined | null
): boolean {
  if (!token) return false;
  const expected = buildGuestOrderToken(orderId);
  if (!expected) return false;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(token, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
