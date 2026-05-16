"use server";

/**
 * Settings Server Action — Phase 13B
 *
 * Returns storefront settings for client components that cannot call the
 * repository directly. Used by cart/page.tsx and checkout/page.tsx
 * as an initial-data pattern (fetched once on mount if not received via props).
 */

import { getStoreSettings } from "@/lib/repositories/settings";
import type { StorefrontSettings } from "@/data/mock-settings";

export async function getStoreSettingsAction(): Promise<StorefrontSettings> {
  return getStoreSettings();
}
