import { buildConfig } from "payload";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { resendAdapter } from "@payloadcms/email-resend";
import { uploadthingStorage } from "@payloadcms/storage-uploadthing";
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

// Endpoints
import { importCatalogEndpoints } from "./src/endpoints/import-catalog";

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
    components: {
      afterNavLinks: [
        "/src/components/import-catalog/ImportCatalogNavLink#ImportCatalogNavLink",
      ],
      views: {
        importCatalog: {
          Component:
            "/src/components/import-catalog/ImportCatalogView#ImportCatalogView",
          path: "/import-products",
        },
      },
    },
  },

  endpoints: importCatalogEndpoints,

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

  plugins: [
    uploadthingStorage({
      enabled: Boolean(process.env.UPLOADTHING_TOKEN),
      collections: {
        media: true,
      },
      // Server-side uploads. With clientUploads:true the browser uploaded the
      // original file straight to UploadThing but its returned key was never
      // persisted to media._key → the original 404'd everywhere (local + prod)
      // and product images never rendered. Server-side upload populates _key
      // (and every image-size key) reliably on Node (production) and on the
      // Next dev-server runtime.
      clientUploads: false,
      options: {
        token: process.env.UPLOADTHING_TOKEN,
        acl: "public-read",
      },
    }),
  ],

  i18n: {
    supportedLanguages: { en, es },
    fallbackLanguage: "es",
  },

  hooks: {
    afterError: [
      ({ error, collection }) => {
        // Detectar violaciones de foreign key de Postgres (SQLSTATE 23503)
        if (
          (error as any)?.code === "23503" ||
          error?.message?.includes("foreign key constraint")
        ) {
          return {
            response: {
              errors: [
                {
                  message:
                    "No se puede eliminar este documento porque otros registros aún lo utilizan. Elimina las referencias primero.",
                },
              ],
            },
            status: 409,
          };
        }

        // Detectar violaciones de unique constraint de Postgres (SQLSTATE 23505)
        if (
          (error as any)?.code === "23505" ||
          error?.message?.includes("duplicate key") ||
          error?.message?.includes("unique constraint")
        ) {
          const collectionName = collection?.slug;
          let message: string;
          switch (collectionName) {
            case "products":
              message =
                "Ya existe un producto con ese mismo slug. Usa un slug diferente.";
              break;
            case "variants":
              message =
                "Ya existe una variante con ese mismo SKU. Usa un SKU diferente.";
              break;
            case "admins":
              message =
                "Ya existe un administrador con ese mismo email. Usa un email diferente.";
              break;
            default:
              message =
                "Ya existe un registro con ese mismo valor. Verifica que no estés duplicando un slug, SKU o email.";
              break;
          }
          return {
            response: {
              errors: [{ message }],
            },
            status: 409,
          };
        }

        // Detectar errores de validación de campos (AJV / schema)
        const errorMsg = error?.message?.toLowerCase() ?? "";
        if (errorMsg.includes("must have required property") || errorMsg.includes("is required")) {
          return {
            response: {
              errors: [
                {
                  message:
                    "Faltan campos obligatorios. Verifica que todos los campos requeridos estén completos.",
                },
              ],
            },
            status: 400,
          };
        }
        if (
          errorMsg.includes("must be greater than or equal to") ||
          errorMsg.includes("must be less than or equal to") ||
          errorMsg.includes("validation:lessThanMin") ||
          errorMsg.includes("validation:greaterThanMax")
        ) {
          return {
            response: {
              errors: [
                {
                  message:
                    "Algunos valores numéricos están fuera de rango. Verifica los límites mínimos y máximos.",
                },
              ],
            },
            status: 400,
          };
        }
        if (
          errorMsg.includes("must be shorter than") ||
          errorMsg.includes("must be longer than") ||
          errorMsg.includes("validation:shorterThanMax") ||
          errorMsg.includes("validation:longerThanMin")
        ) {
          return {
            response: {
              errors: [
                {
                  message:
                    "Algunos campos de texto exceden la longitud permitida o son demasiado cortos.",
                },
              ],
            },
            status: 400,
          };
        }
        if (errorMsg.includes("must be number") || errorMsg.includes("validation:enterNumber")) {
          return {
            response: {
              errors: [
                {
                  message:
                    "Algunos campos deben ser números. Verifica que no hayas ingresado texto en campos numéricos.",
                },
              ],
            },
            status: 400,
          };
        }
        if (errorMsg.includes("email") && errorMsg.includes("invalid")) {
          return {
            response: {
              errors: [
                {
                  message:
                    "El email ingresado no es válido. Verifica el formato.",
                },
              ],
            },
            status: 400,
          };
        }

        // Detectar errores de upload (tamaño, tipo, procesamiento, UploadThing)
        if (
          errorMsg.includes("file size limit has been reached") ||
          errorMsg.includes("request entity too large") ||
          errorMsg.includes("payload too large")
        ) {
          return {
            response: {
              errors: [
                {
                  message:
                    "El archivo excede el límite de 10 MB. Sube un archivo más pequeño.",
                },
              ],
            },
            status: 413,
          };
        }
        if (
          errorMsg.includes("file type") &&
          (errorMsg.includes("not allowed") ||
            errorMsg.includes("restricted file type"))
        ) {
          return {
            response: {
              errors: [
                {
                  message:
                    "Tipo de archivo no permitido. Solo se aceptan imágenes (JPEG, PNG, WebP, SVG) y PDFs.",
                },
              ],
            },
            status: 400,
          };
        }
        if (errorMsg.includes("invalid mime type")) {
          return {
            response: {
              errors: [
                {
                  message:
                    "Tipo de archivo no permitido. Solo se aceptan imágenes (JPEG, PNG, WebP, SVG) y PDFs.",
                },
              ],
            },
            status: 400,
          };
        }
        if (errorMsg.includes("svg file contains potentially harmful content")) {
          return {
            response: {
              errors: [
                {
                  message:
                    "El archivo SVG contiene contenido potencialmente peligroso. Verifica el archivo.",
                },
              ],
            },
            status: 400,
          };
        }
        if (
          errorMsg.includes("invalid pdf") ||
          errorMsg.includes("invalid or corrupted pdf")
        ) {
          return {
            response: {
              errors: [
                {
                  message:
                    "El archivo PDF está corrupto o es inválido. Verifica el archivo.",
                },
              ],
            },
            status: 400,
          };
        }
        if (errorMsg.includes("error uploading file with uploadthing")) {
          return {
            response: {
              errors: [
                {
                  message:
                    "Error al subir el archivo al servidor. Inténtalo de nuevo o contacta soporte.",
                },
              ],
            },
            status: 500,
          };
        }
        if (errorMsg.includes("error uploading file")) {
          return {
            response: {
              errors: [
                {
                  message:
                    "Error al subir el archivo. Inténtalo de nuevo o contacta soporte.",
                },
              ],
            },
            status: 500,
          };
        }
        if (errorMsg.includes("sharp")) {
          return {
            response: {
              errors: [
                {
                  message:
                    "Error al procesar la imagen. Verifica que el archivo no esté corrupto.",
                },
              ],
            },
            status: 400,
          };
        }

        // Otros errores: no interceptar, dejar que Payload maneje normalmente
        return undefined;
      },
    ],
  },
});
