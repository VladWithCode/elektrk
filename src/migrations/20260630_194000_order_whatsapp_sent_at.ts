import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * WhatsApp hand-off timestamp (§7.1).
 *
 *  orders:
 *    + whatsapp_sent_at timestamptz
 *
 * Recorded when the customer re-opens the pre-filled WhatsApp message from their
 * order detail page, so the admin can see whether contact was initiated.
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "orders" ADD COLUMN "whatsapp_sent_at" timestamp(3) with time zone;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "whatsapp_sent_at";
  `)
}
