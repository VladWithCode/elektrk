/**
 * pg_trgm fuzzy product search — ElektrK Phase 12B
 *
 * Uses PostgreSQL trigram similarity via @neondatabase/serverless with raw
 * parametrized SQL. Payload CMS does not expose similarity() / word_similarity()
 * operators, so this helper goes directly to Neon.
 *
 * Security:
 *   All user input is bound as a SQL parameter ($1, $2).
 *   No string interpolation of user-supplied data at any point.
 *
 * Column names are taken verbatim from the Drizzle migration
 * (src/migrations/20260515_173454.ts):
 *   products: id, name, brand, model, description,
 *             short_description, technical_summary, is_active
 *   variants:  id, product_id, sku, is_active
 *
 * Scoring strategy (GREATEST of all methods):
 *   • similarity(LOWER(col), LOWER(q))     — whole-string trigram sim  0–1
 *   • word_similarity(LOWER(q), LOWER(col))— q as sub-word of col     0–1
 *   • ILIKE '%q%' hit                      — substring boost            0.6
 *   • description ILIKE hit                — lower-weight substring     0.4
 *
 * Thresholds:
 *   similarity      > 0.15  (catches "schnider" → "Schneider", ~0.46)
 *   word_similarity > 0.20  (catches "breker"   → "breaker",   ~0.45)
 *
 * For queries shorter than 3 characters the trigram predicates are omitted
 * (not enough chars to form a meaningful trigram) and only ILIKE is used.
 */

import { Pool } from "@neondatabase/serverless";

export interface ProductSearchResult {
  /** Payload product ID as string (serial integer cast to text). */
  id: string;
  /**
   * Best relevance score across all matching methods, range 0–1.
   * 1.0 = exact match · 0.15 = minimum fuzzy threshold.
   */
  score: number;
}

// ---------------------------------------------------------------------------
// SQL fragments — assembled at call time, never from user input
// ---------------------------------------------------------------------------

/** Trigram similarity scoring expression used in SELECT and WHERE. */
const TRGM_SCORE_COLS = /* sql */ `
  similarity(LOWER(p.name),                           LOWER($1)),
  similarity(LOWER(p.brand),                          LOWER($1)),
  similarity(LOWER(p.model),                          LOWER($1)),
  similarity(LOWER(COALESCE(p.short_description,'')), LOWER($1)),
  similarity(LOWER(COALESCE(p.technical_summary,'')), LOWER($1)),
  word_similarity(LOWER($1), LOWER(p.name)),
  word_similarity(LOWER($1), LOWER(p.brand)),
  word_similarity(LOWER($1), LOWER(p.model))`;

/** Extra WHERE predicates that require trigrams (skipped for q.length < 3). */
const TRGM_WHERE = /* sql */ `
  OR similarity(LOWER(p.name),  LOWER($1)) > 0.15
  OR similarity(LOWER(p.brand), LOWER($1)) > 0.15
  OR similarity(LOWER(p.model), LOWER($1)) > 0.15
  OR word_similarity(LOWER($1), LOWER(p.name))  > 0.20
  OR word_similarity(LOWER($1), LOWER(p.brand)) > 0.20
  OR word_similarity(LOWER($1), LOWER(p.model)) > 0.20`;

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Runs a fuzzy trigram search against the `products` table in Neon.
 *
 * @param query  Raw user input — trimmed internally, never interpolated.
 * @param limit  Maximum number of results (default 200).
 * @returns      Products ordered by descending relevance, best-first.
 */
export async function searchProductsByTrigram(
  query: string,
  { limit = 200 }: { limit?: number } = {}
): Promise<ProductSearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "[products-search] DATABASE_URL is not set. " +
        "Add it to .env.local or set DATA_SOURCE=mock."
    );
  }

  // Trigram operators need at least 3 chars to produce any result.
  const useTrigram = q.length >= 3;

  // Build the SQL string from static fragments (no user input interpolated).
  const sql = /* sql */ `
    SELECT
      p.id::text AS id,
      GREATEST(
        ${useTrigram ? TRGM_SCORE_COLS + "," : ""}
        CASE WHEN p.name              ILIKE '%' || $1 || '%' THEN 0.6 ELSE 0 END,
        CASE WHEN p.brand             ILIKE '%' || $1 || '%' THEN 0.6 ELSE 0 END,
        CASE WHEN p.model             ILIKE '%' || $1 || '%' THEN 0.6 ELSE 0 END,
        CASE WHEN p.description       ILIKE '%' || $1 || '%' THEN 0.4 ELSE 0 END,
        CASE WHEN COALESCE(p.short_description,'') ILIKE '%' || $1 || '%' THEN 0.3 ELSE 0 END,
        CASE WHEN COALESCE(p.technical_summary,'') ILIKE '%' || $1 || '%' THEN 0.3 ELSE 0 END
      ) AS score
    FROM products p
    WHERE
      p.is_active = true
      AND (p.is_deleted IS NULL OR p.is_deleted = false)
      AND (
        p.name                              ILIKE '%' || $1 || '%'
        OR p.brand                          ILIKE '%' || $1 || '%'
        OR p.model                          ILIKE '%' || $1 || '%'
        OR p.description                    ILIKE '%' || $1 || '%'
        OR COALESCE(p.short_description,'') ILIKE '%' || $1 || '%'
        OR COALESCE(p.technical_summary,'') ILIKE '%' || $1 || '%'
        OR EXISTS (
          SELECT 1 FROM variants v
          WHERE  v.product_id = p.id
            AND  v.is_active  = true
            AND  (v.is_deleted IS NULL OR v.is_deleted = false)
            AND  v.sku        ILIKE '%' || $1 || '%'
        )
        ${useTrigram ? TRGM_WHERE : ""}
      )
    ORDER BY score DESC
    LIMIT $2
  `;

  const pool = new Pool({ connectionString });
  try {
    const result = await pool.query<{ id: string; score: number }>(sql, [q, limit]);
    return result.rows;
  } finally {
    await pool.end();
  }
}
