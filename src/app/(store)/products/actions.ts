"use server";

/**
 * Product search Server Action — /products (Phase 12B)
 *
 * Called from CatalogClient when the user types in the search box.
 * Delegates to the products repository which runs pg_trgm against Neon.
 *
 * Returns products ranked by similarity score (best-first).
 * An empty query returns all active products (unranked).
 */

import { searchProducts, getProducts } from "@/lib/repositories/products";
import type { Product } from "@/types/product";

export async function searchProductsAction(query: string): Promise<Product[]> {
  const q = query.trim();
  if (!q) return getProducts();
  return searchProducts(q);
}
