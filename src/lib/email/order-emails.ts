/**
 * Order lifecycle emails — ElektrK
 *
 * High-level, best-effort senders called from the Orders afterChange hook (and
 * from server actions / cron). Each loads the order + settings itself so callers
 * pass only ids, and each swallows failures via sendEmailSafe.
 *
 * NOTE: relative-import / alias-free — reachable from the Orders collection
 * import chain. Does NOT use the @/-aliased order mapper; it reads the raw
 * Payload doc directly.
 */

import {
  buildOrderWhatsAppMessage,
  buildWhatsAppUrl,
  formatOrderNumber,
} from "../whatsapp/order-message";
import { formatPaymentLines, paymentDetailsFrom } from "../payments/format";
import { sendEmailSafe, SERVER_URL } from "./send";
import {
  adminNewOrderEmail,
  cancelledEmail,
  fulfilledEmail,
  orderReceivedEmail,
  paymentConfirmedEmail,
  proofRejectedEmail,
  type EmailContext,
  type EmailOrderItem,
} from "./templates";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPayload = any;

function num(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

interface LoadedContext {
  ctx: EmailContext;
  customerEmail: string | null;
  supportEmail: string | null;
  adminOrderUrl: string;
  paymentLines: string[];
}

/**
 * Loads an order + settings and assembles the shared email context. Returns
 * null when the order cannot be read.
 */
async function loadContext(
  payload: AnyPayload,
  orderId: string | number
): Promise<LoadedContext | null> {
  let order: Record<string, unknown> | null = null;
  let settings: Record<string, unknown> = {};
  try {
    order = await payload.findByID({
      collection: "orders",
      id: orderId,
      depth: 2, // populate items join + payment proof media
      overrideAccess: true,
    });
  } catch {
    return null;
  }
  if (!order) return null;

  try {
    settings = (await payload.findGlobal({
      slug: "settings",
      depth: 0,
      overrideAccess: true,
    })) as Record<string, unknown>;
  } catch {
    settings = {};
  }

  const store = (settings.store ?? {}) as Record<string, unknown>;
  const pricingSettings = (settings.pricing ?? {}) as Record<string, unknown>;
  const paymentSettings = (settings.payment ?? {}) as Record<string, unknown>;

  const customer = (order.customer ?? {}) as Record<string, unknown>;
  const shipping = (order.shipping ?? {}) as Record<string, unknown>;
  const pricing = (order.pricing ?? {}) as Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const itemDocs: any[] = Array.isArray((order.items as any)?.docs)
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (order.items as any).docs
    : [];

  const items: EmailOrderItem[] = itemDocs.map((it) => ({
    productName: str(it?.productNameSnapshot) ?? "Producto",
    variantLabel: str(it?.variantLabelSnapshot) ?? "",
    quantity: num(it?.quantity, 1),
    unitPrice: num(it?.unitPrice),
  }));

  const orderNumber =
    str(order.orderNumber) ?? formatOrderNumber(order.id as string | number);
  const customerName =
    str(customer.customerName) ?? str(shipping.name) ?? "Cliente";
  const customerEmail = str(customer.customerEmail);
  const storeName = str(store.storeName) ?? "La tienda";
  const supportEmail = str(store.supportEmail);
  const currency = str(pricingSettings.currency) ?? "MXN";

  const subtotal = num(pricing.subtotal);
  const shippingCost = num(pricing.shipping);
  const total = num(pricing.total) || subtotal + shippingCost;

  const paymentDetails = paymentDetailsFrom(paymentSettings);
  const paymentLines = formatPaymentLines(paymentDetails);

  // Pre-filled WhatsApp link (used by the order-received email).
  const whatsappUrl = buildWhatsAppUrl(
    str(store.whatsapp),
    buildOrderWhatsAppMessage({
      storeName,
      orderNumber,
      customerName,
      customerEmail: customerEmail ?? "",
      customerPhone: str(shipping.phone),
      shippingAddress: str(shipping.address) ?? "",
      shippingCity: str(shipping.city) ?? "",
      shippingState: str(shipping.state) ?? "",
      shippingPostalCode: str(shipping.postalCode) ?? "",
      items,
      subtotal,
      shipping: shippingCost,
      total,
      currency,
      notes: str(order.notes),
      payment: paymentDetails,
    })
  );

  const ctx: EmailContext = {
    storeName,
    supportEmail,
    orderNumber,
    customerName,
    items,
    subtotal,
    shipping: shippingCost,
    total,
    currency,
    orderUrl: `${SERVER_URL}/account/orders/${order.id}`,
    whatsappUrl,
    paymentLines,
  };

  return {
    ctx,
    customerEmail,
    supportEmail,
    adminOrderUrl: `${SERVER_URL}/admin/collections/orders/${order.id}`,
    paymentLines,
  };
}

/**
 * On order creation: confirmation to the customer + notification to the admin.
 */
export async function sendOrderCreatedEmails(
  payload: AnyPayload,
  orderId: string | number
): Promise<void> {
  const loaded = await loadContext(payload, orderId);
  if (!loaded) return;

  const customer = orderReceivedEmail(loaded.ctx);
  await sendEmailSafe({
    payload,
    to: loaded.customerEmail,
    subject: customer.subject,
    html: customer.html,
  });

  if (loaded.supportEmail) {
    const admin = adminNewOrderEmail({
      ...loaded.ctx,
      // Admin mail links to the Payload admin, not the storefront order page.
      orderUrl: loaded.adminOrderUrl,
    });
    await sendEmailSafe({
      payload,
      to: loaded.supportEmail,
      subject: admin.subject,
      html: admin.html,
    });
  }
}

/**
 * On a status transition into paid / fulfilled / cancelled: notify the customer.
 * No-op for other statuses.
 */
export async function sendOrderStatusEmail(
  payload: AnyPayload,
  orderId: string | number,
  status: string
): Promise<void> {
  if (status !== "paid" && status !== "fulfilled" && status !== "cancelled") {
    return;
  }
  const loaded = await loadContext(payload, orderId);
  if (!loaded) return;

  const email =
    status === "paid"
      ? paymentConfirmedEmail(loaded.ctx)
      : status === "fulfilled"
        ? fulfilledEmail(loaded.ctx)
        : cancelledEmail(loaded.ctx);

  await sendEmailSafe({
    payload,
    to: loaded.customerEmail,
    subject: email.subject,
    html: email.html,
  });
}

/**
 * When an admin rejects a payment proof: ask the customer for another one.
 */
export async function sendProofRejectedEmail(
  payload: AnyPayload,
  orderId: string | number,
  reason: string | null
): Promise<void> {
  const loaded = await loadContext(payload, orderId);
  if (!loaded) return;
  const email = proofRejectedEmail(loaded.ctx, reason);
  await sendEmailSafe({
    payload,
    to: loaded.customerEmail,
    subject: email.subject,
    html: email.html,
  });
}
