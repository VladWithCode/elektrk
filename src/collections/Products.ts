import type { CollectionConfig } from "payload";
import { isAdmin, isAdminOrActive } from "../lib/payload-access";

// ---------------------------------------------------------------------------
// Slug generation helper
// ---------------------------------------------------------------------------

function slugifyText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")   // strip accent marks
    .replace(/[^a-z0-9\s-]/g, "")      // remove non-alphanumeric
    .trim()
    .replace(/\s+/g, "-")              // spaces → hyphens
    .replace(/-+/g, "-");              // collapse consecutive hyphens
}

// ---------------------------------------------------------------------------
// Collection
// ---------------------------------------------------------------------------

export const Products: CollectionConfig = {
  slug: "products",
  labels: { singular: "Producto", plural: "Productos" },
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "brand", "amperage", "poles", "tripCurve", "isActive", "featured"],
    group: "Catálogo",
    description: "Catálogo de interruptores termomagnéticos y componentes eléctricos.",
  },
  access: {
    read: isAdminOrActive,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  timestamps: true,
  hooks: {
    beforeChange: [
      ({ data }) => {
        // Auto-generate slug from name when creating without an explicit slug
        if (!data.slug && typeof data.name === "string" && data.name.trim()) {
          data.slug = slugifyText(data.name);
        }
        return data;
      },
    ],
  },
  fields: [
    // -------------------------------------------------------------------------
    // Tabs — organises the admin form into sections
    // -------------------------------------------------------------------------
    {
      type: "tabs",
      tabs: [
        // -------------------------------------------------------------------
        // Tab 1: Información general
        // -------------------------------------------------------------------
        {
          label: "Información general",
          fields: [
            {
              name: "name",
              type: "text",
              label: "Nombre del producto",
              required: true,
              admin: {
                description: "Nombre completo que aparece en el catálogo y en el detalle.",
              },
            },
            {
              name: "slug",
              type: "text",
              label: "Slug (URL)",
              required: true,
              unique: true,
              admin: {
                description:
                  "Generado automáticamente desde el nombre. Solo minúsculas, números y guiones. " +
                  "Cambiar después de publicar puede romper enlaces existentes.",
              },
            },
            {
              name: "brand",
              type: "text",
              label: "Marca",
              required: true,
              admin: {
                description: "Ej. Siemens, ABB, Schneider Electric.",
              },
            },
            {
              name: "model",
              type: "text",
              label: "Modelo / Referencia",
              required: true,
              admin: {
                description: "Código exacto del fabricante. Ej. 5SL6110-7.",
              },
            },
            {
              name: "category",
              type: "text",
              label: "Categoría",
              required: true,
              admin: {
                description: "Ej. Interruptores Termomagnéticos, Protecciones Industriales.",
              },
            },
            {
              name: "shortDescription",
              type: "text",
              label: "Descripción corta",
              admin: {
                description: "Máx. 120 caracteres. Aparece en tarjetas del catálogo.",
              },
            },
            {
              name: "description",
              type: "textarea",
              label: "Descripción completa",
              required: true,
              admin: {
                description: "Descripción detallada para la página de detalle del producto.",
              },
            },
            {
              name: "technicalSummary",
              type: "textarea",
              label: "Resumen técnico",
              admin: {
                description:
                  "Características técnicas adicionales: capacidad de ruptura, normas, temperatura de operación, etc.",
              },
            },
            {
              name: "tags",
              type: "array",
              label: "Etiquetas",
              admin: {
                description: "Palabras clave para búsqueda interna. Ej. industrial, residencial, riel DIN.",
              },
              fields: [
                {
                  name: "tag",
                  type: "text",
                  label: "Etiqueta",
                  required: true,
                },
              ],
            },
          ],
        },

        // -------------------------------------------------------------------
        // Tab 2: Especificaciones técnicas
        // -------------------------------------------------------------------
        {
          label: "Especificaciones",
          fields: [
            {
              name: "amperage",
              type: "number",
              label: "Amperaje (A)",
              required: true,
              min: 0,
              admin: {
                description: "Corriente nominal en Amperes. Ej. 10, 16, 25, 63.",
              },
            },
            {
              name: "poles",
              type: "select",
              label: "Número de polos",
              required: true,
              options: [
                { label: "1 polo  — monofásico", value: "1" },
                { label: "2 polos — bifásico", value: "2" },
                { label: "3 polos — trifásico", value: "3" },
                { label: "4 polos — trifásico + neutro", value: "4" },
              ],
            },
            {
              name: "voltage",
              type: "number",
              label: "Voltaje (V)",
              required: true,
              min: 0,
              admin: {
                description: "Tensión nominal de operación. Ej. 120, 240, 380, 480.",
              },
            },
            {
              name: "tripCurve",
              type: "select",
              label: "Curva de disparo",
              required: true,
              options: [
                { label: "Curva B — protección de líneas (3–5× In)", value: "B" },
                { label: "Curva C — uso general (5–10× In)", value: "C" },
                { label: "Curva D — motores y transformadores (10–20× In)", value: "D" },
              ],
            },
            {
              name: "stock",
              type: "number",
              label: "Stock total disponible",
              required: true,
              min: 0,
              defaultValue: 0,
              admin: {
                description: "Suma de todas las variantes. Actualizar manualmente o via webhook de inventario.",
              },
            },
          ],
        },

        // -------------------------------------------------------------------
        // Tab 3: Media
        // -------------------------------------------------------------------
        {
          label: "Media",
          fields: [
            {
              name: "images",
              type: "array",
              label: "Imágenes del producto",
              admin: {
                description: "Subir en Media (documentType: Imagen de producto) antes de seleccionar aquí.",
              },
              fields: [
                {
                  name: "image",
                  type: "relationship",
                  relationTo: "media",
                  label: "Imagen",
                  required: true,
                  filterOptions: {
                    documentType: { equals: "image" },
                  },
                },
              ],
            },
            {
              name: "datasheet",
              type: "relationship",
              relationTo: "media",
              label: "Ficha técnica (PDF)",
              admin: {
                description: "Subir en Media (documentType: Ficha técnica / Datasheet) antes de seleccionar.",
              },
              filterOptions: {
                documentType: { equals: "datasheet" },
              },
            },
            // Virtual join — populated by Payload from Variants collection
            {
              name: "variants",
              type: "join",
              collection: "variants",
              on: "product",
              label: "Variantes de venta",
              admin: {
                description: "Las variantes se gestionan desde la colección Variantes.",
              },
            },
          ],
        },

        // -------------------------------------------------------------------
        // Tab 4: SEO
        // -------------------------------------------------------------------
        {
          label: "SEO",
          fields: [
            {
              name: "metaTitle",
              type: "text",
              label: "Título SEO",
              admin: {
                description: "Si se deja vacío, se usa el nombre del producto. Máx. 60 caracteres recomendado.",
              },
            },
            {
              name: "metaDescription",
              type: "textarea",
              label: "Descripción SEO",
              admin: {
                description:
                  "Si se deja vacía, se usa la descripción completa truncada. Máx. 160 caracteres recomendado.",
              },
            },
            {
              name: "metaImage",
              type: "relationship",
              relationTo: "media",
              label: "Imagen Open Graph / Social",
              admin: {
                description: "Imagen que aparece al compartir en redes sociales. Recomendado: 1200×630 px.",
              },
            },
          ],
        },

        // -------------------------------------------------------------------
        // Tab 5: Estado y visibilidad
        // -------------------------------------------------------------------
        {
          label: "Estado",
          fields: [
            {
              name: "isActive",
              type: "checkbox",
              label: "Producto activo",
              defaultValue: true,
              admin: {
                description:
                  "Desactivar para ocultar el producto del storefront sin eliminarlo. " +
                  "Los admins siempre pueden verlo.",
              },
            },
            {
              name: "featured",
              type: "checkbox",
              label: "Destacado en home",
              defaultValue: false,
              admin: {
                description: "Aparece en la sección 'Productos destacados' de la página de inicio.",
              },
            },
          ],
        },
      ],
    },
  ],
};
