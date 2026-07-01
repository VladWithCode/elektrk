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

/** Bank details + payment instructions surfaced to the customer. */
export interface PaymentSettings {
  bankName: string | null;
  accountHolder: string | null;
  clabe: string | null;
  accountNumber: string | null;
  paymentInstructions: string | null;
  /** Days after which unpaid pending orders auto-expire (null → use default). */
  pendingOrderTtlDays: number | null;
}

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
  payment: PaymentSettings;
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
  // Empty by default so nothing fake renders until the admin fills these in.
  payment: {
    bankName: null,
    accountHolder: null,
    clabe: null,
    accountNumber: null,
    paymentInstructions: null,
    pendingOrderTtlDays: null,
  },
};
