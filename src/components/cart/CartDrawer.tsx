"use client";

import Link from "next/link";
import { ShoppingCart, Trash2, Truck } from "lucide-react";
import { useCart } from "@/context/CartContext";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PriceDisplay } from "@/components/shared/PriceDisplay";
import { EmptyState } from "@/components/shared/EmptyState";
import { QuantityStepper } from "@/components/shared/QuantityStepper";
import { MOCK_SETTINGS } from "@/data/mock-settings";
import { formatCurrency } from "@/lib/currency";

interface CartDrawerProps {
  /** Flat shipping rate in MXN. Falls back to MOCK_SETTINGS default when omitted. */
  shippingRate?: number;
  /** Whether prices are published with VAT included. */
  taxIncluded?: boolean;
}

export function CartDrawer({
  shippingRate = MOCK_SETTINGS.flatShippingRate,
  taxIncluded = MOCK_SETTINGS.taxIncludedByDefault,
}: CartDrawerProps) {
  const { items, isOpen, closeDrawer, removeItem, updateQty, subtotal } =
    useCart();

  const shipping = shippingRate;
  const total = subtotal + shipping;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeDrawer()}>
      <SheetContent className="flex flex-col w-full sm:max-w-md">
        <SheetHeader className="pb-2">
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Carrito
            {items.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                ({items.length} {items.length === 1 ? "producto" : "productos"})
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="Tu carrito está vacío"
            description="Agrega productos desde el catálogo."
            action={
              <Button asChild onClick={closeDrawer}>
                <Link href="/products">Ver catálogo</Link>
              </Button>
            }
          />
        ) : (
          <>
            {/* Items */}
            <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-4 py-2">
              {items.map((item) => (
                <div key={item.variantSku} className="flex gap-3">
                  {/* Placeholder image */}
                  <div className="w-14 h-14 shrink-0 rounded-lg bg-muted flex items-center justify-center">
                    <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {item.productName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.brand} · {item.variantLabel}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <QuantityStepper
                        size="sm"
                        value={item.quantity}
                        max={item.stock}
                        onChange={(qty) => updateQty(item.variantSku, qty)}
                      />

                      <div className="flex items-center gap-2">
                        <PriceDisplay
                          price={item.price * item.quantity}
                          size="sm"
                        />
                        <button
                          onClick={() => removeItem(item.variantSku)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                          aria-label={`Eliminar ${item.productName}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Separator />

            {/* Summary */}
            <div className="space-y-3 pt-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm items-center">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Truck className="h-3.5 w-3.5" />
                  Envío
                </span>
                <span className="font-medium">{formatCurrency(shipping)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                {taxIncluded ? "IVA incluido" : "IVA no incluido"}
              </p>

              <Button className="w-full" size="lg" asChild>
                <Link href="/cart" onClick={closeDrawer}>
                  Ver carrito y comprar
                </Link>
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={closeDrawer}
              >
                Seguir comprando
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
