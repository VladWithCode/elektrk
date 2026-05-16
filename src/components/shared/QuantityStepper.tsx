"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuantityStepperProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (next: number) => void;
  size?: "sm" | "md";
  className?: string;
}

export function QuantityStepper({
  value,
  min = 1,
  max,
  onChange,
  size = "md",
  className,
}: QuantityStepperProps) {
  const btn = size === "sm" ? "h-6 w-6" : "h-8 w-8";
  const num = size === "sm" ? "w-6 text-xs" : "w-8 text-sm";
  const icon = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";

  return (
    <div
      className={cn(
        "flex items-center border border-border rounded-lg overflow-hidden",
        className
      )}
    >
      <button
        className={cn(
          btn,
          "flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40"
        )}
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        aria-label="Reducir cantidad"
      >
        <Minus className={icon} />
      </button>
      <span className={cn(num, "text-center font-medium tabular-nums")}>
        {value}
      </span>
      <button
        className={cn(
          btn,
          "flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40"
        )}
        onClick={() => onChange(value + 1)}
        disabled={max !== undefined && value >= max}
        aria-label="Aumentar cantidad"
      >
        <Plus className={icon} />
      </button>
    </div>
  );
}
