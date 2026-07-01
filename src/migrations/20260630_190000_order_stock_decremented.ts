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
 * NOTE: the §9 order_number backfill is intentionally NOT here — it is an
 * operator-run, one-off step (20260630_whatsapp_orders already backfills that
 * column on apply). Keeping it out avoids a hard dependency on order_number.
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "orders" ADD COLUMN "stock_decremented" boolean DEFAULT false;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "stock_decremented";
  `)
}
