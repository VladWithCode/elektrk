import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Payment proofs — receipts attached to an order.
 *
 * Orders gains a `paymentProofs` array field (file + uploadedBy + uploadedAt).
 * Payload stores arrays in a dedicated table `orders_payment_proofs` with the
 * usual `_order` / `_parent_id` columns and a varchar row `id`.
 *
 * DDL mirrors what the Payload postgres adapter generates for this field so the
 * runtime schema and the database stay in sync.
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_orders_payment_proofs_uploaded_by" AS ENUM('customer', 'admin');

    CREATE TABLE "orders_payment_proofs" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "file_id" integer NOT NULL,
      "uploaded_by" "enum_orders_payment_proofs_uploaded_by" DEFAULT 'admin',
      "uploaded_at" timestamp(3) with time zone
    );

    ALTER TABLE "orders_payment_proofs" ADD CONSTRAINT "orders_payment_proofs_file_id_media_id_fk"
      FOREIGN KEY ("file_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "orders_payment_proofs" ADD CONSTRAINT "orders_payment_proofs_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;

    CREATE INDEX "orders_payment_proofs_order_idx" ON "orders_payment_proofs" USING btree ("_order");
    CREATE INDEX "orders_payment_proofs_parent_id_idx" ON "orders_payment_proofs" USING btree ("_parent_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "orders_payment_proofs";
    DROP TYPE IF EXISTS "public"."enum_orders_payment_proofs_uploaded_by";
  `)
}
