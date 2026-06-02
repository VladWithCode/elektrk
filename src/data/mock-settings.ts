/**
 * Mock storefront settings
 *
 * Mirrors the shape of the Payload `settings` global so pricing helpers and
 * checkout can work identically with mock data or with real Payload data.
 *
 * When DATA_SOURCE="payload" and Neon is connected, replace this with a
 * call to `payload.findGlobal({ slug: "settings" })` and map the response
 * to the StorefrontSettings interface below.
 */

export interface StorefrontSettings {
  storeName: string;
  supportEmail: string;
  storePhone?: string | null;
  whatsapp?: string | null;
  flatShippingRate: number;
  currency: string;
  taxIncludedByDefault: boolean;
  announcementEnabled?: boolean;
  announcementBanner?: string | null;
}

export const MOCK_SETTINGS: StorefrontSettings = {
  storeName: "Distribuidor Electrico Monterrey",
  supportEmail: "ventas@elektrk.mx",
  storePhone: null,
  whatsapp: null,
  flatShippingRate: 180,
  currency: "MXN",
  taxIncludedByDefault: true,
  announcementEnabled: false,
  announcementBanner: null,
};
