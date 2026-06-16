/**
 * Centralized Next.js cache tags.
 *
 * Keep tag strings here so the cached readers that produce tagged data and the
 * revalidation hooks that bust it never drift apart.
 */

/** Tags the cached storefront settings read (see lib/repositories/settings.ts). */
export const SETTINGS_CACHE_TAG = "settings";
