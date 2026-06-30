/**
 * WhatsApp order message — ElektrK
 *
 * The store sells through WhatsApp: after an order is created in the DB, the
 * buyer is shown a "Enviar pedido por WhatsApp" button that opens a wa.me link
 * with a pre-filled message addressed to the store's registered number.
 *
 * The message summarises the purchase and includes the human-friendly order
 * number (e.g. ORD-000042) so the admin can search for it in the dashboard,
 * request payment, collect proof, and then confirm + update the order status.
 *
 * Pure functions — no DB, no side effects. Safe to import anywhere.
 */

// NOTE: relative import (not "@/lib/currency"). This module is imported by the
// Orders collection, which the Payload CLI loads under plain Node ESM where the
// "@/" path alias is not resolved. Keep every import in this chain relative.
import { formatCurrency } from "../currency";

// ---------------------------------------------------------------------------
// Order number
// ---------------------------------------------------------------------------

/** Zero-padded width of the numeric part of an order number (ORD-000042). */
const ORDER_NUMBER_PAD = 6;
const ORDER_NUMBER_PREFIX = "ORD-";

/**
 * Derives the human-friendly order reference from a Payload serial id.
 *   42 → "ORD-000042"
 * Non-numeric ids (e.g. mock "mock-123") are returned prefixed as-is so the
 * value is still stable and searchable.
 */
export function formatOrderNumber(id: number | string): string {
  const n = typeof id === "number" ? id : parseInt(String(id), 10);
  if (Number.isFinite(n) && n > 0) {
    return `${ORDER_NUMBER_PREFIX}${String(n).padStart(ORDER_NUMBER_PAD, "0")}`;
  }
  return `${ORDER_NUMBER_PREFIX}${id}`;
}

// ---------------------------------------------------------------------------
// Message builder
// ---------------------------------------------------------------------------

export interface WhatsAppOrderItem {
  productName: string;
  variantLabel: string;
  quantity: number;
  unitPrice: number;
}

export interface WhatsAppOrderMessageInput {
  storeName: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingPostalCode: string;
  items: WhatsAppOrderItem[];
  subtotal: number;
  shipping: number;
  total: number;
  currency: string;
  notes?: string | null;
}

/**
 * Builds the plain-text Spanish message the buyer sends to the store.
 * Returns a raw (un-encoded) string; encode it with buildWhatsAppUrl().
 */
export function buildOrderWhatsAppMessage(input: WhatsAppOrderMessageInput): string {
  const lines: string[] = [];

  lines.push(
    `Hola ${input.storeName}, quiero confirmar mi pedido ${input.orderNumber}`,
    ""
  );

  // Customer
  const contact = [input.customerEmail, input.customerPhone]
    .filter((v) => v && v.trim().length > 0)
    .join(", ");
  lines.push(`Cliente: ${input.customerName}${contact ? ` (${contact})` : ""}`);

  // Shipping
  lines.push(
    `Envío a: ${input.shippingAddress}, ${input.shippingCity}, ` +
      `${input.shippingState} ${input.shippingPostalCode}`,
    ""
  );

  // Items
  lines.push("Artículos:");
  for (const item of input.items) {
    const lineTotal = item.unitPrice * item.quantity;
    lines.push(
      `• ${item.productName} — ${item.variantLabel} ×${item.quantity} — ` +
        formatCurrency(lineTotal)
    );
  }
  lines.push("");

  // Totals
  lines.push(
    `Subtotal: ${formatCurrency(input.subtotal)}`,
    `Envío: ${formatCurrency(input.shipping)}`,
    `Total: ${formatCurrency(input.total)} ${input.currency}`
  );

  // Notes
  if (input.notes && input.notes.trim().length > 0) {
    lines.push("", `Notas: ${input.notes.trim()}`);
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// wa.me URL
// ---------------------------------------------------------------------------

/**
 * Normalises a phone number for wa.me — strips everything but digits.
 * Returns null when no usable number remains, so callers can disable the CTA.
 */
export function normalizeWhatsAppNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

/**
 * Builds a https://wa.me/<number>?text=<message> link.
 * Returns null when the store has no WhatsApp number configured.
 */
export function buildWhatsAppUrl(
  phone: string | null | undefined,
  message: string
): string | null {
  const number = normalizeWhatsAppNumber(phone);
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
