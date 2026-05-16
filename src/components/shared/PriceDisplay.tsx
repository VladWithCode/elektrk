import { cn } from "@/lib/utils";

interface PriceDisplayProps {
  price: number;
  size?: "sm" | "md" | "lg" | "xl";
  showTaxLabel?: boolean;
  className?: string;
}

const FORMAT = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
});

const SIZE_CLASSES = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-xl font-semibold",
  xl: "text-3xl font-bold",
};

export function PriceDisplay({
  price,
  size = "md",
  showTaxLabel = false,
  className,
}: PriceDisplayProps) {
  return (
    <div className={cn("flex flex-col", className)}>
      <span className={cn("text-foreground font-semibold tabular-nums", SIZE_CLASSES[size])}>
        {FORMAT.format(price)}
      </span>
      {showTaxLabel && (
        <span className="text-xs text-muted-foreground">IVA incluido</span>
      )}
    </div>
  );
}
