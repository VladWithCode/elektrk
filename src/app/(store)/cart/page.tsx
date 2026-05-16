/**
 * /cart — Cart page (Phase 13B)
 *
 * Server component wrapper: fetches real storefront settings from Payload and
 * passes them to CartPageClient (client component that reads CartContext).
 */

import { getStoreSettings } from "@/lib/repositories/settings";
import { CartPageClient } from "./_components/CartPageClient";

export default async function CartPage() {
  const settings = await getStoreSettings();

  return (
    <CartPageClient
      shippingRate={settings.flatShippingRate}
      taxIncluded={settings.taxIncludedByDefault}
    />
  );
}
