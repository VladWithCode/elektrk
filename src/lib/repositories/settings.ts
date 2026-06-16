/**
 * Settings repository — ElektrK (Phase 13B)
 *
 * Reads the "settings" Payload Global (src/globals/Settings.ts).
 * The Global uses nested field groups:
 *   store.storeName, store.supportEmail, store.storePhone, store.whatsapp,
 *   store.businessHours
 *   pricing.flatShippingRate, pricing.currency, pricing.taxIncludedByDefault
 *   announcement.announcementEnabled, announcement.announcementBanner
 *
 * DATA_SOURCE resolution:
 *   "mock"    → returns MOCK_SETTINGS (no DB required)
 *   "payload" → reads Global from Payload CMS + maps nested groups to flat shape
 *
 * Fallback:
 *   If the Global has never been saved (Payload returns null for some fields),
 *   each field falls back to its MOCK_SETTINGS default so the storefront never
 *   breaks on a fresh install.
 */

import { unstable_cache } from "next/cache";
import { MOCK_SETTINGS } from "@/data/mock-settings";
import type { StorefrontSettings } from "@/data/mock-settings";
import { SETTINGS_CACHE_TAG } from "@/lib/cache-tags";

// ---------------------------------------------------------------------------
// DATA_SOURCE resolution (mirrors the pattern in products.ts)
// ---------------------------------------------------------------------------

type DataSource = "mock" | "payload";
let _resolvedDataSource: DataSource | null = null;

function resolveDataSource(): DataSource {
  if (_resolvedDataSource !== null) return _resolvedDataSource;

  const raw = process.env.DATA_SOURCE ?? "mock";
  if (raw === "payload") {
    if (!process.env.DATABASE_URL) {
      if (process.env.NODE_ENV === "production") {
        throw new Error(
          "[settings repository] DATA_SOURCE=payload requires DATABASE_URL."
        );
      }
      console.warn(
        "[settings repository] DATA_SOURCE=payload but DATABASE_URL is not set. " +
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
// Lazy Payload client singleton
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _payloadClient: any = null;

async function getPayloadClient() {
  if (_payloadClient) return _payloadClient;
  const { getPayload } = await import("payload");
  const { default: config } = await import("@payload-config");
  _payloadClient = await getPayload({ config });
  return _payloadClient;
}

// ---------------------------------------------------------------------------
// Payload raw shape (nested groups)
// ---------------------------------------------------------------------------

interface RawPayloadSettings {
  store?: {
    storeName?: string | null;
    supportEmail?: string | null;
    storePhone?: string | null;
    whatsapp?: string | null;
    businessHours?: string | null;
  } | null;
  pricing?: {
    flatShippingRate?: number | null;
    currency?: string | null;
    taxIncludedByDefault?: boolean | null;
  } | null;
  announcement?: {
    announcementEnabled?: boolean | null;
    announcementBanner?: string | null;
  } | null;
}

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

function mapPayloadSettings(raw: RawPayloadSettings): StorefrontSettings {
  return {
    storeName:
      raw.store?.storeName ?? MOCK_SETTINGS.storeName,
    supportEmail:
      raw.store?.supportEmail ?? MOCK_SETTINGS.supportEmail,
    storePhone:
      raw.store?.storePhone ?? MOCK_SETTINGS.storePhone ?? null,
    whatsapp:
      raw.store?.whatsapp ?? MOCK_SETTINGS.whatsapp ?? null,
    flatShippingRate:
      raw.pricing?.flatShippingRate ?? MOCK_SETTINGS.flatShippingRate,
    currency:
      raw.pricing?.currency ?? MOCK_SETTINGS.currency,
    taxIncludedByDefault:
      raw.pricing?.taxIncludedByDefault ?? MOCK_SETTINGS.taxIncludedByDefault,
    announcementEnabled:
      raw.announcement?.announcementEnabled ?? MOCK_SETTINGS.announcementEnabled ?? false,
    announcementBanner:
      raw.announcement?.announcementBanner ?? MOCK_SETTINGS.announcementBanner ?? null,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the storefront settings.
 *
 * When DATA_SOURCE=payload:
 *   Reads the "settings" Global from Payload CMS (overrideAccess: true so
 *   the server can always read it regardless of the isAdmin access rule).
 *   Falls back field-by-field to MOCK_SETTINGS defaults when the Global
 *   has not been configured yet.
 *
 * When DATA_SOURCE=mock:
 *   Returns MOCK_SETTINGS directly — no DB required.
 */
/**
 * Cached Payload read of the "settings" Global.
 *
 * Tagged with SETTINGS_CACHE_TAG so the storefront stays statically renderable.
 * The Settings Global's afterChange hook calls revalidateTag(SETTINGS_CACHE_TAG)
 * so an admin save is reflected on the next request — no per-request DB read and,
 * critically, no static-generation bailout in the (store) layout that consumes it.
 */
const getCachedPayloadSettings = unstable_cache(
  async (): Promise<StorefrontSettings> => {
    const payload = await getPayloadClient();

    // findGlobal reads the "settings" global; overrideAccess bypasses isAdmin
    const raw = (await payload.findGlobal({
      slug: "settings",
      depth: 0,
      overrideAccess: true,
    })) as RawPayloadSettings;

    return mapPayloadSettings(raw ?? {});
  },
  ["store-settings"],
  { tags: [SETTINGS_CACHE_TAG] },
);

export async function getStoreSettings(): Promise<StorefrontSettings> {
  if (resolveDataSource() !== "payload") {
    return MOCK_SETTINGS;
  }

  return getCachedPayloadSettings();
}

/**
 * Convenience: returns just the flat shipping rate (in MXN).
 */
export async function getShippingRate(): Promise<number> {
  const settings = await getStoreSettings();
  return settings.flatShippingRate;
}

/**
 * Convenience: returns whether published prices include VAT.
 */
export async function getTaxIncludedByDefault(): Promise<boolean> {
  const settings = await getStoreSettings();
  return settings.taxIncludedByDefault;
}

/**
 * Convenience: returns the active currency code (e.g. "MXN").
 */
export async function getCurrency(): Promise<string> {
  const settings = await getStoreSettings();
  return settings.currency;
}
