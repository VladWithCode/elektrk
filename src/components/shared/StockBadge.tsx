import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StockBadgeProps {
  stock: number;
  className?: string;
}

export function StockBadge({ stock, className }: StockBadgeProps) {
  if (stock === 0) {
    return (
      <Badge variant="destructive" className={cn("text-xs", className)}>
        Sin stock
      </Badge>
    );
  }
  if (stock <= 5) {
    return (
      <Badge variant="outline" className={cn("text-xs border-yellow-500 text-yellow-600 dark:text-yellow-400", className)}>
        Últimas {stock} unidades
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={cn("text-xs border-green-500 text-green-600 dark:text-green-400", className)}>
      En stock · {stock} uds.
    </Badge>
  );
}
