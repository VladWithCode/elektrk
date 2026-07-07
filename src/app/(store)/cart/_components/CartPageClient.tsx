"use client";

import Link from "next/link";
import {
  Trash2,
  ShoppingCart,
  Truck,
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import { useMemo } from "react";
import { QuantityStepper } from "@/components/shared/QuantityStepper";
import { useCart } from "@/context/CartContext";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PriceDisplay } from "@/components/shared/PriceDisplay";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { TAX_INCLUDED_LABEL } from "@/data/mock-products";
import { MOCK_SETTINGS } from "@/data/mock-settings";
import { formatCurrency } from "@/lib/currency";
import { validateCartStock } from "@/lib/pricing";

interface CartPageClientProps {
  shippingRate?: number;
  taxIncluded?: boolean;
}

export function CartPageClient({
  shippingRate = MOCK_SETTINGS.flatShippingRate,
  taxIncluded = MOCK_SETTINGS.taxIncludedByDefault,
}: CartPageClientProps) {
  const { items, subtotal, updateQty, removeItem, clear } = useCart();
  const shipping = shippingRate;
  const total = subtotal + shipping;

  // Stock warnings: check if any cart item quantity exceeds its stored stock snapshot.
  // This is a client-side guard using the snapshot from when the item was added.
  // The authoritative check happens server-side in submitCheckout().
  const stockErrors = useMemo(() => validateCartStock(items), [items]);
  const hasStockErrors = stockErrors.length > 0;

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
        <EmptyState
          icon={ShoppingCart}
          title="Tu carrito está vacío"
          description="Agrega productos desde el catálogo para continuar."
          action={
            <Button asChild>
              <Link href="/products">Ver catálogo</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="sm" asChild className="gap-2 -ml-2">
          <Link href="/products">
            <ArrowLeft className="h-4 w-4" />
            Seguir comprando
          </Link>
        </Button>
      </div>

      <SectionHeader
        title="Tu carrito"
        subtitle={`${items.length} ${items.length === 1 ? "producto" : "productos"}`}
        action={
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive gap-2"
            onClick={clear}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Vaciar carrito
          </Button>
        }
        className="mb-6"
      />

      {/* Stock warning banner — shown when cart snapshot detects qty > available stock */}
      {hasStockErrors && (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3 space-y-1"
        >
          <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400 mb-1">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            Cantidad superior al stock disponible
          </div>
          {stockErrors.map((err) => (
            <p key={err.sku ?? err.type} className="text-xs text-amber-700/80 dark:text-amber-400/80 pl-6">
              {err.message}
            </p>
          ))}
          <p className="text-xs text-amber-700/60 dark:text-amber-400/60 pl-6 pt-1">
            Reduce la cantidad o elimina los artículos afectados para continuar.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Items */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => {
            const itemStockError = stockErrors.find((e) => e.sku === item.variantSku);
            return (
            <div
              key={item.variantSku}
              className={`flex gap-4 p-4 rounded-xl border bg-card ${
                itemStockError
                  ? "border-amber-500/50 bg-amber-500/5"
                  : "border-border"
              }`}
            >
              {/* Placeholder image */}
              <div className="w-20 h-20 shrink-0 rounded-lg bg-muted flex items-center justify-center">
                <ShoppingCart className="h-6 w-6 text-muted-foreground" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link
                      href={`/products/${item.productSlug}`}
                      className="text-sm font-semibold text-card-foreground hover:text-primary transition-colors line-clamp-2"
                    >
                      {item.productName}
                    </Link>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.brand} · {item.variantLabel} ·{" "}
                      <span className="font-mono">{item.variantSku}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => removeItem(item.variantSku)}
                    className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                    aria-label={`Eliminar ${item.productName}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between mt-3">
                  <QuantityStepper
                    value={item.quantity}
                    max={item.stock}
                    onChange={(qty) => updateQty(item.variantSku, qty)}
                  />

                  <PriceDisplay
                    price={item.price * item.quantity}
                    size="md"
                    showTaxLabel
                  />
                </div>

                {/* Per-item stock warning */}
                {itemStockError && (
                  <p className="mt-2 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
                    {itemStockError.message}
                  </p>
                )}
              </div>
            </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          <div className="sticky top-20 rounded-xl border border-border bg-card p-6 space-y-4">
            <h2 className="font-semibold text-card-foreground">
              Resumen de compra
            </h2>
            <Separator />

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Truck className="h-3.5 w-3.5" />
                  Envío (tarifa plana)
                </span>
                <span className="font-medium">
                  {formatCurrency(shipping)}
                </span>
              </div>
            </div>

            <Separator />

            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span className="text-lg">{formatCurrency(total)}</span>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              {taxIncluded ? TAX_INCLUDED_LABEL : "IVA no incluido"}
            </p>

            <Button
              className="w-full gap-2"
              size="lg"
              disabled={hasStockErrors}
              asChild={!hasStockErrors}
            >
              {hasStockErrors ? (
                <>
                  Continuar al pago
                  <ArrowRight className="h-4 w-4" />
                </>
              ) : (
                <Link href="/checkout">
                  Continuar al pago
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </Button>
            {hasStockErrors && (
              <p className="text-xs text-center text-amber-700 dark:text-amber-400">
                Corrige los problemas de stock para continuar.
              </p>
            )}
            <p className="text-xs text-center text-muted-foreground">
              Coordina el pago por WhatsApp
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
