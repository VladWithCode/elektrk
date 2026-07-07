/**
 * Order email templates — ElektrK
 *
 * Plain, inline-styled HTML (email clients ignore <style>/external CSS). All
 * copy in Spanish. Pure functions: given a context, return { subject, html }.
 *
 * NOTE: relative-import / alias-free — reachable from the Orders collection
 * import chain.
 */

import { formatCurrency } from "../currency";

export interface EmailOrderItem {
  productName: string;
  variantLabel: string;
  quantity: number;
  unitPrice: number;
}

export interface EmailContext {
  storeName: string;
  supportEmail?: string | null;
  orderNumber: string;
  customerName: string;
  items: EmailOrderItem[];
  subtotal: number;
  shipping: number;
  total: number;
  currency: string;
  /** Link back to the customer's order (or the admin order page for admin mail). */
  orderUrl: string;
  /** Pre-filled wa.me link (order-received email only). */
  whatsappUrl?: string | null;
  /** Payment block lines (Datos de pago). */
  paymentLines?: string[];
}

export interface RenderedEmail {
  subject: string;
  html: string;
}

// ---------------------------------------------------------------------------
// Layout primitives
// ---------------------------------------------------------------------------

const COLORS = {
  text: "#1f2937",
  muted: "#6b7280",
  border: "#e5e7eb",
  bg: "#f9fafb",
  brand: "#16a34a",
};

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function layout(opts: {
  storeName: string;
  heading: string;
  intro: string;
  bodyHtml: string;
  supportEmail?: string | null;
}): string {
  const support = opts.supportEmail
    ? `<p style="margin:24px 0 0;font-size:12px;color:${COLORS.muted}">
         ¿Dudas? Escríbenos a
         <a href="mailto:${esc(opts.supportEmail)}" style="color:${COLORS.brand}">${esc(
           opts.supportEmail
         )}</a>.
       </p>`
    : "";
  return `<!doctype html>
<html lang="es"><body style="margin:0;padding:0;background:${COLORS.bg}">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${COLORS.text}">
    <div style="background:#ffffff;border:1px solid ${COLORS.border};border-radius:12px;padding:28px 24px">
      <p style="margin:0 0 4px;font-size:13px;color:${COLORS.muted}">${esc(opts.storeName)}</p>
      <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3">${esc(opts.heading)}</h1>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:${COLORS.text}">${esc(
        opts.intro
      )}</p>
      ${opts.bodyHtml}
      ${support}
    </div>
    <p style="margin:16px 0 0;text-align:center;font-size:11px;color:${COLORS.muted}">
      Este correo se envió automáticamente. No es necesario responder.
    </p>
  </div>
</body></html>`;
}

function itemsTable(items: EmailOrderItem[]): string {
  if (items.length === 0) return "";
  const rows = items
    .map(
      (i) => `<tr>
        <td style="padding:6px 0;font-size:13px;border-bottom:1px solid ${COLORS.border}">
          ${esc(i.productName)}${i.variantLabel ? ` — ${esc(i.variantLabel)}` : ""}
          <span style="color:${COLORS.muted}"> ×${i.quantity}</span>
        </td>
        <td style="padding:6px 0;font-size:13px;text-align:right;border-bottom:1px solid ${COLORS.border}">
          ${esc(formatCurrency(i.unitPrice * i.quantity))}
        </td>
      </tr>`
    )
    .join("");
  return `<table style="width:100%;border-collapse:collapse;margin:0 0 8px">${rows}</table>`;
}

function totalsBlock(ctx: EmailContext): string {
  const row = (label: string, value: string, strong = false) =>
    `<tr>
      <td style="padding:2px 0;font-size:13px;color:${strong ? COLORS.text : COLORS.muted};${
        strong ? "font-weight:600" : ""
      }">${esc(label)}</td>
      <td style="padding:2px 0;font-size:13px;text-align:right;${
        strong ? "font-weight:600" : `color:${COLORS.muted}`
      }">${esc(value)}</td>
    </tr>`;
  return `<table style="width:100%;border-collapse:collapse;margin:0 0 8px">
    ${row("Subtotal", formatCurrency(ctx.subtotal))}
    ${row("Envío", formatCurrency(ctx.shipping))}
    ${row("Total", `${formatCurrency(ctx.total)} ${ctx.currency}`, true)}
  </table>`;
}

function orderBox(ctx: EmailContext): string {
  return `<div style="background:${COLORS.bg};border:1px solid ${COLORS.border};border-radius:8px;padding:16px;margin:0 0 16px">
    <p style="margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:${COLORS.muted}">
      Orden ${esc(ctx.orderNumber)}
    </p>
    ${itemsTable(ctx.items)}
    ${totalsBlock(ctx)}
  </div>`;
}

function paymentBox(lines?: string[]): string {
  if (!lines || lines.length === 0) return "";
  const body = lines.map((l) => `<div style="margin:2px 0">${esc(l)}</div>`).join("");
  return `<div style="border:1px solid ${COLORS.border};border-radius:8px;padding:16px;margin:0 0 16px">
    <p style="margin:0 0 8px;font-size:13px;font-weight:600">Datos de pago</p>
    <div style="font-size:13px;line-height:1.5;color:${COLORS.text}">${body}</div>
  </div>`;
}

function button(url: string, label: string): string {
  return `<a href="${esc(url)}" style="display:inline-block;background:${COLORS.brand};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 20px;border-radius:8px">${esc(
    label
  )}</a>`;
}

function viewOrderLink(url: string): string {
  return `<p style="margin:16px 0 0;font-size:13px">
    ${button(url, "Ver mi orden")}
  </p>`;
}

// ---------------------------------------------------------------------------
// Customer templates
// ---------------------------------------------------------------------------

export function orderReceivedEmail(ctx: EmailContext): RenderedEmail {
  const wa = ctx.whatsappUrl
    ? `<p style="margin:0 0 16px;font-size:13px">
         ${button(ctx.whatsappUrl, "Enviar pedido por WhatsApp")}
       </p>`
    : "";
  return {
    subject: `Recibimos tu orden ${ctx.orderNumber}`,
    html: layout({
      storeName: ctx.storeName,
      supportEmail: ctx.supportEmail,
      heading: "¡Recibimos tu orden!",
      intro: `Hola ${ctx.customerName}, registramos tu orden ${ctx.orderNumber}. Envíala por WhatsApp para coordinar el pago y la entrega.`,
      bodyHtml: orderBox(ctx) + wa + paymentBox(ctx.paymentLines) + viewOrderLink(ctx.orderUrl),
    }),
  };
}

export function paymentConfirmedEmail(ctx: EmailContext): RenderedEmail {
  return {
    subject: `Pago confirmado — orden ${ctx.orderNumber}`,
    html: layout({
      storeName: ctx.storeName,
      supportEmail: ctx.supportEmail,
      heading: "Pago confirmado",
      intro: `Hola ${ctx.customerName}, confirmamos el pago de tu orden ${ctx.orderNumber}. Estamos preparando tu pedido.`,
      bodyHtml: orderBox(ctx) + viewOrderLink(ctx.orderUrl),
    }),
  };
}

export function fulfilledEmail(ctx: EmailContext): RenderedEmail {
  return {
    subject: `Tu pedido va en camino — orden ${ctx.orderNumber}`,
    html: layout({
      storeName: ctx.storeName,
      supportEmail: ctx.supportEmail,
      heading: "Tu pedido está listo",
      intro: `Hola ${ctx.customerName}, tu orden ${ctx.orderNumber} fue enviada / está lista para entrega.`,
      bodyHtml: orderBox(ctx) + viewOrderLink(ctx.orderUrl),
    }),
  };
}

export function cancelledEmail(ctx: EmailContext): RenderedEmail {
  return {
    subject: `Tu orden ${ctx.orderNumber} fue cancelada`,
    html: layout({
      storeName: ctx.storeName,
      supportEmail: ctx.supportEmail,
      heading: "Orden cancelada",
      intro: `Hola ${ctx.customerName}, tu orden ${ctx.orderNumber} fue cancelada. Si crees que se trata de un error, contáctanos.`,
      bodyHtml: orderBox(ctx) + viewOrderLink(ctx.orderUrl),
    }),
  };
}

export function proofRejectedEmail(ctx: EmailContext, reason: string | null): RenderedEmail {
  const reasonHtml = reason
    ? `<div style="border-left:3px solid ${COLORS.border};padding:4px 0 4px 12px;margin:0 0 16px;font-size:13px;color:${COLORS.text}">
         <strong>Motivo:</strong> ${esc(reason)}
       </div>`
    : "";
  return {
    subject: `Necesitamos otro comprobante — orden ${ctx.orderNumber}`,
    html: layout({
      storeName: ctx.storeName,
      supportEmail: ctx.supportEmail,
      heading: "Necesitamos otro comprobante",
      intro: `Hola ${ctx.customerName}, no pudimos validar el comprobante de tu orden ${ctx.orderNumber}. Súbelo de nuevo desde tu orden.`,
      bodyHtml: reasonHtml + paymentBox(ctx.paymentLines) + viewOrderLink(ctx.orderUrl),
    }),
  };
}

// ---------------------------------------------------------------------------
// Admin template
// ---------------------------------------------------------------------------

export function adminNewOrderEmail(ctx: EmailContext): RenderedEmail {
  return {
    subject: `Nueva orden ${ctx.orderNumber} — ${formatCurrency(ctx.total)}`,
    html: layout({
      storeName: ctx.storeName,
      heading: `Nueva orden ${ctx.orderNumber}`,
      intro: `${ctx.customerName} creó una orden por ${formatCurrency(ctx.total)} ${ctx.currency}.`,
      bodyHtml:
        orderBox(ctx) +
        `<p style="margin:16px 0 0;font-size:13px">${button(ctx.orderUrl, "Abrir en el panel")}</p>`,
    }),
  };
}
