"use client";

/**
 * CatalogClient — Phase 12B
 *
 * Text search: server-side pg_trgm fuzzy search via searchProductsAction().
 *   - Debounced 350 ms before firing.
 *   - Uses useTransition so the UI stays responsive while waiting.
 *   - Shows a "Resultados relacionados" indicator when fuzzy results are active.
 *   - Falls back to all products when query is cleared.
 *
 * Technical filters (amperage, poles, voltage, tripCurve, brand, category):
 *   - Still applied client-side via applyFilters() — instant, no round-trip.
 *   - Applied on top of whatever products the server returned.
 *
 * Error handling:
 *   - If the server action fails (pg_trgm down, network), falls back to
 *     simple client-side substring match so the user always gets something.
 */

import { useMemo, useState, useTransition, useRef } from "react";
import { Loader2, SearchX, Sparkles } from "lucide-react";
import { ProductGrid } from "@/components/products/ProductGrid";
import { ProductFilters } from "@/components/products/ProductFilters";
import { ProductSearch } from "@/components/products/ProductSearch";
import { applyFilters } from "@/lib/filters";
import type { Product, FilterState } from "@/types/product";
import type { ProductFilterOptions } from "@/lib/repositories/products";
import { searchProductsAction } from "@/app/(store)/products/actions";

interface CatalogClientProps {
  /** All active products from the server (initial SSR load). */
  products: Product[];
  filterOptions: ProductFilterOptions;
  /** Filters pre-populated from URL query params (e.g. navigation links). */
  initialFilters?: Partial<FilterState>;
}

const DEFAULT_FILTERS: FilterState = {
  amperage: [],
  poles: [],
  voltage: [],
  tripCurve: [],
  brand: [],
  category: [],
  search: "",
  sortBy: "name_asc",
};

export function CatalogClient({ products, filterOptions, initialFilters }: CatalogClientProps) {
  // Technical filters — client-side, instant; seeded from URL params when present
  const [filters, setFilters] = useState<FilterState>({ ...DEFAULT_FILTERS, ...initialFilters });

  // Base product list — replaced by fuzzy search results when user types
  const [baseProducts, setBaseProducts] = useState<Product[]>(products);

  // Search input text (shown in the input box, may be ahead of the debounce)
  const [searchInput, setSearchInput] = useState("");

  // True while the server action is in-flight
  const [isPending, startTransition] = useTransition();

  // True when baseProducts is a fuzzy/filtered subset (not all products)
  const [isFuzzySearch, setIsFuzzySearch] = useState(false);

  // Ref for the debounce timer
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Apply technical filters client-side on top of (possibly fuzzy) baseProducts.
  // Pass search: "" because text search is already done server-side.
  const filtered = useMemo(
    () => applyFilters(baseProducts, { ...filters, search: "" }),
    [baseProducts, filters]
  );

  // -------------------------------------------------------------------------
  // Search handler — debounced, calls server action
  // -------------------------------------------------------------------------

  function handleSearch(query: string) {
    setSearchInput(query);

    // Cancel any pending debounce
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      // Immediately reset to all products when cleared
      setBaseProducts(products);
      setIsFuzzySearch(false);
      return;
    }

    // Debounce the server-side call
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        try {
          const results = await searchProductsAction(query);
          setBaseProducts(results);
          setIsFuzzySearch(true);
        } catch {
          // pg_trgm unavailable — fall back to client-side substring match
          const fallback = applyFilters(products, {
            ...DEFAULT_FILTERS,
            search: query,
          });
          setBaseProducts(fallback);
          setIsFuzzySearch(false);
        }
      });
    }, 350);
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <>
      {/* Search bar */}
      <div className="mb-6 max-w-xl relative">
        <ProductSearch
          value={searchInput}
          onChange={handleSearch}
        />
        {/* Spinner overlaid on the right side while pending */}
        {isPending && (
          <span className="absolute right-10 top-1/2 -translate-y-1/2 pointer-events-none">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </span>
        )}
      </div>

      {/* Fuzzy search indicator */}
      {isFuzzySearch && searchInput && (
        <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
          <span>
            Resultados relacionados para{" "}
            <strong className="text-foreground">&ldquo;{searchInput}&rdquo;</strong>
            {baseProducts.length > 0
              ? ` — ${baseProducts.length} encontrado${baseProducts.length !== 1 ? "s" : ""}`
              : ""}
          </span>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar filters */}
        <div className="w-full lg:w-56 shrink-0">
          <ProductFilters
            filters={filters}
            onChange={setFilters}
            filterOptions={filterOptions}
            totalCount={baseProducts.length}
            filteredCount={filtered.length}
          />
        </div>

        {/* Product grid */}
        <div className="flex-1 min-w-0">
          {filtered.length === 0 && !isPending ? (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
              <SearchX className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">
                {searchInput
                  ? `Sin resultados para "${searchInput}"`
                  : "Sin productos con los filtros seleccionados"}
              </p>
              {searchInput && (
                <p className="text-xs text-muted-foreground/70">
                  Prueba con otro término o verifica la ortografía.
                </p>
              )}
            </div>
          ) : (
            <ProductGrid products={filtered} />
          )}
        </div>
      </div>
    </>
  );
}
