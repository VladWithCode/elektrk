/**
 * robots.ts — ElektrK
 *
 * Next.js App Router robots.txt route.
 * See: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots
 *
 * Allows public storefront routes.
 * Blocks private, transactional, and admin routes from crawlers.
 */

import type { MetadataRoute } from "next";

const BASE_URL =
  (process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3000").replace(
    /\/$/,
    ""
  );

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/products",
          "/products/",
          "/support",
        ],
        disallow: [
          "/admin",
          "/admin/",
          "/api/",
          "/account",
          "/account/",
          "/cart",
          "/checkout",
          "/checkout/",
          "/login",
          "/register",
          "/support/tickets",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
