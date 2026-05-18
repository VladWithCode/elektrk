"use client";

/**
 * CatalogClient — URL-driven catalog with fuzzy search
 *
 * Filters live in the URL (useSearchParams), not in local state alone.
 * This means:
 *   - Navigation links like /products?brand=Siemens work even when the user
 *     is already on /products.
 *   - Changing filters in the UI updates the URL (shareable, bookmarkable).
 *   - Back/forward browser navigation restores the correct filter state.
 *
 * Text search: server-side pg_trgm fuzzy search via searchProductsAction().
 *   - Debounced 350 ms before updating the URL (?q=...).
 *   - URL change triggers a useEffect that fires the server action.
 *   - Falls back to client-side substring when pg_trgm is unavailable.
 */

import { useMemo, useState, useTransition, useRef, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, SearchX, Sparkles } from "lucide-react";
import { ProductGrid } from "@/components/products/ProductGrid";
import { ProductFilters } from "@/components/products/ProductFilters";
import { ProductSearch } from "@/components/products/ProductSearch";
import { applyFilters } from "@/lib/filters";
import type { Product, FilterState } from "@/types/product";
import type { ProductFilterOptions } from "@/lib/repositories/products";
import { searchProductsAction } from "@/app/(store)/products/actions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

const VALID_SORT = new Set(["name_asc", "price_asc", "price_desc", "stock_desc"]);

/** Parse a FilterState from the current URL search params. */
function parseFiltersFromSearchParams(params: URLSearchParams): FilterState {
  const getAll = (key: string) => params.getAll(key);
  const getAllNum = (key: string) =>
    getAll(key).map(Number).filter((n) => !isNaN(n));

  const rawSort = params.get("sortBy") ?? "name_asc";

  return {
    brand: getAll("brand"),
    poles: getAllNum("poles") as FilterState["poles"],
    voltage: getAllNum("voltage") as FilterState["voltage"],
    tripCurve: getAll("tripCurve") as FilterState["tripCurve"],
    amperage: getAllNum("amperage"),
    category: getAll("category"),
    search: params.get("q") ?? "",
    sortBy: (VALID_SORT.has(rawSort) ? rawSort : "name_asc") as FilterState["sortBy"],
  };
}

/** Serialize a FilterState back to URL search params. */
function serializeFiltersToParams(filters: FilterState): URLSearchParams {
  const p = new URLSearchParams();
  filters.brand.forEach((v) => p.append("brand", v));
  filters.poles.forEach((v) => p.append("poles", String(v)));
  filters.voltage.forEach((v) => p.append("voltage", String(v)));
  filters.tripCurve.forEach((v) => p.append("tripCurve", v));
  filters.amperage.forEach((v) => p.append("amperage", String(v)));
  filters.category.forEach((v) => p.append("category", v));
  if (filters.sortBy && filters.sortBy !== "name_asc") p.set("sortBy", filters.sortBy);
  if (filters.search) p.set("q", filters.search);
  return p;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CatalogClientProps {
  /** All active products from the server (initial SSR load). */
  products: Product[];
  filterOptions: ProductFilterOptions;
  /** Kept for backward compatibility but no longer used — URL is the source of truth. */
  initialFilters?: Partial<FilterState>;
}

export function CatalogClient({ products, filterOptions }: CatalogClientProps) {
  const searchParamsHook = useSearchParams();
  const router = useRouter();

  // Filters are derived from the URL on every render — no useState needed.
  const filters = useMemo(
    () => parseFiltersFromSearchParams(searchParamsHook),
    [searchParamsHook]
  );

  // Base product list — replaced by fuzzy search results when a ?q= is active.
  const [baseProducts, setBaseProducts] = useState<Product[]>(products);

  // Search input text shown in the box — leads the URL by up to 350 ms.
  const [searchInput, setSearchInput] = useState(filters.search);

  // True while the server action is in-flight.
  const [isPending, startTransition] = useTransition();

  // True when baseProducts is a fuzzy/server-filtered subset.
  const [isFuzzySearch, setIsFuzzySearch] = useState(false);

  // Debounce timer for the search box.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // -------------------------------------------------------------------------
  // Sync: when the ?q= URL param changes, fire (or clear) the fuzzy search.
  // Also sync the search input box with the URL (e.g. on external navigation).
  // -------------------------------------------------------------------------
  useEffect(() => {
    const q = filters.search;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearchInput(q); // sync input box with URL (e.g. on external navigation)

    if (!q) {
      setBaseProducts(products);
      setIsFuzzySearch(false);
      return;
    }

    startTransition(async () => {
      try {
        const results = await searchProductsAction(q);
        setBaseProducts(results);
        setIsFuzzySearch(true);
      } catch {
        // pg_trgm unavailable — fall back to client-side substring
        const fallback = applyFilters(products, { ...DEFAULT_FILTERS, search: q });
        setBaseProducts(fallback);
        setIsFuzzySearch(false);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search]); // `products` intentionally omitted; handled in the effect below

  // Reset base products when the parent passes a fresh product list (e.g., full navigation)
  // but only when no active search (search effect handles that case).
  useEffect(() => {
    if (!filters.search) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBaseProducts(products);
    }
  }, [products, filters.search]);

  // -------------------------------------------------------------------------
  // Apply technical filters client-side on top of (possibly fuzzy) baseProducts.
  // Pass search: "" because text search is already done server-side.
  // -------------------------------------------------------------------------
  const filtered = useMemo(
    () => applyFilters(baseProducts, { ...filters, search: "" }),
    [baseProducts, filters]
  );

  // -------------------------------------------------------------------------
  // Handlers — update URL; URL change propagates back to `filters` via useMemo
  // -------------------------------------------------------------------------

  /** Called by ProductFilters when any filter pill / sort is toggled. */
  function handleFiltersChange(newFilters: FilterState) {
    const qs = serializeFiltersToParams(newFilters).toString();
    router.replace(`/products${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  /** Called by ProductSearch as the user types — debounced URL update. */
  function handleSearch(query: string) {
    setSearchInput(query); // immediate UI feedback

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      // Clear immediately
      debounceRef.current = null;
      const qs = serializeFiltersToParams({ ...filters, search: "" }).toString();
      router.replace(`/products${qs ? `?${qs}` : ""}`, { scroll: false });
      return;
    }

    debounceRef.current = setTimeout(() => {
      const qs = serializeFiltersToParams({ ...filters, search: query }).toString();
      router.replace(`/products${qs ? `?${qs}` : ""}`, { scroll: false });
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
            onChange={handleFiltersChange}
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
