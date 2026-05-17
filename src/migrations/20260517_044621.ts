import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "addresses" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"customer_auth_id" varchar NOT NULL,
  	"customer_email" varchar NOT NULL,
  	"label" varchar NOT NULL,
  	"full_name" varchar NOT NULL,
  	"phone" varchar,
  	"address_line1" varchar NOT NULL,
  	"address_line2" varchar,
  	"city" varchar NOT NULL,
  	"state" varchar NOT NULL,
  	"postal_code" varchar NOT NULL,
  	"country" varchar DEFAULT 'MX' NOT NULL,
  	"is_default" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "admins" ALTER COLUMN "role" SET DEFAULT 'superadmin';
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "addresses_id" integer;
  CREATE INDEX "addresses_updated_at_idx" ON "addresses" USING btree ("updated_at");
  CREATE INDEX "addresses_created_at_idx" ON "addresses" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_addresses_fk" FOREIGN KEY ("addresses_id") REFERENCES "public"."addresses"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_addresses_id_idx" ON "payload_locked_documents_rels" USING btree ("addresses_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "addresses" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "addresses" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_addresses_fk";
  
  DROP INDEX "payload_locked_documents_rels_addresses_id_idx";
  ALTER TABLE "admins" ALTER COLUMN "role" SET DEFAULT 'editor';
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "addresses_id";`)
}
