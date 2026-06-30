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
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // --- orders: new columns ---
  await db.execute(sql`
    ALTER TABLE "orders" ADD COLUMN "order_number" varchar;
    ALTER TABLE "orders" ADD COLUMN "customer_customer_name" varchar;
    ALTER TABLE "orders" ADD COLUMN "shipping_name" varchar;
    ALTER TABLE "orders" ADD COLUMN "shipping_address" varchar;
    ALTER TABLE "orders" ADD COLUMN "shipping_city" varchar;
    ALTER TABLE "orders" ADD COLUMN "shipping_state" varchar;
    ALTER TABLE "orders" ADD COLUMN "shipping_postal_code" varchar;
    ALTER TABLE "orders" ADD COLUMN "shipping_phone" varchar;
    ALTER TABLE "orders" ADD COLUMN "notes" varchar;
  `)

  // --- orders: drop Stripe columns ---
  await db.execute(sql`
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "stripe_stripe_payment_intent_id";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "stripe_stripe_checkout_session_id";
  `)

  // --- order_items: variant label snapshot ---
  await db.execute(sql`
    ALTER TABLE "order_items" ADD COLUMN "variant_label_snapshot" varchar;
  `)

  // --- status enum: {pending,paid,failed,cancelled,fulfilled}
  //                → {pending,payment_pending,paid,fulfilled,cancelled} ---
  // Map any legacy "failed" rows to "cancelled" before recreating the type.
  await db.execute(sql`
    UPDATE "orders" SET "status" = 'cancelled' WHERE "status" = 'failed';

    ALTER TYPE "public"."enum_orders_status" RENAME TO "enum_orders_status_old";
    CREATE TYPE "public"."enum_orders_status" AS ENUM('pending', 'payment_pending', 'paid', 'fulfilled', 'cancelled');
    ALTER TABLE "orders" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TABLE "orders" ALTER COLUMN "status" TYPE "public"."enum_orders_status"
      USING "status"::text::"public"."enum_orders_status";
    ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'pending';
    DROP TYPE "public"."enum_orders_status_old";
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
    ALTER TABLE "orders" ADD COLUMN "stripe_stripe_payment_intent_id" varchar;
    ALTER TABLE "orders" ADD COLUMN "stripe_stripe_checkout_session_id" varchar;
  `)

  // Restore the original status enum
  await db.execute(sql`
    UPDATE "orders" SET "status" = 'pending' WHERE "status" = 'payment_pending';

    ALTER TYPE "public"."enum_orders_status" RENAME TO "enum_orders_status_old";
    CREATE TYPE "public"."enum_orders_status" AS ENUM('pending', 'paid', 'failed', 'cancelled', 'fulfilled');
    ALTER TABLE "orders" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TABLE "orders" ALTER COLUMN "status" TYPE "public"."enum_orders_status"
      USING "status"::text::"public"."enum_orders_status";
    ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'pending';
    DROP TYPE "public"."enum_orders_status_old";
  `)
}
