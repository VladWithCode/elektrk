/**
 * sitemap.ts — ElektrK
 *
 * Next.js App Router sitemap route. Generated at build time.
 * See: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
 *
 * Includes:
 *   / (home), /products, /support, /products/[slug] × N
 *
 * Explicitly excludes (private / noindex):
 *   /admin, /api/*, /account/*, /cart, /checkout/*,
 *   /login, /register, /support/tickets
 *
 * Works with DATA_SOURCE="mock" — no DB or Neon required.
 *
 * TODO (Phase 11B — Payload live):
 *   getAllProductSlugs() will automatically switch to Payload data when
 *   DATA_SOURCE="payload". No changes needed here.
 */

import type { MetadataRoute } from "next";
import { getAllProductSlugs } from "@/lib/repositories/products";

const BASE_URL =
  (process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3000").replace(
    /\/$/,
    ""
  );

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // ---------------------------------------------------------------------------
  // Static public routes
  // ---------------------------------------------------------------------------

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/products`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/support`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  // ---------------------------------------------------------------------------
  // Dynamic product pages
  // ---------------------------------------------------------------------------

  let productRoutes: MetadataRoute.Sitemap = [];

  try {
    const slugs = await getAllProductSlugs();
    productRoutes = slugs.map((slug) => ({
      url: `${BASE_URL}/products/${slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));
  } catch {
    // Graceful degradation — sitemap still valid without product URLs
    console.warn("[sitemap] Could not load product slugs:", "getAllProductSlugs failed");
  }

  return [...staticRoutes, ...productRoutes];
}
