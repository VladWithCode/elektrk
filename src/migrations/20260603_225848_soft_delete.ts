import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "settings" ALTER COLUMN "store_store_name" SET DEFAULT 'Distribuidor Electrico Monterrey';
  ALTER TABLE "products" ADD COLUMN "is_deleted" boolean DEFAULT false;
  ALTER TABLE "products" ADD COLUMN "deleted_at" timestamp(3) with time zone;
  ALTER TABLE "variants" ADD COLUMN "is_deleted" boolean DEFAULT false;
  ALTER TABLE "variants" ADD COLUMN "deleted_at" timestamp(3) with time zone;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "settings" ALTER COLUMN "store_store_name" SET DEFAULT 'ElektrK';
  ALTER TABLE "products" DROP COLUMN "is_deleted";
  ALTER TABLE "products" DROP COLUMN "deleted_at";
  ALTER TABLE "variants" DROP COLUMN "is_deleted";
  ALTER TABLE "variants" DROP COLUMN "deleted_at";`)
}
