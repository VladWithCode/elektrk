import Link from "next/link";
import {
  MessageCircle,
  ShoppingBag,
  Package,
  Clock,
  AlertCircle,
  LogIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Metadata } from "next";
import { getSessionSafe } from "@/lib/auth/helpers";
import { getOrderById } from "@/lib/repositories/orders";
import { getStoreSettings } from "@/lib/repositories/settings";
import {
  buildOrderWhatsAppMessage,
  buildWhatsAppUrl,
} from "@/lib/whatsapp/order-message";
import { paymentDetailsFrom } from "@/lib/payments/format";
import { verifyGuestOrderToken } from "@/lib/orders/guest-token";

export const metadata: Metadata = {
  title: "Orden recibida — D.E. MTY",
  robots: { index: false, follow: false },
};

interface Props {
  searchParams: Promise<{ orderId?: string; t?: string }>;
}

export default async function CheckoutSuccessPage({ searchParams }: Props) {
  const { orderId, t } = await searchParams;

  // Order ids are enumerable serial integers, so the order (and its embedded
  // PII + pre-filled WhatsApp message) must never render to anyone but its
  // owner. Fetch the session + order together, then gate on ownership.
  // Guest orders (no customerAuthId) are gated by the signed token issued at
  // checkout instead of a session.
  const [session, order, settings] = await Promise.all([
    getSessionSafe(),
    orderId ? getOrderById(orderId) : Promise.resolve(null),
    getStoreSettings(),
  ]);

  const isOwner = Boolean(
    order &&
      ((session?.user?.id && order.customerAuthId === session.user.id) ||
        (!order.customerAuthId &&
          orderId &&
          verifyGuestOrderToken(orderId, t)))
  );

  // Non-owner / logged-out / missing order → generic confirmation only. No
  // order number, no customer data, no wa.me message.
  if (!order || !isOwner) {
    const loginCallback = orderId
      ? `/account/orders/${orderId}`
      : "/account/orders";
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-6 py-16">
          <div className="flex justify-center">
            <div className="rounded-full p-5 bg-green-100 dark:bg-green-900/30">
              <Clock className="h-14 w-14 text-green-600 dark:text-green-400" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">
              ¡Orden recibida!
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Registramos tu orden. Inicia sesión para ver los detalles y
              enviarla por WhatsApp y así coordinar el pago y la entrega.
            </p>
          </div>

          <Button asChild size="lg" className="w-full gap-2">
            <Link href={`/login?callbackUrl=${encodeURIComponent(loginCallback)}`}>
              <LogIn className="h-5 w-5" />
              Iniciar sesión para ver mi orden
            </Link>
          </Button>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button asChild variant="outline" size="lg" className="gap-2">
              <Link href="/account/orders">
                <Package className="h-4 w-4" />
                Mis órdenes
              </Link>
            </Button>
            <Button asChild variant="ghost" size="lg" className="gap-2">
              <Link href="/products">
                <ShoppingBag className="h-4 w-4" />
                Seguir comprando
              </Link>
            </Button>
          </div>

          <p className="text-xs text-muted-foreground pt-2">
            ¿Tienes dudas?{" "}
            <Link
              href="/support"
              className="underline underline-offset-4 hover:text-foreground transition-colors"
            >
              Contáctanos
            </Link>
          </p>
        </div>
      </main>
    );
  }

  // Owner branch — safe to render order details + the pre-filled WhatsApp link.
  const orderNumber = order.orderNumber;
  const whatsappUrl = buildWhatsAppUrl(
    settings.whatsapp,
    buildOrderWhatsAppMessage({
      storeName: settings.storeName,
      orderNumber: order.orderNumber,
      customerName: order.shippingAddress?.name || "Cliente",
      customerEmail: order.customerEmail,
      customerPhone: order.shippingAddress?.phone ?? null,
      shippingAddress: order.shippingAddress?.address ?? "",
      shippingCity: order.shippingAddress?.city ?? "",
      shippingState: order.shippingAddress?.state ?? "",
      shippingPostalCode: order.shippingAddress?.postalCode ?? "",
      items: order.items.map((item) => ({
        productName: item.productName,
        variantLabel: item.variantLabel,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      subtotal: order.subtotal,
      shipping: order.shipping,
      total: order.total,
      currency: settings.currency,
      notes: order.notes,
      payment: paymentDetailsFrom(settings.payment),
    })
  );

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6 py-16">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="rounded-full p-5 bg-green-100 dark:bg-green-900/30">
            <Clock className="h-14 w-14 text-green-600 dark:text-green-400" />
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">¡Orden recibida!</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Tu orden quedó registrada. Envíala por WhatsApp para que coordinemos
            el pago (transferencia o en tienda) y la entrega.
          </p>
        </div>

        {/* Order number chip */}
        <div className="rounded-lg border border-border bg-muted/40 px-5 py-3 text-sm font-mono">
          <span className="text-xs uppercase tracking-wide text-muted-foreground block mb-1">
            Número de orden
          </span>
          <span className="text-card-foreground font-semibold break-all">
            {orderNumber}
          </span>
        </div>

        {/* WhatsApp CTA */}
        {whatsappUrl ? (
          <Button
            asChild
            size="lg"
            className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
          >
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-5 w-5" />
              Enviar pedido por WhatsApp
            </a>
          </Button>
        ) : (
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-left text-amber-800 dark:text-amber-300">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              No fue posible generar el enlace de WhatsApp. Contáctanos
              {settings.supportEmail ? (
                <>
                  {" "}en{" "}
                  <a className="underline" href={`mailto:${settings.supportEmail}`}>
                    {settings.supportEmail}
                  </a>
                </>
              ) : null}{" "}
              e indícanos tu número de orden ({orderNumber}).
            </span>
          </div>
        )}

        {/* Info box */}
        <div className="rounded-lg border px-5 py-4 text-sm text-left space-y-1 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300">
          <p className="font-medium">¿Qué sigue?</p>
          <ul className="list-disc list-inside space-y-0.5 text-green-700 dark:text-green-400">
            <li>Envía tu pedido por WhatsApp con el botón de arriba.</li>
            <li>Te indicaremos cómo realizar el pago y te pediremos el comprobante.</li>
            <li>Al confirmar el pago, preparamos tu pedido y coordinamos la entrega.</li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          {session?.user ? (
            <Button asChild variant="outline" size="lg" className="gap-2">
              <Link href={`/account/orders/${order.id}`}>
                <Package className="h-4 w-4" />
                Ver mi orden
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="ghost" size="lg" className="gap-2">
            <Link href="/products">
              <ShoppingBag className="h-4 w-4" />
              Seguir comprando
            </Link>
          </Button>
        </div>

        <p className="text-xs text-muted-foreground pt-2">
          ¿Tienes dudas?{" "}
          <Link
            href="/support"
            className="underline underline-offset-4 hover:text-foreground transition-colors"
          >
            Contáctanos
          </Link>
        </p>
      </div>
    </main>
  );
}
