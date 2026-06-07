/**
 * Product repository
 *
 * DATA_SOURCE controls which backend is used at runtime:
 *
 *   DATA_SOURCE="mock"    → MOCK_PRODUCTS (default, no DB required)
 *   DATA_SOURCE="payload" → Payload CMS local API (requires DATABASE_URL)
 *
 * The public function signatures never change — switching DATA_SOURCE is the
 * only thing required when Neon is ready.
 *
 * Do NOT import `payload` at the top level. The lazy `getPayloadClient()`
 * helper below initialises it on first call, so build-time static generation
 * never touches the database.
 */

import type { Product, FilterState, Poles, TripCurve, ProductCategory } from "@/types/product";
import { MOCK_PRODUCTS } from "@/data/mock-products";
import { applyFilters, EMPTY_FILTER_STATE } from "@/lib/filters";
import {
  mapPayloadProduct,
  type PayloadProduct,
} from "@/lib/mappers/product.mapper";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ProductFilterOptions {
  categories: ProductCategory[];
  brands: string[];
  // Interruptores
  amperages: number[];
  poles: readonly Poles[];
  voltages: number[];
  tripCurves: readonly TripCurve[];
  // Unicanal
  gauges: string[];
  dimensions: string[];
  channelTypes: string[];
  finishes: string[];
  // Gabinetes y tableros
  boardTypes: string[];
  nemaRatings: string[];
  amperageCapacities: number[];
  // Fijación / Soportería / Herramientas
  anchorTypes: string[];
  supportTypes: string[];
  accessoryTypes: string[];
  dimDiameters: string[];
  dimLengths: string[];
}

// ---------------------------------------------------------------------------
// DATA_SOURCE resolution
// ---------------------------------------------------------------------------

type DataSource = "mock" | "payload";

// Memoised so the resolution logic and console.warn fire at most once per process,
// not once per request / function call.
let _resolvedDataSource: DataSource | null = null;

function resolveDataSource(): DataSource {
  if (_resolvedDataSource !== null) return _resolvedDataSource;

  const raw = process.env.DATA_SOURCE ?? "mock";
  if (raw === "payload") {
    if (!process.env.DATABASE_URL) {
      if (process.env.NODE_ENV === "production") {
        throw new Error(
          "[products repository] DATA_SOURCE=payload requires DATABASE_URL. " +
            "Add it to your environment or set DATA_SOURCE=mock."
        );
      }
      // Development: warn once and fall back to mock
      console.warn(
        "[products repository] DATA_SOURCE=payload but DATABASE_URL is not set. " +
          "Falling back to mock data."
      );
      _resolvedDataSource = "mock";
      return "mock";
    }
    _resolvedDataSource = "payload";
    return "payload";
  }

  _resolvedDataSource = "mock";
  return "mock";
}

// ---------------------------------------------------------------------------
// Lazy Payload client (only initialised when DATA_SOURCE=payload)
//
// Uses a module-level singleton so getPayload() is called at most once per
// process, not once per request.
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _payloadClient: any = null; // Typed loosely — Payload types are pulled in dynamically only when DATA_SOURCE="payload"; importing them statically would drag DB deps into the mock bundle.

async function getPayloadClient() {
  if (_payloadClient) return _payloadClient;

  // Dynamic import keeps `payload` out of the module graph when DATA_SOURCE=mock.
  // This prevents Payload from initialising its DB pool during Next.js static build.
  const { getPayload } = await import("payload");
  const { default: config } = await import("@payload-config");

  _payloadClient = await getPayload({ config });
  return _payloadClient;
}

// ---------------------------------------------------------------------------
// Repository functions
// ---------------------------------------------------------------------------

/**
 * Returns all active products, optionally filtered and sorted.
 *
 * When DATA_SOURCE=payload:
 *   Fetches from Payload with depth=1 (populates images, datasheet, variants join).
 *   Server-side filtering is applied before mapping; client-side applyFilters()
 *   is intentionally NOT called — Payload's where clause handles it instead.
 */
export async function getProducts(filters?: Partial<FilterState>): Promise<Product[]> {
  if (resolveDataSource() === "payload") {
    const payload = await getPayloadClient();
    const result = await payload.find({
      collection: "products",
      where: {
        and: [
          { isActive: { equals: true } },
          { isDeleted: { not_equals: true } },
        ],
      },
      depth: 1,
      limit: 500,
    });
    const products = (result.docs as PayloadProduct[]).map(mapPayloadProduct);
    if (!filters) return products;
    const merged: FilterState = { ...EMPTY_FILTER_STATE, ...filters };
    return applyFilters(products, merged);
  }

  // --- mock ---
  const base = MOCK_PRODUCTS;
  if (!filters) return base;
  const merged: FilterState = { ...EMPTY_FILTER_STATE, ...filters };
  return applyFilters(base, merged);
}

/**
 * Returns a single active product by slug, or null if not found.
 *
 * When DATA_SOURCE=payload:
 *   Uses depth=1 to populate variants, images and datasheet in one query.
 */
export async function getProductBySlug(slug: string): Promise<Product | null> {
  if (resolveDataSource() === "payload") {
    const payload = await getPayloadClient();
    const result = await payload.find({
      collection: "products",
      where: {
        and: [
          { slug: { equals: slug } },
          { isActive: { equals: true } },
          { isDeleted: { not_equals: true } },
        ],
      },
      depth: 1,
      limit: 1,
    });
    const doc = result.docs[0] as PayloadProduct | undefined;
    return doc ? mapPayloadProduct(doc) : null;
  }

  // --- mock ---
  return MOCK_PRODUCTS.find((p) => p.slug === slug) ?? null;
}

/**
 * Returns featured active products, up to `limit`.
 *
 * When DATA_SOURCE=payload:
 *   Queries products where featured=true AND isActive=true.
 */
export async function getFeaturedProducts(limit = 4): Promise<Product[]> {
  if (resolveDataSource() === "payload") {
    const payload = await getPayloadClient();
    const result = await payload.find({
      collection: "products",
      where: {
        and: [
          { featured: { equals: true } },
          { isActive: { equals: true } },
          { isDeleted: { not_equals: true } },
        ],
      },
      depth: 1,
      limit,
    });
    return (result.docs as PayloadProduct[]).map(mapPayloadProduct);
  }

  // --- mock ---
  return MOCK_PRODUCTS.filter((p) => p.featured).slice(0, limit);
}

/**
 * Returns the available filter options for the catalog sidebar.
 *
 * When DATA_SOURCE=payload:
 *   Derives distinct values from all active products (one query, then reduce).
 *   For large catalogs consider caching this result (revalidate: 3600).
 */
export async function getProductFilters(): Promise<ProductFilterOptions> {
  // Derive distinct facet values from the active product set. getProducts()
  // already resolves the correct data source (payload or mock) and maps to the
  // storefront Product shape, so facets stay consistent with what is rendered.
  const products = await getProducts();
  return deriveFilterOptions(products);
}

function uniqStr(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((v): v is string => !!v))].sort((a, b) =>
    a.localeCompare(b, "es", { numeric: true })
  );
}

function uniqNum(values: Array<number | null | undefined>): number[] {
  return [...new Set(values.filter((v): v is number => v != null))].sort((a, b) => a - b);
}

function deriveFilterOptions(products: Product[]): ProductFilterOptions {
  return {
    categories: [...new Set(products.map((p) => p.category))] as ProductCategory[],
    brands: uniqStr(products.map((p) => p.brand)),
    amperages: uniqNum(products.map((p) => p.amperage)),
    poles: [...new Set(products.map((p) => p.poles).filter((v): v is Poles => v != null))].sort(
      (a, b) => a - b
    ),
    voltages: uniqNum(products.map((p) => p.voltage)),
    tripCurves: [
      ...new Set(products.map((p) => p.tripCurve).filter((v): v is TripCurve => v != null)),
    ].sort() as TripCurve[],
    gauges: uniqStr(products.map((p) => p.gauge)),
    dimensions: uniqStr(products.map((p) => p.dimensions)),
    channelTypes: uniqStr(products.map((p) => p.channelType)),
    finishes: uniqStr(products.map((p) => p.finish)),
    boardTypes: uniqStr(products.map((p) => p.boardType)),
    nemaRatings: uniqStr(products.map((p) => p.nemaRating)),
    amperageCapacities: uniqNum(products.map((p) => p.amperageCapacity)),
    anchorTypes: uniqStr(products.map((p) => p.anchorType)),
    supportTypes: uniqStr(products.map((p) => p.supportType)),
    accessoryTypes: uniqStr(products.map((p) => p.accessoryType)),
    dimDiameters: uniqStr(products.map((p) => p.dimDiameter)),
    dimLengths: uniqStr(products.map((p) => p.dimLength)),
  };
}

/**
 * Fuzzy-searches active products using pg_trgm (Phase 12B).
 *
 * When DATA_SOURCE=payload:
 *   1. Runs a parametrized pg_trgm + ILIKE query via @neondatabase/serverless.
 *   2. Receives IDs ranked by similarity score.
 *   3. Fetches those products from Payload (depth=1) and re-orders by score.
 *   Falls back to Payload's `like` operator if the pg_trgm query fails.
 *
 * When DATA_SOURCE=mock:
 *   Delegates to applyFilters() (simple substring match, no fuzzy).
 *
 * @param query  Raw user text — trimmed and parametrized, never interpolated.
 */
export async function searchProducts(query: string): Promise<Product[]> {
  const q = query.trim();

  if (!q) return getProducts();

  // --- Mock path ---
  if (resolveDataSource() !== "payload") {
    const merged: FilterState = { ...EMPTY_FILTER_STATE, search: q };
    return applyFilters(MOCK_PRODUCTS, merged);
  }

  // --- Payload path: pg_trgm ---
  const { searchProductsByTrigram } = await import("@/lib/search/products-search");

  let ranked: Array<{ id: string; score: number }>;
  try {
    ranked = await searchProductsByTrigram(q);
  } catch (err) {
    // pg_trgm unavailable or connection error — fall back to Payload `like`
    console.error(
      "[products.searchProducts] pg_trgm failed, falling back to Payload like:",
      err instanceof Error ? err.message : err
    );
    const payload = await getPayloadClient();
    const result = await payload.find({
      collection: "products",
      where: {
        and: [
          { isActive: { equals: true } },
          { isDeleted: { not_equals: true } },
          {
            or: [
              { name: { like: q } },
              { brand: { like: q } },
              { model: { like: q } },
            ],
          },
        ],
      },
      depth: 1,
      limit: 200,
    });
    return (result.docs as PayloadProduct[]).map(mapPayloadProduct);
  }

  if (ranked.length === 0) return [];

  // Fetch matched products from Payload (preserves active check + full population)
  const numericIds = ranked
    .map((r) => Number(r.id))
    .filter((n) => Number.isFinite(n) && n > 0);

  if (numericIds.length === 0) return [];

  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: "products",
    where: {
      and: [
        { id: { in: numericIds } },
        { isActive: { equals: true } },
        { isDeleted: { not_equals: true } },
      ],
    },
    depth: 1,
    limit: numericIds.length,
  });

  const products = (result.docs as PayloadProduct[]).map(mapPayloadProduct);

  // Re-sort to match pg_trgm relevance order (Payload returns in DB order)
  const scoreMap = new Map(ranked.map((r) => [r.id, r.score]));
  products.sort((a, b) => {
    const sa = scoreMap.get(String(a.id)) ?? 0;
    const sb = scoreMap.get(String(b.id)) ?? 0;
    return sb - sa;
  });

  return products;
}

/**
 * Returns all active product slugs — used by generateStaticParams().
 *
 * When DATA_SOURCE=payload:
 *   Fetches at depth=0 with only the slug field for minimal payload.
 */
export async function getAllProductSlugs(): Promise<string[]> {
  if (resolveDataSource() === "payload") {
    const payload = await getPayloadClient();
    const result = await payload.find({
      collection: "products",
      where: {
        and: [
          { isActive: { equals: true } },
          { isDeleted: { not_equals: true } },
        ],
      },
      depth: 0,
      limit: 1000,
      select: { slug: true },
    });
    return (result.docs as Array<{ slug: string }>).map((d) => d.slug);
  }

  // --- mock ---
  return MOCK_PRODUCTS.map((p) => p.slug);
}
