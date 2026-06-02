import type { Metadata } from "next";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { CatalogClient } from "@/components/products/CatalogClient";
import { getProducts, getProductFilters } from "@/lib/repositories/products";
import type { FilterState } from "@/types/product";

export const metadata: Metadata = {
  title: "Catálogo de Productos",
  description:
    "Explora nuestro catálogo de interruptores termomagnéticos y componentes eléctricos. Filtra por marca, amperaje, polos o curva de disparo. Siemens, ABB y Schneider Electric.",
  openGraph: {
    title: "Catálogo — D.E. MTY",
    description:
      "Interruptores termomagnéticos de las mejores marcas. Filtra por amperage, polos y curva de disparo.",
    type: "website",
  },
};

// ---------------------------------------------------------------------------
// searchParams helpers
// ---------------------------------------------------------------------------

type RawParams = Record<string, string | string[] | undefined>;

function toStringArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function toNumberArray(v: string | string[] | undefined): number[] {
  return toStringArray(v)
    .map(Number)
    .filter((n) => !isNaN(n));
}

const VALID_SORT = new Set(["name_asc", "price_asc", "price_desc", "stock_desc"]);

function parseInitialFilters(params: RawParams): Partial<FilterState> {
  const filters: Partial<FilterState> = {};

  const brand = toStringArray(params.brand);
  if (brand.length) filters.brand = brand;

  const poles = toNumberArray(params.poles);
  if (poles.length) filters.poles = poles as FilterState["poles"];

  const voltage = toNumberArray(params.voltage);
  if (voltage.length) filters.voltage = voltage as FilterState["voltage"];

  const tripCurve = toStringArray(params.tripCurve);
  if (tripCurve.length) filters.tripCurve = tripCurve as FilterState["tripCurve"];

  const amperage = toNumberArray(params.amperage);
  if (amperage.length) filters.amperage = amperage;

  const category = toStringArray(params.category);
  if (category.length) filters.category = category;

  if (params.q && typeof params.q === "string") filters.search = params.q;

  const sort = params.sortBy;
  if (typeof sort === "string" && VALID_SORT.has(sort)) {
    filters.sortBy = sort as FilterState["sortBy"];
  }

  return filters;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}) {
  const [products, filterOptions, params] = await Promise.all([
    getProducts(),
    getProductFilters(),
    searchParams,
  ]);

  const initialFilters = parseInitialFilters(params);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <SectionHeader
        title="Catálogo"
        subtitle="Interruptores termomagnéticos y componentes eléctricos"
        className="mb-6"
      />
      <CatalogClient
        products={products}
        filterOptions={filterOptions}
        initialFilters={initialFilters}
      />
    </div>
  );
}
