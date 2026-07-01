import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Package, MapPin, Receipt, Landmark } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/currency";
import { getSessionSafe } from "@/lib/auth/helpers";
import { getOrderById } from "@/lib/repositories/orders";
import { getStoreSettings } from "@/lib/repositories/settings";
import { ORDER_STATUS_BADGE_VARIANT, ORDER_STATUS_LABELS } from "@/types/order";
import {
  formatOrderNumber,
  buildOrderWhatsAppMessage,
  buildWhatsAppUrl,
} from "@/lib/whatsapp/order-message";
import { paymentDetailsFrom, hasPaymentDetails } from "@/lib/payments/format";
import { OrderProofUpload } from "./_components/OrderProofUpload";
import { OrderTimeline } from "./_components/OrderTimeline";
import { OrderActionsBar } from "./_components/OrderActionsBar";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Orden ${formatOrderNumber(id)} — D.E. MTY`,
    robots: { index: false, follow: false },
  };
}

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params;

  // Auth gate
  const session = await getSessionSafe();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/account/orders/${id}`);
  }

  const [order, settings] = await Promise.all([
    getOrderById(id),
    getStoreSettings(),
  ]);

  // Not found or doesn't belong to this user → 404
  if (!order || order.customerAuthId !== session.user.id) {
    notFound();
  }

  const statusVariant = ORDER_STATUS_BADGE_VARIANT[order.status] ?? "outline";
  const statusLabel = ORDER_STATUS_LABELS[order.status];
  const isAwaitingPayment =
    order.status === "pending" || order.status === "payment_pending";
  const canUploadProof = isAwaitingPayment;

  const paymentDetails = paymentDetailsFrom(settings.payment);
  const showPaymentPanel = isAwaitingPayment && hasPaymentDetails(paymentDetails);

  // Rebuild the pre-filled WhatsApp message (owner only, while awaiting payment).
  const whatsappUrl = isAwaitingPayment
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
          payment: paymentDetails,
        })
      )
    : null;

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <Link
        href="/account/orders"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Mis órdenes
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight break-all">{order.orderNumber}</h1>
          <p className="text-sm text-muted-foreground mt-1">{order.displayDate}</p>
        </div>
        <Badge variant={statusVariant} className="text-sm px-3 py-1 shrink-0">
          {statusLabel}
        </Badge>
      </div>

      <div className="space-y-6">
        {/* Owner actions — resend WhatsApp + cancel (while awaiting payment) */}
        {isAwaitingPayment && (
          <OrderActionsBar
            orderId={String(order.id)}
            whatsappUrl={whatsappUrl}
            canCancel={isAwaitingPayment}
          />
        )}

        {/* How to pay */}
        {showPaymentPanel && (
          <section className="rounded-xl border border-border bg-card px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <Landmark className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Cómo pagar</h2>
            </div>
            <dl className="text-sm space-y-1.5">
              {paymentDetails.bankName && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Banco</dt>
                  <dd className="text-card-foreground text-right">{paymentDetails.bankName}</dd>
                </div>
              )}
              {paymentDetails.accountHolder && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Titular</dt>
                  <dd className="text-card-foreground text-right">{paymentDetails.accountHolder}</dd>
                </div>
              )}
              {paymentDetails.clabe && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">CLABE</dt>
                  <dd className="text-card-foreground text-right font-mono break-all">{paymentDetails.clabe}</dd>
                </div>
              )}
              {paymentDetails.accountNumber && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Cuenta</dt>
                  <dd className="text-card-foreground text-right font-mono break-all">{paymentDetails.accountNumber}</dd>
                </div>
              )}
            </dl>
            {paymentDetails.instructions && (
              <p className="text-sm text-muted-foreground whitespace-pre-line mt-3">
                {paymentDetails.instructions}
              </p>
            )}
          </section>
        )}

        {/* Line items */}
        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Productos</h2>
          </div>
          {order.items.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted-foreground">Sin artículos registrados.</p>
          ) : (
            <div className="divide-y divide-border">
              {order.items.map((item) => (
                <div key={item.id} className="px-5 py-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    {item.productSlug ? (
                      <Link
                        href={`/products/${item.productSlug}`}
                        className="text-sm font-medium text-card-foreground hover:underline"
                      >
                        {item.productName}
                      </Link>
                    ) : (
                      <p className="text-sm font-medium text-card-foreground">{item.productName}</p>
                    )}
                    {item.variantSku && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.variantLabel ? `${item.variantLabel} · ` : ""}SKU: {item.variantSku}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(item.unitPrice)} × {item.quantity}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-card-foreground shrink-0">
                    {formatCurrency(item.lineTotal)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Totals */}
        <section className="rounded-xl border border-border bg-card px-5 py-4 space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <Receipt className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Resumen</h2>
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Subtotal</span>
            <span>{formatCurrency(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Envío</span>
            <span>{formatCurrency(order.shipping)}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-sm font-semibold text-card-foreground pt-1">
            <span>Total</span>
            <span>{formatCurrency(order.total)}</span>
          </div>
          <p className="text-xs text-muted-foreground pt-1">IVA incluido en el precio.</p>
        </section>

        {/* Shipping address (populated if the order has one stored) */}
        {order.shippingAddress && (
          <section className="rounded-xl border border-border bg-card px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Dirección de envío</h2>
            </div>
            <address className="not-italic text-sm text-muted-foreground space-y-0.5">
              <p className="font-medium text-card-foreground">{order.shippingAddress.name}</p>
              <p>{order.shippingAddress.address}</p>
              <p>
                {order.shippingAddress.city}, {order.shippingAddress.state}{" "}
                {order.shippingAddress.postalCode}
              </p>
              {order.shippingAddress.phone && <p>{order.shippingAddress.phone}</p>}
            </address>
          </section>
        )}

        {/* Payment proofs */}
        <OrderProofUpload
          orderId={String(order.id)}
          proofs={order.paymentProofs}
          canUpload={canUploadProof}
        />

        {/* Status timeline */}
        <OrderTimeline entries={order.statusHistory} />

        {/* Admin notes (visible to customer as delivery notes) */}
        {order.notes && (
          <section className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-5 py-4">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-1">Nota</p>
            <p className="text-sm text-amber-700 dark:text-amber-400 whitespace-pre-line">{order.notes}</p>
          </section>
        )}

        {/* Support link */}
        <p className="text-sm text-muted-foreground text-center">
          ¿Tienes algún problema con esta orden?{" "}
          <Link href="/support/tickets" className="underline underline-offset-4 hover:text-foreground transition-colors">
            Abre un ticket de soporte
          </Link>
        </p>
      </div>
    </div>
  );
}
