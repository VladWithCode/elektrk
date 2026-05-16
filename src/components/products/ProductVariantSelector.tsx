"use client";

import { useState } from "react";
import { ShoppingCart, Minus, Plus } from "lucide-react";
import type { Product, ProductVariant } from "@/types/product";
import { useCart } from "@/context/CartContext";
import { PriceDisplay } from "@/components/shared/PriceDisplay";
import { StockBadge } from "@/components/shared/StockBadge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const VARIANT_LABELS: Record<string, string> = {
  piece: "Pieza",
  box: "Caja",
  lot: "Lote",
};

interface ProductVariantSelectorProps {
  product: Product;
}

export function ProductVariantSelector({ product }: ProductVariantSelectorProps) {
  const { addItem } = useCart();
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant>(
    product.variants[0]
  );
  const [qty, setQty] = useState(1);

  const handleAdd = () => {
    if (selectedVariant.stock === 0) return;
    addItem({
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      brand: product.brand,
      variantSku: selectedVariant.sku,
      variantType: selectedVariant.type,
      variantLabel: selectedVariant.label,
      price: selectedVariant.price,
      quantity: qty,
      stock: selectedVariant.stock,
      image: product.images[0] ?? "",
    });
    setQty(1);
  };

  return (
    <div className="space-y-5">
      {/* Variant selector */}
      {product.variants.length > 1 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Presentación</p>
          <div className="flex flex-wrap gap-2">
            {product.variants.map((variant) => (
              <button
                key={variant.sku}
                onClick={() => {
                  setSelectedVariant(variant);
                  setQty(1);
                }}
                className={cn(
                  "flex flex-col items-start px-4 py-3 rounded-lg border text-sm transition-colors",
                  selectedVariant.sku === variant.sku
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  variant.stock === 0 && "opacity-40 cursor-not-allowed"
                )}
                disabled={variant.stock === 0}
              >
                <span className="font-medium">
                  {VARIANT_LABELS[variant.type] ?? variant.label}
                </span>
                {variant.unitsPerPackage > 1 && (
                  <span className="text-xs text-muted-foreground">
                    × {variant.unitsPerPackage} uds.
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Price + stock */}
      <div className="flex items-center justify-between">
        <PriceDisplay price={selectedVariant.price} size="xl" showTaxLabel />
        <StockBadge stock={selectedVariant.stock} />
      </div>

      {/* Quantity + add to cart */}
      <div className="flex items-center gap-3">
        {/* Qty stepper */}
        <div className="flex items-center border border-border rounded-lg overflow-hidden">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-none border-r border-border"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            disabled={qty <= 1}
            aria-label="Reducir cantidad"
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <span
            className="w-10 text-center text-sm font-medium tabular-nums"
            aria-label={`Cantidad: ${qty}`}
            aria-live="polite"
          >
            {qty}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-none border-l border-border"
            onClick={() =>
              setQty((q) => Math.min(q + 1, selectedVariant.stock))
            }
            disabled={qty >= selectedVariant.stock}
            aria-label="Aumentar cantidad"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        <Button
          onClick={handleAdd}
          disabled={selectedVariant.stock === 0}
          className="flex-1 gap-2"
          size="lg"
        >
          <ShoppingCart className="h-4 w-4" />
          {selectedVariant.stock === 0 ? "Sin stock" : "Agregar al carrito"}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        SKU: <span className="font-mono">{selectedVariant.sku}</span>
      </p>
    </div>
  );
}
