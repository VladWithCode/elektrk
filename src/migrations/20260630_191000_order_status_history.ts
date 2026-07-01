import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Order status history (§2.3) — append-only audit trail.
 *
 * Orders gains a `statusHistory` array field. Payload stores arrays in a
 * dedicated table with the usual `_order` / `_parent_id` columns and a varchar
 * row `id`. The `status` select generates a dedicated enum type; `changedBy`
 * and `note` are plain varchar.
 *
 * DDL mirrors what the Payload postgres adapter generates for this field
 * (see 20260630_182000_payment_proofs for the array-table pattern).
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_orders_status_history_status" AS ENUM('pending', 'payment_pending', 'paid', 'fulfilled', 'cancelled');

    CREATE TABLE "orders_status_history" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "status" "enum_orders_status_history_status",
      "changed_at" timestamp(3) with time zone,
      "changed_by" varchar,
      "note" varchar
    );

    ALTER TABLE "orders_status_history" ADD CONSTRAINT "orders_status_history_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;

    CREATE INDEX "orders_status_history_order_idx" ON "orders_status_history" USING btree ("_order");
    CREATE INDEX "orders_status_history_parent_id_idx" ON "orders_status_history" USING btree ("_parent_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "orders_status_history";
    DROP TYPE IF EXISTS "public"."enum_orders_status_history_status";
  `)
}
