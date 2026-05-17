/**
 * /checkout — Checkout page (Phase 13B / Phase 18)
 *
 * Server component wrapper: fetches real storefront settings from Payload and
 * the customer's saved addresses (when DATA_SOURCE=payload + session exists),
 * then passes them to CheckoutClient.
 */

import { getStoreSettings } from "@/lib/repositories/settings";
import { getSessionSafe } from "@/lib/auth/helpers";
import { getAddressesByCustomer } from "@/lib/repositories/addresses";
import { CheckoutClient } from "./_components/CheckoutClient";

export default async function CheckoutPage() {
  const [settings, session] = await Promise.all([
    getStoreSettings(),
    getSessionSafe(),
  ]);

  const savedAddresses = session?.user?.id
    ? await getAddressesByCustomer(session.user.id)
    : [];

  return (
    <CheckoutClient
      settings={{
        flatShippingRate: settings.flatShippingRate,
        currency: settings.currency,
        taxIncludedByDefault: settings.taxIncludedByDefault,
      }}
      savedAddresses={savedAddresses}
    />
  );
}
