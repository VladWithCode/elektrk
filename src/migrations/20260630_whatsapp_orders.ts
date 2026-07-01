import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * WhatsApp order flow — reverts the Stripe integration.
 *
 *  orders:
 *    + order_number (unique, indexed)         — human-friendly ref (ORD-000042)
 *    + customer_customer_name                 — buyer name
 *    + shipping_*                             — structured shipping address
 *    + notes                                  — buyer delivery notes
 *    - stripe_stripe_payment_intent_id        — Stripe removed
 *    - stripe_stripe_checkout_session_id      — Stripe removed
 *    ~ status enum: drop "failed", add "payment_pending" (manual flow)
 *
 *  order_items:
 *    + variant_label_snapshot                 — variant label at purchase time
 *
 * Idempotent / re-runnable: every column uses IF [NOT] EXISTS and the enum swap
 * is guarded so a partially-applied state can be reconciled by deleting this
 * migration's payload_migrations row and re-running `payload migrate`.
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // --- orders: new columns ---
  await db.execute(sql`
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "order_number" varchar;
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customer_customer_name" varchar;
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipping_name" varchar;
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipping_address" varchar;
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipping_city" varchar;
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipping_state" varchar;
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipping_postal_code" varchar;
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipping_phone" varchar;
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "notes" varchar;
  `)

  // --- orders: drop Stripe columns ---
  await db.execute(sql`
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "stripe_stripe_payment_intent_id";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "stripe_stripe_checkout_session_id";
  `)

  // --- order_items: variant label snapshot ---
  await db.execute(sql`
    ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "variant_label_snapshot" varchar;
  `)

  // --- status enum: {pending,paid,failed,cancelled,fulfilled}
  //                → {pending,payment_pending,paid,fulfilled,cancelled} ---
  // Guarded: only swap when "payment_pending" is not already a member, so a
  // re-run (or an already-migrated enum) is a no-op. Any stray _old type from a
  // prior failed run is dropped first.
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'enum_orders_status' AND e.enumlabel = 'payment_pending'
      ) THEN
        DROP TYPE IF EXISTS "public"."enum_orders_status_old";
        UPDATE "orders" SET "status" = 'cancelled' WHERE "status" = 'failed';
        ALTER TYPE "public"."enum_orders_status" RENAME TO "enum_orders_status_old";
        CREATE TYPE "public"."enum_orders_status" AS ENUM('pending', 'payment_pending', 'paid', 'fulfilled', 'cancelled');
        ALTER TABLE "orders" ALTER COLUMN "status" DROP DEFAULT;
        ALTER TABLE "orders" ALTER COLUMN "status" TYPE "public"."enum_orders_status"
          USING "status"::text::"public"."enum_orders_status";
        ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'pending';
        DROP TYPE "public"."enum_orders_status_old";
      END IF;
    END $$;
  `)

  // --- backfill order_number for existing rows, then enforce uniqueness ---
  await db.execute(sql`
    UPDATE "orders"
    SET "order_number" = 'ORD-' || lpad("id"::text, 6, '0')
    WHERE "order_number" IS NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS "orders_order_number_idx" ON "orders" ("order_number");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "orders_order_number_idx";

    ALTER TABLE "orders" DROP COLUMN IF EXISTS "order_number";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "customer_customer_name";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "shipping_name";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "shipping_address";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "shipping_city";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "shipping_state";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "shipping_postal_code";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "shipping_phone";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "notes";

    ALTER TABLE "order_items" DROP COLUMN IF EXISTS "variant_label_snapshot";
  `)

  // Restore Stripe columns
  await db.execute(sql`
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "stripe_stripe_payment_intent_id" varchar;
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "stripe_stripe_checkout_session_id" varchar;
  `)

  // Restore the original status enum — guarded so a re-run is a no-op.
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'enum_orders_status' AND e.enumlabel = 'payment_pending'
      ) THEN
        DROP TYPE IF EXISTS "public"."enum_orders_status_old";
        UPDATE "orders" SET "status" = 'pending' WHERE "status" = 'payment_pending';
        ALTER TYPE "public"."enum_orders_status" RENAME TO "enum_orders_status_old";
        CREATE TYPE "public"."enum_orders_status" AS ENUM('pending', 'paid', 'failed', 'cancelled', 'fulfilled');
        ALTER TABLE "orders" ALTER COLUMN "status" DROP DEFAULT;
        ALTER TABLE "orders" ALTER COLUMN "status" TYPE "public"."enum_orders_status"
          USING "status"::text::"public"."enum_orders_status";
        ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'pending';
        DROP TYPE "public"."enum_orders_status_old";
      END IF;
    END $$;
  `)
}
