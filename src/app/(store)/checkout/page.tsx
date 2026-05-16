/**
 * /checkout — Checkout page (Phase 13B)
 *
 * Server component wrapper: fetches real storefront settings from Payload and
 * passes them to CheckoutClient (client component that owns auth/form/cart state).
 */

import { getStoreSettings } from "@/lib/repositories/settings";
import { CheckoutClient } from "./_components/CheckoutClient";

export default async function CheckoutPage() {
  const settings = await getStoreSettings();

  return (
    <CheckoutClient
      settings={{
        flatShippingRate: settings.flatShippingRate,
        currency: settings.currency,
        taxIncludedByDefault: settings.taxIncludedByDefault,
      }}
    />
  );
}
