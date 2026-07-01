import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Payment settings (§6.1) — bank details + instructions on the settings global.
 *
 *  settings (global):
 *    + payment_bank_name              varchar
 *    + payment_account_holder         varchar
 *    + payment_clabe                  varchar
 *    + payment_account_number         varchar
 *    + payment_payment_instructions   varchar   (textarea)
 *    + payment_pending_order_ttl_days numeric   (auto-expire TTL, §4.2)
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "settings" ADD COLUMN "payment_bank_name" varchar;
    ALTER TABLE "settings" ADD COLUMN "payment_account_holder" varchar;
    ALTER TABLE "settings" ADD COLUMN "payment_clabe" varchar;
    ALTER TABLE "settings" ADD COLUMN "payment_account_number" varchar;
    ALTER TABLE "settings" ADD COLUMN "payment_payment_instructions" varchar;
    ALTER TABLE "settings" ADD COLUMN "payment_pending_order_ttl_days" numeric;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "settings" DROP COLUMN IF EXISTS "payment_bank_name";
    ALTER TABLE "settings" DROP COLUMN IF EXISTS "payment_account_holder";
    ALTER TABLE "settings" DROP COLUMN IF EXISTS "payment_clabe";
    ALTER TABLE "settings" DROP COLUMN IF EXISTS "payment_account_number";
    ALTER TABLE "settings" DROP COLUMN IF EXISTS "payment_payment_instructions";
    ALTER TABLE "settings" DROP COLUMN IF EXISTS "payment_pending_order_ttl_days";
  `)
}
