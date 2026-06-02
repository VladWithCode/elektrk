import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Package, ArrowLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatCurrency } from "@/lib/currency";
import { getSessionSafe } from "@/lib/auth/helpers";
import { getOrderSummariesByCustomer } from "@/lib/repositories/orders";
import { ORDER_STATUS_BADGE_VARIANT, ORDER_STATUS_LABELS } from "@/types/order";

export const metadata: Metadata = {
  title: "Mis órdenes — D.E. MTY",
  robots: { index: false, follow: false },
};

export default async function OrdersPage() {
  const session = await getSessionSafe();

  // Auth gate — redirect to login if not authenticated
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/account/orders");
  }

  const orders = await getOrderSummariesByCustomer(session.user.id);

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Link
          href="/account"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Mi cuenta
        </Link>
        <SectionHeader
          title="Mis órdenes"
          subtitle={`${orders.length} ${orders.length === 1 ? "orden" : "órdenes"} en total`}
        />
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Sin órdenes"
          description="Cuando realices tu primera compra, aparecerá aquí."
          action={
            <Link
              href="/products"
              className="inline-flex items-center gap-2 text-sm font-medium underline underline-offset-4 hover:text-muted-foreground transition-colors"
            >
              Ver catálogo
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/account/orders/${order.id}`}
              className="flex items-center justify-between p-5 rounded-xl border border-border bg-card gap-4 hover:bg-accent/30 transition-colors group"
            >
              <div className="flex items-center gap-4 min-w-0">
                <Package className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-card-foreground truncate">{order.id}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {order.displayDate} · {order.itemCount}{" "}
                    {order.itemCount === 1 ? "producto" : "productos"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Badge variant={ORDER_STATUS_BADGE_VARIANT[order.status] ?? "outline"}>
                  {ORDER_STATUS_LABELS[order.status]}
                </Badge>
                <span className="text-sm font-semibold text-card-foreground">
                  {formatCurrency(order.total)}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
