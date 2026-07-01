import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Per-proof review state (§2.1).
 *
 *  orders_payment_proofs:
 *    + review_status enum('pending','accepted','rejected') DEFAULT 'pending'
 *    + review_note   varchar   (admin reason, shown to the customer)
 *
 * Moves review semantics off the order status (which stays admin-meaningful)
 * and onto each individual proof.
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_orders_payment_proofs_review_status" AS ENUM('pending', 'accepted', 'rejected');

    ALTER TABLE "orders_payment_proofs" ADD COLUMN "review_status" "enum_orders_payment_proofs_review_status" DEFAULT 'pending';
    ALTER TABLE "orders_payment_proofs" ADD COLUMN "review_note" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "orders_payment_proofs" DROP COLUMN IF EXISTS "review_status";
    ALTER TABLE "orders_payment_proofs" DROP COLUMN IF EXISTS "review_note";
    DROP TYPE IF EXISTS "public"."enum_orders_payment_proofs_review_status";
  `)
}
