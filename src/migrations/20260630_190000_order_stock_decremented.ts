import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Stock bookkeeping flag (§4.1).
 *
 *  orders:
 *    + stock_decremented boolean DEFAULT false
 *
 * The Orders afterChange hook sets this true when an order is confirmed paid
 * (and decrements stock) and false when a paid order is cancelled (restoring
 * stock), so stock is never double-counted across manual status toggles.
 *
 * Also runs the operational order-number backfill (§9) — idempotent, only
 * touches rows whose order_number is still null.
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "orders" ADD COLUMN "stock_decremented" boolean DEFAULT false;
  `)

  await db.execute(sql`
    UPDATE "orders"
    SET "order_number" = 'ORD-' || lpad("id"::text, 6, '0')
    WHERE "order_number" IS NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "stock_decremented";
  `)
}
