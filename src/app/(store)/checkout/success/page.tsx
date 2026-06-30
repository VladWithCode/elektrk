import Link from "next/link";
import { MessageCircle, ShoppingBag, Package, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Metadata } from "next";
import { getOrderById } from "@/lib/repositories/orders";
import { getStoreSettings } from "@/lib/repositories/settings";
import {
  buildOrderWhatsAppMessage,
  buildWhatsAppUrl,
  formatOrderNumber,
} from "@/lib/whatsapp/order-message";

export const metadata: Metadata = {
  title: "Orden recibida — D.E. MTY",
  robots: { index: false, follow: false },
};

interface Props {
  searchParams: Promise<{ orderId?: string }>;
}

export default async function CheckoutSuccessPage({ searchParams }: Props) {
  const { orderId } = await searchParams;

  // Fetch the real order so we can rebuild the exact WhatsApp message + link.
  const [order, settings] = await Promise.all([
    orderId ? getOrderById(orderId) : Promise.resolve(null),
    getStoreSettings(),
  ]);

  // Prefer the stored order number; if the order wasn't found, derive it from
  // the id param so the displayed reference stays in the ORD-XXXXXX format.
  const orderNumber =
    order?.orderNumber || (orderId ? formatOrderNumber(orderId) : null);

  // Rebuild the pre-filled WhatsApp message from the persisted order.
  const whatsappUrl = order
    ? buildWhatsAppUrl(
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
        })
      )
    : null;

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
        {orderNumber && (
          <div className="rounded-lg border border-border bg-muted/40 px-5 py-3 text-sm font-mono">
            <span className="text-xs uppercase tracking-wide text-muted-foreground block mb-1">
              Número de orden
            </span>
            <span className="text-card-foreground font-semibold break-all">
              {orderNumber}
            </span>
          </div>
        )}

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
              e indícanos tu número de orden{orderNumber ? ` (${orderNumber})` : ""}.
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
          {orderId ? (
            <Button asChild variant="outline" size="lg" className="gap-2">
              <Link href={`/account/orders/${orderId}`}>
                <Package className="h-4 w-4" />
                Ver mi orden
              </Link>
            </Button>
          ) : (
            <Button asChild variant="outline" size="lg" className="gap-2">
              <Link href="/account/orders">
                <Package className="h-4 w-4" />
                Mis órdenes
              </Link>
            </Button>
          )}
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
