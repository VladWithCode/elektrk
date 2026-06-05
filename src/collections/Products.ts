import { type CollectionConfig, type CollectionAfterChangeHook, type CollectionBeforeChangeHook, type CollectionBeforeValidateHook, APIError } from "payload";
import { isAdmin } from "../lib/payload-access";
import { guardProductDelete } from "../lib/payload-delete-guards";
import { guardUniqueSlug } from "../lib/payload-unique-guards";
import { validateNumber } from "../lib/payload-validation-guards";

// ---------------------------------------------------------------------------
// beforeValidate hook — clearer validation messages
// ---------------------------------------------------------------------------

const validateProductFields: CollectionBeforeValidateHook = ({ data }) => {
  if (!data) return data;
  validateNumber(data.amperage, "El amperaje", 0);
  validateNumber(data.voltage, "El voltaje", 0);
  validateNumber(data.stock, "El stock", 0);
  return data;
};

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
// afterChange hook — create initial variant when flag is set
// ---------------------------------------------------------------------------

const createInitialVariantHook: CollectionAfterChangeHook = async ({
  doc,
  operation,
  req,
}) => {
  if (operation !== "create") return doc;
  if (!doc.createInitialVariant) return doc;
  if (req.context?.skipInitialVariantHook) return doc;

  const { payload } = req;

  const sku = typeof doc.initialVariantSku === "string" ? doc.initialVariantSku.trim() : "";
  const saleType = doc.initialVariantSaleType as "piece" | "box" | "lot" | undefined;
  const unitsPerPackage = Number(doc.initialVariantUnitsPerPackage ?? 1);
  const price = Number(doc.initialVariantPrice ?? 0);
  const stock = Number(doc.initialVariantStock ?? 0);

  if (!sku) throw new APIError("SKU de la variante inicial requerido.", 400);
  if (!saleType || !["piece", "box", "lot"].includes(saleType)) {
    throw new APIError("Tipo de presentación de la variante inicial inválido.", 400);
  }
  if (!Number.isFinite(price) || price < 0) {
    throw new APIError("Precio de la variante inicial debe ser >= 0.", 400);
  }
  if (!Number.isFinite(stock) || stock < 0) {
    throw new APIError("Stock de la variante inicial debe ser >= 0.", 400);
  }
  if (!Number.isFinite(unitsPerPackage) || unitsPerPackage < 1) {
    throw new APIError("Unidades por empaque debe ser >= 1.", 400);
  }

  const existing = await payload.find({
    collection: "variants",
    where: { sku: { equals: sku } },
    limit: 1,
    req,
  });
  if (existing.totalDocs > 0) {
    throw new APIError(`Ya existe una variante con SKU "${sku}".`, 400);
  }

  try {
    await payload.create({
      collection: "variants",
      data: {
        product: doc.id,
        sku,
        saleType,
        unitsPerPackage,
        price,
        stock,
        isActive: true,
      },
      req,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    throw new APIError(`No se pudo crear la variante inicial: ${msg}`, 400);
  }

  return doc;
};

// ---------------------------------------------------------------------------
// afterChange hook — cascade soft delete / restore to variants
// ---------------------------------------------------------------------------

const cascadeSoftDeleteToVariants: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  operation,
  req,
}) => {
  if (operation !== "update" || !previousDoc) return doc;

  const wasTrashed = !!previousDoc.deletedAt;
  const isTrashed = !!doc.deletedAt;

  if (wasTrashed === isTrashed) return doc;

  const { payload } = req;

  const variants = await payload.find({
    collection: "variants",
    where: { product: { equals: doc.id } },
    limit: 0,
    req,
  });

  for (const variant of variants.docs) {
    await payload.update({
      collection: "variants",
      id: variant.id,
      data: {
        isDeleted: isTrashed,
        deletedAt: isTrashed ? doc.deletedAt : null,
      },
      req,
    });
  }

  return doc;
};

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
    read: ({ req }) => {
      if (req.user?.collection === "admins") return true;
      return { isActive: { equals: true }, isDeleted: { not_equals: true } };
    },
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  timestamps: true,
  trash: true,
  hooks: {
    beforeValidate: [validateProductFields],
    beforeChange: [
      ({ data }) => {
        if (!data.slug && typeof data.name === "string" && data.name.trim()) {
          data.slug = slugifyText(data.name);
        }
        // Keep isDeleted in sync with deletedAt for trash support
        if (data.deletedAt && !data.isDeleted) {
          data.isDeleted = true;
        }
        if (!data.deletedAt && data.isDeleted) {
          data.isDeleted = false;
        }
        return data;
      },
      async ({ data, originalDoc, operation, req }) => {
        const slug = typeof data.slug === "string" ? data.slug.trim() : "";
        if (!slug) return data;
        const currentId = operation === "update" ? originalDoc?.id : undefined;
        await guardUniqueSlug(req, slug, currentId);
        return data;
      },
    ],
    beforeDelete: [
      async ({ id, req }) => {
        await guardProductDelete(req, id);
      },
    ],
    afterChange: [createInitialVariantHook, cascadeSoftDeleteToVariants],
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
                description:
                  "Aparece en la sección 'Productos destacados' de la página de inicio.",
              },
            },
            {
              name: "isDeleted",
              type: "checkbox",
              label: "Eliminado (soft delete)",
              defaultValue: false,
              admin: {
                description:
                  "Marcado como eliminado. El producto y sus variantes se ocultan del storefront " +
                  "pero se conservan para el historial de órdenes.",
                readOnly: true,
              },
            },
            {
              name: "deletedAt",
              type: "date",
              label: "Fecha de eliminación",
              admin: {
                description: "Fecha y hora en que se marcó como eliminado.",
                readOnly: true,
                condition: (data) => !!data.isDeleted,
              },
            },
          ],
        },

        // -------------------------------------------------------------------
        // Tab 6: Variante inicial (atajo de creación rápida)
        // -------------------------------------------------------------------
        {
          label: "Variante inicial",
          fields: [
            {
              name: "createInitialVariant",
              type: "checkbox",
              label: "Crear variante al guardar",
              defaultValue: false,
              admin: {
                description:
                  "Activa esta opción para crear automáticamente la primera variante de venta " +
                  "al guardar el producto. Se desactiva solo después de crearla. " +
                  "Si ya existe una variante con el mismo SKU, se omite.",
              },
            },
            {
              name: "initialVariantSku",
              type: "text",
              label: "SKU de la variante",
              admin: {
                description: "Código único. Ej. SIEM-5SL6110-7-PIE. Requerido si activas la creación.",
                condition: (data) => !!data.createInitialVariant,
              },
            },
            {
              name: "initialVariantSaleType",
              type: "select",
              label: "Tipo de presentación",
              options: [
                { label: "Pieza — unidad individual", value: "piece" },
                { label: "Caja — empaque con múltiples unidades", value: "box" },
                { label: "Lote — cantidad mayor con descuento", value: "lot" },
              ],
              defaultValue: "piece",
              admin: {
                condition: (data) => !!data.createInitialVariant,
              },
            },
            {
              name: "initialVariantUnitsPerPackage",
              type: "number",
              label: "Unidades por empaque",
              min: 1,
              defaultValue: 1,
              admin: {
                description: "Para pieza: 1. Para caja o lote: cantidad incluida en el precio.",
                condition: (data) => !!data.createInitialVariant,
              },
            },
            {
              name: "initialVariantPrice",
              type: "number",
              label: "Precio (MXN, IVA incluido)",
              min: 0,
              defaultValue: 0,
              admin: {
                description: "Precio de venta al público. Ej. 299.00",
                condition: (data) => !!data.createInitialVariant,
              },
            },
            {
              name: "initialVariantStock",
              type: "number",
              label: "Stock inicial",
              min: 0,
              defaultValue: 0,
              admin: {
                condition: (data) => !!data.createInitialVariant,
              },
            },
          ],
        },
      ],
    },
  ],
};
