/**
 * Mapper: Payload CMS response → Storefront types
 *
 * Handles all edge cases that Payload's API can return:
 *   - images array: populated objects, bare IDs (depth=0), or empty
 *   - datasheet: populated, bare ID, null, undefined
 *   - variants join: populated docs array, empty, or missing (depth=0)
 *   - poles: Payload stores select values as strings ("1"|"2"|"3"|"4")
 *   - price / stock: always number, but guard against undefined for safety
 */

import type { Product, ProductVariant, Poles, TripCurve, VariantType } from "@/types/product";

// ---------------------------------------------------------------------------
// Raw Payload shapes (populated at depth >= 1)
// ---------------------------------------------------------------------------

export interface PayloadMediaRef {
  id: string;
  url: string;
  filename?: string;
  /** MIME type returned by Payload (e.g. "application/pdf", "image/jpeg") */
  mimeType?: string;
  alt?: string;
}

export interface PayloadVariant {
  id: string;
  sku: string;
  saleType: VariantType;
  unitsPerPackage: number;
  price: number;
  stock: number;
  isActive: boolean;
}

/** Payload join fields return { docs: T[], hasNextPage: boolean, ... } */
export interface PayloadJoin<T> {
  docs: T[];
  hasNextPage?: boolean;
  totalDocs?: number;
}

export interface PayloadProduct {
  id: string;
  slug: string;
  name: string;
  description: string;
  /** New field (Phase 5A): short text for catalog cards */
  shortDescription?: string | null;
  /** New field (Phase 5A): extra technical notes */
  technicalSummary?: string | null;
  brand: string;
  model: string;
  amperage: number;
  /** Payload serialises select fields as strings even for numeric options */
  poles: "1" | "2" | "3" | "4";
  voltage: number;
  tripCurve: TripCurve;
  category: string;
  stock: number;
  /** Each element may be a populated object (depth≥1) or a bare ID string (depth=0) */
  images?: Array<{ image: PayloadMediaRef | string } | null> | null;
  /** May be populated, a bare ID, null, or undefined */
  datasheet?: PayloadMediaRef | string | null;
  isActive?: boolean;
  featured?: boolean;
  /** Populated join at depth≥1; absent or empty at depth=0 */
  variants?: PayloadJoin<PayloadVariant> | null;
  /**
   * Payload `array` field returns objects, not plain strings.
   * Shape: Array<{ id?: string; tag: string }>
   */
  tags?: Array<{ id?: string; tag: string }> | null;
  /** SEO fields (Phase 5A) */
  metaTitle?: string | null;
  metaDescription?: string | null;
  metaImage?: PayloadMediaRef | string | null;
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

export function mapPayloadVariant(v: PayloadVariant): ProductVariant {
  return {
    sku: v.sku,
    type: v.saleType,
    label: buildVariantLabel(v.saleType, v.unitsPerPackage ?? 1),
    price: v.price ?? 0,
    unitsPerPackage: v.unitsPerPackage ?? 1,
    stock: v.stock ?? 0,
  };
}

export function mapPayloadProduct(p: PayloadProduct): Product {
  // Variants: filter to active only, map to storefront type
  const variants: ProductVariant[] =
    p.variants?.docs
      ?.filter((v): v is PayloadVariant => Boolean(v) && v.isActive !== false)
      .map(mapPayloadVariant) ?? [];

  // Images: resolve each image ref; skip bare IDs (unpopulated)
  const images: string[] = (p.images ?? [])
    .filter((entry): entry is { image: PayloadMediaRef | string } => Boolean(entry))
    .map((entry) => resolveMediaUrl(entry.image))
    .filter((url): url is string => url !== null);

  // Datasheet: resolve full doc descriptor so we can forward filename + mimeType
  const datasheetDoc = resolveMediaDoc(p.datasheet);

  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    model: p.model,
    category: p.category,
    description: p.description,
    shortDescription: p.shortDescription ?? null,
    technicalSummary: p.technicalSummary ?? null,
    amperage: p.amperage ?? 0,
    poles: Number(p.poles) as Poles,
    voltage: p.voltage ?? 0,
    tripCurve: p.tripCurve,
    stock: p.stock ?? 0,
    images: images.length > 0 ? images : ["/media/placeholder-breaker.svg"],
    datasheetUrl: datasheetDoc?.url ?? null,
    datasheetFilename: datasheetDoc?.filename ?? null,
    datasheetMimeType: datasheetDoc?.mimeType ?? null,
    variants,
    featured: p.featured ?? false,
    // tags come as { id, tag }[] from Payload's array field — flatten to string[]
    tags: p.tags?.map((t) => t.tag).filter(Boolean) ?? [],
    // SEO fields — may be absent in older records; guard with nullish coalescing
    metaTitle: p.metaTitle ?? null,
    metaDescription: p.metaDescription ?? null,
    metaImage: resolveMediaUrl(p.metaImage) ?? null,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalises a media URL for use as a `next/image` src.
 *
 * Payload serialises Media.url as an ABSOLUTE URL built from `serverURL`
 * (e.g. "http://localhost:3000/api/media/file/foo.png"). Next.js 16's image
 * optimizer rejects absolute upstreams that resolve to a private/loopback IP
 * (SSRF guard) → the request 400s and the image never renders.
 *
 * Fix: when the URL points at this app's own media route, strip the origin and
 * return a same-origin RELATIVE path. The optimizer then fetches it locally
 * (no private-IP block) and it stays correct across every deploy host.
 * Genuinely remote CDN URLs (e.g. UploadThing's utfs.io / *.ufs.sh) are left
 * absolute so `images.remotePatterns` handles them.
 */
function toClientMediaUrl(url: string): string {
  if (!url) return url;
  // Already relative — nothing to do.
  if (url.startsWith("/")) return url;
  try {
    const parsed = new URL(url);
    // Payload's own file-serving routes are same-origin with the Next app.
    if (parsed.pathname.startsWith("/api/media/") || parsed.pathname.startsWith("/media/")) {
      return parsed.pathname + parsed.search;
    }
    return url; // remote CDN (UploadThing, S3, …) — keep absolute
  } catch {
    return url; // not a parseable absolute URL — return as-is
  }
}

/**
 * Resolves a Payload media reference to a URL string.
 * Returns null when the ref is a bare ID (not populated), null, or undefined.
 */
function resolveMediaUrl(ref: PayloadMediaRef | string | null | undefined): string | null {
  if (!ref) return null;
  if (typeof ref === "string") return null; // bare ID — caller used depth=0
  return ref.url ? toClientMediaUrl(ref.url) : null;
}

interface ResolvedMediaDoc {
  url: string;
  filename: string | null;
  mimeType: string | null;
}

/**
 * Resolves a Payload media reference to a full document descriptor.
 * Returns null when the ref is a bare ID, null, or undefined.
 * Use this for the datasheet field where filename and mimeType are needed.
 */
function resolveMediaDoc(
  ref: PayloadMediaRef | string | null | undefined
): ResolvedMediaDoc | null {
  if (!ref) return null;
  if (typeof ref === "string") return null; // bare ID — not populated
  if (!ref.url) return null;
  return {
    url: toClientMediaUrl(ref.url),
    filename: ref.filename ?? null,
    mimeType: ref.mimeType ?? null,
  };
}

const VARIANT_TYPE_LABELS: Record<VariantType, string> = {
  piece: "Pieza",
  box:   "Caja",
  lot:   "Lote",
};

function buildVariantLabel(type: VariantType, units: number): string {
  const base = VARIANT_TYPE_LABELS[type] ?? type;
  return units > 1 ? `${base} (×${units} uds.)` : base;
}
