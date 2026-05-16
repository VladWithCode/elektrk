import Link from "next/link";
import { XCircle, ShoppingCart, ShoppingBag, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pago cancelado — ElektrK",
  robots: { index: false, follow: false },
};

interface Props {
  searchParams: Promise<{ orderId?: string }>;
}

export default async function CheckoutCancelPage({ searchParams }: Props) {
  const { orderId } = await searchParams;

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6 py-16">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="rounded-full bg-red-100 dark:bg-red-900/30 p-5">
            <XCircle className="h-14 w-14 text-red-500 dark:text-red-400" />
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">
            Pago cancelado
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Cerraste la ventana de pago o cancelaste la transacción.
            No se realizó ningún cargo. Tu orden quedó en estado{" "}
            <strong>Pendiente</strong> y el equipo la cerrará automáticamente.
          </p>
        </div>

        {/* Order ID if available */}
        {orderId && (
          <div className="rounded-lg border border-border bg-muted/40 px-5 py-3 text-sm font-mono">
            <span className="text-xs uppercase tracking-wide text-muted-foreground block mb-1">
              Número de orden
            </span>
            <span className="text-card-foreground font-semibold break-all">{orderId}</span>
            <span className="block mt-1 text-xs font-sans text-amber-600 dark:text-amber-400">
              Esta orden quedó cancelada.
            </span>
          </div>
        )}

        {/* Info box */}
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-5 py-4 text-sm text-amber-800 dark:text-amber-300 text-left">
          <p className="font-medium">No se hizo ningún cargo</p>
          <p className="mt-1 text-amber-700 dark:text-amber-400">
            Si tuviste algún problema durante el pago, puedes iniciar una nueva
            compra desde el catálogo. Tu carrito no se modificó.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button asChild size="lg" className="gap-2">
            <Link href="/cart">
              <ShoppingCart className="h-4 w-4" />
              Volver al carrito
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="gap-2">
            <Link href="/products">
              <ShoppingBag className="h-4 w-4" />
              Seguir comprando
            </Link>
          </Button>
        </div>

        {orderId && (
          <Button asChild variant="ghost" size="sm" className="gap-2 text-muted-foreground">
            <Link href={`/account/orders/${orderId}`}>
              <Package className="h-3.5 w-3.5" />
              Ver detalle de la orden
            </Link>
          </Button>
        )}

        <p className="text-xs text-muted-foreground pt-2">
          ¿Necesitas ayuda?{" "}
          <Link
            href="/support"
            className="underline underline-offset-4 hover:text-foreground transition-colors"
          >
            Escríbenos
          </Link>
        </p>
      </div>
    </main>
  );
}
