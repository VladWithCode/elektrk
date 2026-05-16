"use client";

import Link from "next/link";
import Image from "next/image";
import { ShoppingCart, Zap } from "lucide-react";
import { motion } from "motion/react";
import type { Product } from "@/types/product";
import { useCart } from "@/context/CartContext";
import { PriceDisplay } from "@/components/shared/PriceDisplay";
import { StockBadge } from "@/components/shared/StockBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Returns true when the URL is a real image (not the placeholder fallback). */
function isRealImage(url: string | undefined): url is string {
  if (!url) return false;
  return !url.includes("placeholder");
}

interface ProductCardProps {
  product: Product;
  className?: string;
}

export function ProductCard({ product, className }: ProductCardProps) {
  const { addItem } = useCart();
  const defaultVariant = product.variants[0];

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!defaultVariant || defaultVariant.stock === 0) return;
    addItem({
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      brand: product.brand,
      variantSku: defaultVariant.sku,
      variantType: defaultVariant.type,
      variantLabel: defaultVariant.label,
      price: defaultVariant.price,
      quantity: 1,
      stock: defaultVariant.stock,
      image: product.images[0] ?? "",
    });
  };

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn(
        "group relative flex flex-col rounded-xl border border-border bg-card overflow-hidden transition-shadow hover:shadow-md",
        className
      )}
    >
      <Link href={`/products/${product.slug}`} className="flex flex-col flex-1">
        {/* Image area */}
        <div className="relative bg-muted aspect-square overflow-hidden">
          {product.featured && (
            <Badge className="absolute top-2 left-2 z-10 gap-1 text-[10px]">
              <Zap className="h-2.5 w-2.5" /> Destacado
            </Badge>
          )}
          {isRealImage(product.images[0]) ? (
            <Image
              src={product.images[0]}
              alt={`${product.brand} ${product.name}`}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-contain p-6 transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            /* Fallback visual — shown when no real image is available */
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-8">
              <div className="w-16 h-24 bg-primary/20 rounded-md border-2 border-primary/30 flex items-center justify-center">
                <Zap className="h-8 w-8 text-primary/60" />
              </div>
              <div className="flex gap-1">
                {Array.from({ length: product.poles }).map((_, i) => (
                  <div key={i} className="w-3 h-3 rounded-sm bg-primary/30" />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-col flex-1 gap-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {product.brand}
            </span>
            <StockBadge stock={product.stock} />
          </div>

          <h3 className="text-sm font-semibold text-card-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {product.name}
          </h3>

          {/* Specs pills */}
          <div className="flex flex-wrap gap-1 mt-auto pt-1">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
              {product.amperage}A
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
              {product.poles}P
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
              {product.voltage}V
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
              Curva {product.tripCurve}
            </span>
          </div>
        </div>
      </Link>

      {/* Footer with price and add button */}
      <div className="flex items-center justify-between gap-2 px-4 pb-4">
        {defaultVariant ? (
          <PriceDisplay price={defaultVariant.price} showTaxLabel />
        ) : (
          <span className="text-sm text-muted-foreground">Sin precio</span>
        )}
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 gap-1.5"
          onClick={handleQuickAdd}
          disabled={!defaultVariant || defaultVariant.stock === 0}
        >
          <ShoppingCart className="h-3.5 w-3.5" />
          Agregar
        </Button>
      </div>
    </motion.div>
  );
}
