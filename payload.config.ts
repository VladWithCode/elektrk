import { buildConfig } from "payload";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { resendAdapter } from "@payloadcms/email-resend";
import { en } from "@payloadcms/translations/languages/en";
import { es } from "@payloadcms/translations/languages/es";
import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

// Collections
// NOTE: relative paths required — payload CLI runs under Node.js ESM which
// does not resolve TypeScript path aliases (@/) without a bundler.
import { Admins } from "./src/collections/Admins";
import { Addresses } from "./src/collections/Addresses";
import { Media } from "./src/collections/Media";
import { Products } from "./src/collections/Products";
import { Variants } from "./src/collections/Variants";
import { Orders } from "./src/collections/Orders";
import { OrderItems } from "./src/collections/OrderItems";
import { Tickets } from "./src/collections/Tickets";

// Globals
import { Settings } from "./src/globals/Settings";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

export default buildConfig({
  serverURL: process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000",
  cors: [process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000"],
  email: resendAdapter({
    defaultFromAddress: "onboarding@resend.dev",
    defaultFromName: "Distribuidor Electrico Monterrey Admin",
    apiKey: process.env.RESEND_API_KEY || "",
  }),

  admin: {
    user: Admins.slug, // "admins" — never "users" (reserved for Auth.js)
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },

  collections: [
    // Auth
    Admins,
    // Media
    Media,
    // Catalog
    Products,
    Variants,
    // Sales
    Orders,
    OrderItems,
    // Support
    Tickets,
    // Clientes
    Addresses,
  ],

  globals: [Settings],

  editor: lexicalEditor(),

  // DATABASE_URL_UNPOOLED: conexión directa (sin PgBouncer) para DDL migrations.
  // push: false — nunca auto-migrar; siempre usar `bun payload migrate` en Fase 4.
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL,
      max: 3,
    },
    push: false,
  }),

  secret: process.env.PAYLOAD_SECRET ?? "",

  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },

  upload: {
    limits: {
      fileSize: 10_000_000, // 10 MB
    },
  },

  // sharp is required by Payload for server-side image resizing (thumbnails,
  // focal-point crops, etc.). Without it Payload logs a warning on every build
  // and disables image optimisation in the admin media library.
  sharp,

  i18n: {
    supportedLanguages: { en, es },
    fallbackLanguage: "es",
  },
});
