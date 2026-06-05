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

/** UploadThing storage key for one generated image size. */
interface PayloadMediaSize {
  _key?: string | null;
  filename?: string | null;
}

export interface PayloadMediaRef {
  id: string;
  url: string;
  filename?: string;
  /** MIME type returned by Payload (e.g. "application/pdf", "image/jpeg") */
  mimeType?: string;
  alt?: string;
  /** UploadThing key for the original file (storage-uploadthing plugin). */
  _key?: string | null;
  /** UploadThing keys for generated image sizes. */
  sizes?: Record<string, PayloadMediaSize | null> | null;
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

/** UploadThing public file host. Files uploaded with acl "public-read" are
 *  served here directly, with no token and no signed URL. */
const UPLOADTHING_PUBLIC_BASE = "https://utfs.io/f/";

/**
 * Builds a public UploadThing URL from a stored storage key.
 * The storage-uploadthing plugin saves the key in `_key` (original) and in
 * `sizes.<name>._key` (generated sizes).
 */
function uploadthingUrlFromKey(key: string | null | undefined): string | null {
  if (!key) return null;
  return UPLOADTHING_PUBLIC_BASE + key;
}

/** Picks the best available UploadThing key: original first, then any size. */
function pickUploadthingKey(ref: PayloadMediaRef): string | null {
  if (ref._key) return ref._key;
  const sizes = ref.sizes;
  if (sizes) {
    // Prefer larger sizes (card) over thumbnail when the original is missing.
    for (const name of ["card", "thumbnail"]) {
      const k = sizes[name]?._key;
      if (k) return k;
    }
    for (const s of Object.values(sizes)) {
      if (s?._key) return s._key;
    }
  }
  return null;
}

/**
 * Normalises a media URL for use as a `next/image` src.
 *
 * Storage with @payloadcms/storage-uploadthing keeps `Media.url` pointing at
 * Payload's own proxy route ("/api/media/file/<filename>", absolutised with
 * `serverURL`). Two problems with using that as a next/image src:
 *   1. Local dev: the absolute serverURL is "http://localhost:3000" → Next's
 *      optimizer rejects the private/loopback upstream (SSRF guard) → 400.
 *   2. Vercel prod: the optimizer rejects the dynamic API-route upstream with
 *      "INVALID_IMAGE_OPTIMIZE_REQUEST" → 400 → image never renders.
 *
 * Fix: when the media has an UploadThing storage key, render the DIRECT public
 * UploadThing URL (https://utfs.io/f/<key>). It is a real CDN URL accepted by
 * the optimizer on both local and Vercel, needs no token (public-read ACL),
 * and is identical in every environment. Falls back to a same-origin relative
 * path for any media without a key.
 */
function toClientMediaUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith("/")) return url; // already relative
  try {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith("/api/media/") || parsed.pathname.startsWith("/media/")) {
      return parsed.pathname + parsed.search; // same-origin proxy fallback
    }
    return url; // remote CDN — keep absolute
  } catch {
    return url;
  }
}

/**
 * Resolves a Payload media reference to a URL string.
 * Returns null when the ref is a bare ID (not populated), null, or undefined.
 */
function resolveMediaUrl(ref: PayloadMediaRef | string | null | undefined): string | null {
  if (!ref) return null;
  if (typeof ref === "string") return null; // bare ID — caller used depth=0
  // Prefer the direct public UploadThing URL (works on local + Vercel).
  const utUrl = uploadthingUrlFromKey(pickUploadthingKey(ref));
  if (utUrl) return utUrl;
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
  // Prefer the direct public UploadThing URL when available.
  const utUrl = uploadthingUrlFromKey(ref._key);
  const url = utUrl ?? (ref.url ? toClientMediaUrl(ref.url) : null);
  if (!url) return null;
  return {
    url,
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
