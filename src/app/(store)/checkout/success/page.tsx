import Link from "next/link";
import { CheckCircle, ShoppingBag, Package, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Metadata } from "next";
import { getOrderById } from "@/lib/repositories/orders";

export const metadata: Metadata = {
  title: "Orden confirmada — ElektrK",
  robots: { index: false, follow: false },
};

interface Props {
  searchParams: Promise<{ orderId?: string; session_id?: string }>;
}

export default async function CheckoutSuccessPage({ searchParams }: Props) {
  const { orderId } = await searchParams;

  // Try to fetch the real order to show live status
  const order = orderId ? await getOrderById(orderId) : null;
  const isPaid = order?.status === "paid";

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6 py-16">
        {/* Icon */}
        <div className="flex justify-center">
          <div className={`rounded-full p-5 ${isPaid ? "bg-green-100 dark:bg-green-900/30" : "bg-blue-100 dark:bg-blue-900/30"}`}>
            {isPaid ? (
              <CheckCircle className="h-14 w-14 text-green-600 dark:text-green-400" />
            ) : (
              <Clock className="h-14 w-14 text-blue-500 dark:text-blue-400" />
            )}
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">
            {isPaid ? "¡Pago confirmado!" : "¡Orden recibida!"}
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {isPaid
              ? "Tu pago fue procesado exitosamente. Pronto recibirás confirmación por correo."
              : "Tu orden fue creada. En cuanto Stripe confirme el pago, la verás actualizada en tu cuenta."}
          </p>
        </div>

        {/* Order ID chip */}
        {orderId && (
          <div className="rounded-lg border border-border bg-muted/40 px-5 py-3 text-sm font-mono">
            <span className="text-xs uppercase tracking-wide text-muted-foreground block mb-1">
              Número de orden
            </span>
            <span className="text-card-foreground font-semibold break-all">
              {orderId}
            </span>
            {order && (
              <span className={`block mt-1 text-xs font-sans font-medium ${
                isPaid ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"
              }`}>
                Estado: {isPaid ? "Pagado" : "Pendiente de pago"}
              </span>
            )}
          </div>
        )}

        {/* Info box */}
        <div className={`rounded-lg border px-5 py-4 text-sm text-left space-y-1 ${
          isPaid
            ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300"
            : "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300"
        }`}>
          <p className="font-medium">¿Qué sigue?</p>
          <ul className={`list-disc list-inside space-y-0.5 ${isPaid ? "text-green-700 dark:text-green-400" : "text-blue-700 dark:text-blue-400"}`}>
            {isPaid ? (
              <>
                <li>Recibirás confirmación por correo electrónico.</li>
                <li>Tu pedido se preparará en 1–2 días hábiles.</li>
                <li>El envío tarda entre 3–5 días hábiles adicionales.</li>
              </>
            ) : (
              <>
                <li>Tu orden está registrada con estado <strong>Pendiente</strong>.</li>
                <li>Stripe puede tardar unos segundos en confirmar el pago.</li>
                <li>Recarga la página de tu orden para ver el estado actualizado.</li>
              </>
            )}
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          {orderId ? (
            <Button asChild size="lg" className="gap-2">
              <Link href={`/account/orders/${orderId}`}>
                <Package className="h-4 w-4" />
                Ver mi orden
              </Link>
            </Button>
          ) : (
            <Button asChild size="lg" className="gap-2">
              <Link href="/account/orders">
                <Package className="h-4 w-4" />
                Mis órdenes
              </Link>
            </Button>
          )}
          <Button asChild variant="outline" size="lg" className="gap-2">
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
