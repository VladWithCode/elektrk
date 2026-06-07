import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_products_category" AS ENUM('interruptores', 'gabinetes_tableros', 'unicanal', 'fijacion', 'soporteria', 'herramientas_accesorios');
  CREATE TYPE "public"."enum_products_mounting_type" AS ENUM('iline', 'screw');
  CREATE TYPE "public"."enum_products_board_type" AS ENUM('nf', 'nq', 'iline', 'autosoportado', 'gabinete');
  CREATE TYPE "public"."enum_products_nema_rating" AS ENUM('1', '3r');
  CREATE TYPE "public"."enum_products_enclosure_use" AS ENUM('interior', 'intemperie');
  CREATE TYPE "public"."enum_products_channel_type" AS ENUM('solido', 'perforado');
  CREATE TYPE "public"."enum_products_gauge" AS ENUM('14', '16', '18');
  -- Backfill: existing free-text categories are not valid enum literals.
  -- Map any non-matching/empty value to 'interruptores' so the enum cast below
  -- succeeds without dropping rows. No data is deleted.
  UPDATE "products" SET "category" = 'interruptores'
    WHERE "category" IS NULL
       OR "category" NOT IN ('interruptores', 'gabinetes_tableros', 'unicanal', 'fijacion', 'soporteria', 'herramientas_accesorios');
  ALTER TABLE "products" ALTER COLUMN "category" SET DATA TYPE "public"."enum_products_category" USING "category"::"public"."enum_products_category";
  ALTER TABLE "products" ALTER COLUMN "category" SET DEFAULT 'interruptores'::"public"."enum_products_category";
  ALTER TABLE "products" ALTER COLUMN "amperage" DROP NOT NULL;
  ALTER TABLE "products" ALTER COLUMN "poles" DROP NOT NULL;
  ALTER TABLE "products" ALTER COLUMN "voltage" DROP NOT NULL;
  ALTER TABLE "products" ALTER COLUMN "trip_curve" DROP NOT NULL;
  ALTER TABLE "products" ALTER COLUMN "stock" DROP NOT NULL;
  ALTER TABLE "products" ADD COLUMN "product_line" varchar;
  ALTER TABLE "products" ADD COLUMN "interrupting_capacity" numeric;
  ALTER TABLE "products" ADD COLUMN "mounting_type" "enum_products_mounting_type";
  ALTER TABLE "products" ADD COLUMN "breaker_type" varchar;
  ALTER TABLE "products" ADD COLUMN "frame" varchar;
  ALTER TABLE "products" ADD COLUMN "board_type" "enum_products_board_type";
  ALTER TABLE "products" ADD COLUMN "nema_rating" "enum_products_nema_rating";
  ALTER TABLE "products" ADD COLUMN "amperage_capacity" numeric;
  ALTER TABLE "products" ADD COLUMN "enclosure_use" "enum_products_enclosure_use";
  ALTER TABLE "products" ADD COLUMN "spaces" numeric;
  ALTER TABLE "products" ADD COLUMN "circuits" numeric;
  ALTER TABLE "products" ADD COLUMN "compatible_breaker_line" varchar;
  ALTER TABLE "products" ADD COLUMN "channel_type" "enum_products_channel_type";
  ALTER TABLE "products" ADD COLUMN "gauge" "enum_products_gauge";
  ALTER TABLE "products" ADD COLUMN "dimensions" varchar;
  ALTER TABLE "products" ADD COLUMN "length" varchar;
  ALTER TABLE "products" ADD COLUMN "finish" varchar;
  ALTER TABLE "products" ADD COLUMN "custom_length_available" boolean DEFAULT false;
  ALTER TABLE "products" ADD COLUMN "anchor_type" varchar;
  ALTER TABLE "products" ADD COLUMN "box_quantity" numeric;
  ALTER TABLE "products" ADD COLUMN "support_type" varchar;
  ALTER TABLE "products" ADD COLUMN "compatible_with_unicanal" boolean DEFAULT false;
  ALTER TABLE "products" ADD COLUMN "accessory_type" varchar;
  ALTER TABLE "products" ADD COLUMN "compatible_tool" varchar;
  ALTER TABLE "products" ADD COLUMN "application" varchar;
  ALTER TABLE "products" ADD COLUMN "presentation" varchar;
  ALTER TABLE "products" ADD COLUMN "material" varchar;
  ALTER TABLE "products" ADD COLUMN "dim_diameter" varchar;
  ALTER TABLE "products" ADD COLUMN "dim_length" varchar;
  ALTER TABLE "variants" ADD COLUMN "variant_spec" varchar;
  ALTER TABLE "variants" ADD COLUMN "presentation" varchar;
  ALTER TABLE "variants" ADD COLUMN "unit_label" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "products" ALTER COLUMN "category" SET DATA TYPE varchar;
  ALTER TABLE "products" ALTER COLUMN "category" DROP DEFAULT;
  ALTER TABLE "products" ALTER COLUMN "stock" SET NOT NULL;
  ALTER TABLE "products" ALTER COLUMN "amperage" SET NOT NULL;
  ALTER TABLE "products" ALTER COLUMN "poles" SET NOT NULL;
  ALTER TABLE "products" ALTER COLUMN "voltage" SET NOT NULL;
  ALTER TABLE "products" ALTER COLUMN "trip_curve" SET NOT NULL;
  ALTER TABLE "products" DROP COLUMN "product_line";
  ALTER TABLE "products" DROP COLUMN "interrupting_capacity";
  ALTER TABLE "products" DROP COLUMN "mounting_type";
  ALTER TABLE "products" DROP COLUMN "breaker_type";
  ALTER TABLE "products" DROP COLUMN "frame";
  ALTER TABLE "products" DROP COLUMN "board_type";
  ALTER TABLE "products" DROP COLUMN "nema_rating";
  ALTER TABLE "products" DROP COLUMN "amperage_capacity";
  ALTER TABLE "products" DROP COLUMN "enclosure_use";
  ALTER TABLE "products" DROP COLUMN "spaces";
  ALTER TABLE "products" DROP COLUMN "circuits";
  ALTER TABLE "products" DROP COLUMN "compatible_breaker_line";
  ALTER TABLE "products" DROP COLUMN "channel_type";
  ALTER TABLE "products" DROP COLUMN "gauge";
  ALTER TABLE "products" DROP COLUMN "dimensions";
  ALTER TABLE "products" DROP COLUMN "length";
  ALTER TABLE "products" DROP COLUMN "finish";
  ALTER TABLE "products" DROP COLUMN "custom_length_available";
  ALTER TABLE "products" DROP COLUMN "anchor_type";
  ALTER TABLE "products" DROP COLUMN "box_quantity";
  ALTER TABLE "products" DROP COLUMN "support_type";
  ALTER TABLE "products" DROP COLUMN "compatible_with_unicanal";
  ALTER TABLE "products" DROP COLUMN "accessory_type";
  ALTER TABLE "products" DROP COLUMN "compatible_tool";
  ALTER TABLE "products" DROP COLUMN "application";
  ALTER TABLE "products" DROP COLUMN "presentation";
  ALTER TABLE "products" DROP COLUMN "material";
  ALTER TABLE "products" DROP COLUMN "dim_diameter";
  ALTER TABLE "products" DROP COLUMN "dim_length";
  ALTER TABLE "variants" DROP COLUMN "variant_spec";
  ALTER TABLE "variants" DROP COLUMN "presentation";
  ALTER TABLE "variants" DROP COLUMN "unit_label";
  DROP TYPE "public"."enum_products_category";
  DROP TYPE "public"."enum_products_mounting_type";
  DROP TYPE "public"."enum_products_board_type";
  DROP TYPE "public"."enum_products_nema_rating";
  DROP TYPE "public"."enum_products_enclosure_use";
  DROP TYPE "public"."enum_products_channel_type";
  DROP TYPE "public"."enum_products_gauge";`)
}
