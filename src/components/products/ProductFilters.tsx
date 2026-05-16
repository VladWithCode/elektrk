"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FilterState } from "@/types/product";
import type { ProductFilterOptions } from "@/lib/repositories/products";
import { cn } from "@/lib/utils";

interface ProductFiltersProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  filterOptions: ProductFilterOptions;
  totalCount: number;
  filteredCount: number;
  className?: string;
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-transparent text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}

function toggleValue<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
}

export function ProductFilters({
  filters,
  onChange,
  filterOptions,
  totalCount,
  filteredCount,
  className,
}: ProductFiltersProps) {
  const activeFilterCount =
    filters.amperage.length +
    filters.poles.length +
    filters.voltage.length +
    filters.tripCurve.length +
    filters.brand.length;

  const reset = () =>
    onChange({
      ...filters,
      amperage: [],
      poles: [],
      voltage: [],
      tripCurve: [],
      brand: [],
    });

  return (
    <aside className={cn("space-y-5", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filtros</span>
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="text-xs h-5 px-1.5">
              {activeFilterCount}
            </Badge>
          )}
        </div>
        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={reset}
            className="h-7 text-xs gap-1 text-muted-foreground"
          >
            <X className="h-3 w-3" />
            Limpiar
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {filteredCount} de {totalCount} productos
      </p>

      <Separator />

      {/* Sort */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-foreground uppercase tracking-wide">Ordenar</p>
        <Select
          value={filters.sortBy}
          onValueChange={(v) =>
            onChange({ ...filters, sortBy: v as FilterState["sortBy"] })
          }
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name_asc">Nombre A-Z</SelectItem>
            <SelectItem value="price_asc">Precio: menor a mayor</SelectItem>
            <SelectItem value="price_desc">Precio: mayor a menor</SelectItem>
            <SelectItem value="stock_desc">Mayor stock primero</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Brand */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-foreground uppercase tracking-wide">Marca</p>
        <div className="flex flex-wrap gap-1.5">
          {filterOptions.brands.map((brand) => (
            <FilterPill
              key={brand}
              label={brand}
              active={filters.brand.includes(brand)}
              onClick={() => onChange({ ...filters, brand: toggleValue(filters.brand, brand) })}
            />
          ))}
        </div>
      </div>

      <Separator />

      {/* Amperage */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-foreground uppercase tracking-wide">Amperaje</p>
        <div className="flex flex-wrap gap-1.5">
          {filterOptions.amperages.map((amp) => (
            <FilterPill
              key={amp}
              label={`${amp}A`}
              active={filters.amperage.includes(amp)}
              onClick={() => onChange({ ...filters, amperage: toggleValue(filters.amperage, amp) })}
            />
          ))}
        </div>
      </div>

      <Separator />

      {/* Poles */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-foreground uppercase tracking-wide">Polos</p>
        <div className="flex flex-wrap gap-1.5">
          {filterOptions.poles.map((p) => (
            <FilterPill
              key={p}
              label={`${p}P`}
              active={filters.poles.includes(p)}
              onClick={() => onChange({ ...filters, poles: toggleValue(filters.poles, p) })}
            />
          ))}
        </div>
      </div>

      <Separator />

      {/* Voltage */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-foreground uppercase tracking-wide">Voltaje</p>
        <div className="flex flex-wrap gap-1.5">
          {filterOptions.voltages.map((v) => (
            <FilterPill
              key={v}
              label={`${v}V`}
              active={filters.voltage.includes(v)}
              onClick={() => onChange({ ...filters, voltage: toggleValue(filters.voltage, v) })}
            />
          ))}
        </div>
      </div>

      <Separator />

      {/* Trip Curve */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-foreground uppercase tracking-wide">Curva de disparo</p>
        <div className="flex flex-wrap gap-1.5">
          {filterOptions.tripCurves.map((curve) => (
            <FilterPill
              key={curve}
              label={`Curva ${curve}`}
              active={filters.tripCurve.includes(curve)}
              onClick={() => onChange({ ...filters, tripCurve: toggleValue(filters.tripCurve, curve) })}
            />
          ))}
        </div>
      </div>
    </aside>
  );
}
