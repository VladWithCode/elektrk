import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Checkout idempotency (§2.4).
 *
 *  orders:
 *    + idempotency_key varchar + UNIQUE index
 *
 * The checkout client generates a UUID once per mount and sends it with the
 * submit; createOrder returns the existing order for a repeated key instead of
 * creating a duplicate. The unique index allows many NULLs (legacy orders).
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "orders" ADD COLUMN "idempotency_key" varchar;
    CREATE UNIQUE INDEX IF NOT EXISTS "orders_idempotency_key_idx" ON "orders" ("idempotency_key");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "orders_idempotency_key_idx";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "idempotency_key";
  `)
}
