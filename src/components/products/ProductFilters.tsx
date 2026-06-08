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
import type { FilterState, ProductCategory } from "@/types/product";
import { CATEGORY_LABELS } from "@/types/product";
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

// Keys of FilterState that are string[] / number[] facets we render generically.
type StringFacetKey =
  | "tripCurve"
  | "gauge"
  | "dimensions"
  | "channelType"
  | "finish"
  | "boardType"
  | "nemaRating"
  | "anchorType"
  | "supportType"
  | "accessoryType"
  | "dimDiameter"
  | "dimLength";
type NumberFacetKey = "amperage" | "poles" | "voltage" | "amperageCapacity";

// A single facet to render: which FilterState key, which options list, label.
interface FacetDef {
  key: StringFacetKey | NumberFacetKey;
  title: string;
  options: ReadonlyArray<string | number>;
  format?: (v: string | number) => string;
}

// Human labels for select-style coded values.
const CHANNEL_TYPE_LABELS: Record<string, string> = { solido: "Sólido", perforado: "Perforado" };

// Builds the facet list shown for the currently selected single category.
function facetsForCategory(
  category: ProductCategory | null,
  o: ProductFilterOptions
): FacetDef[] {
  switch (category) {
    case "interruptores":
      return [
        { key: "amperage", title: "Amperaje", options: o.amperages, format: (v) => `${v}A` },
        { key: "poles", title: "Polos", options: o.poles as number[], format: (v) => `${v}P` },
        { key: "voltage", title: "Voltaje", options: o.voltages, format: (v) => `${v}V` },
        { key: "tripCurve", title: "Curva de disparo", options: o.tripCurves, format: (v) => `Curva ${v}` },
      ];
    case "unicanal":
      return [
        { key: "gauge", title: "Calibre", options: o.gauges, format: (v) => `Cal. ${v}` },
        { key: "dimensions", title: "Medida", options: o.dimensions },
        { key: "channelType", title: "Tipo", options: o.channelTypes, format: (v) => CHANNEL_TYPE_LABELS[String(v)] ?? String(v) },
        { key: "finish", title: "Acabado", options: o.finishes },
      ];
    case "gabinetes_tableros":
      return [
        { key: "boardType", title: "Tipo de tablero", options: o.boardTypes },
        { key: "nemaRating", title: "NEMA", options: o.nemaRatings, format: (v) => `NEMA ${String(v).toUpperCase()}` },
        { key: "amperageCapacity", title: "Capacidad", options: o.amperageCapacities, format: (v) => `${v}A` },
      ];
    case "fijacion":
      return [
        { key: "anchorType", title: "Tipo de anclaje", options: o.anchorTypes },
        { key: "dimDiameter", title: "Diámetro", options: o.dimDiameters },
        { key: "dimLength", title: "Largo", options: o.dimLengths },
      ];
    case "soporteria":
      return [
        { key: "supportType", title: "Tipo de soporte", options: o.supportTypes },
        { key: "dimDiameter", title: "Diámetro", options: o.dimDiameters },
        { key: "dimLength", title: "Largo", options: o.dimLengths },
      ];
    case "herramientas_accesorios":
      return [
        { key: "accessoryType", title: "Tipo", options: o.accessoryTypes },
        { key: "dimDiameter", title: "Diámetro", options: o.dimDiameters },
        { key: "dimLength", title: "Largo", options: o.dimLengths },
      ];
    default:
      return [];
  }
}

// All facet keys that can hold a value — used to clear filters.
const ALL_FACET_KEYS: Array<StringFacetKey | NumberFacetKey | "brand" | "category"> = [
  "category", "brand",
  "amperage", "poles", "voltage", "tripCurve",
  "gauge", "dimensions", "channelType", "finish",
  "boardType", "nemaRating", "amperageCapacity",
  "anchorType", "supportType", "accessoryType", "dimDiameter", "dimLength",
];

export function ProductFilters({
  filters,
  onChange,
  filterOptions,
  totalCount,
  filteredCount,
  className,
}: ProductFiltersProps) {
  // The selected category drives which technical facets are shown.
  const selectedCategory: ProductCategory | null =
    filters.category.length === 1 ? filters.category[0] : null;

  const activeFilterCount = ALL_FACET_KEYS.reduce(
    (sum, key) => sum + (filters[key] as unknown[]).length,
    0
  );

  const facets = facetsForCategory(selectedCategory, filterOptions);

  const reset = () => {
    const cleared = { ...filters };
    for (const key of ALL_FACET_KEYS) {
      (cleared[key] as unknown[]) = [];
    }
    onChange(cleared);
  };

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

      {/* Category — primary facet */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-foreground uppercase tracking-wide">Categoría</p>
        <div className="flex flex-wrap gap-1.5">
          {filterOptions.categories.map((cat) => (
            <FilterPill
              key={cat}
              label={CATEGORY_LABELS[cat] ?? cat}
              active={filters.category.includes(cat)}
              onClick={() =>
                onChange({ ...filters, category: toggleValue(filters.category, cat) })
              }
            />
          ))}
        </div>
      </div>

      <Separator />

      {/* Brand — common */}
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

      {/* Category-specific facets — only when exactly one category is selected */}
      {selectedCategory && facets.length > 0 &&
        facets
          .filter((f) => f.options.length > 0)
          .map((facet) => (
            <div key={facet.key}>
              <Separator className="mb-5" />
              <div className="space-y-2">
                <p className="text-xs font-medium text-foreground uppercase tracking-wide">
                  {facet.title}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {facet.options.map((opt) => {
                    const arr = filters[facet.key] as Array<string | number>;
                    return (
                      <FilterPill
                        key={String(opt)}
                        label={facet.format ? facet.format(opt) : String(opt)}
                        active={arr.includes(opt)}
                        onClick={() =>
                          onChange({ ...filters, [facet.key]: toggleValue(arr, opt) })
                        }
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          ))}

      {!selectedCategory && (
        <p className="text-xs text-muted-foreground/70">
          Selecciona una categoría para ver filtros técnicos específicos.
        </p>
      )}
    </aside>
  );
}
