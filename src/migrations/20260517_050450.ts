import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_products_initial_variant_sale_type" AS ENUM('piece', 'box', 'lot');
  ALTER TABLE "products" ADD COLUMN "create_initial_variant" boolean DEFAULT false;
  ALTER TABLE "products" ADD COLUMN "initial_variant_sku" varchar;
  ALTER TABLE "products" ADD COLUMN "initial_variant_sale_type" "enum_products_initial_variant_sale_type" DEFAULT 'piece';
  ALTER TABLE "products" ADD COLUMN "initial_variant_units_per_package" numeric DEFAULT 1;
  ALTER TABLE "products" ADD COLUMN "initial_variant_price" numeric DEFAULT 0;
  ALTER TABLE "products" ADD COLUMN "initial_variant_stock" numeric DEFAULT 0;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "products" DROP COLUMN "create_initial_variant";
  ALTER TABLE "products" DROP COLUMN "initial_variant_sku";
  ALTER TABLE "products" DROP COLUMN "initial_variant_sale_type";
  ALTER TABLE "products" DROP COLUMN "initial_variant_units_per_package";
  ALTER TABLE "products" DROP COLUMN "initial_variant_price";
  ALTER TABLE "products" DROP COLUMN "initial_variant_stock";
  DROP TYPE "public"."enum_products_initial_variant_sale_type";`)
}
