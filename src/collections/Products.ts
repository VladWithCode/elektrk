import { type CollectionConfig, type CollectionAfterChangeHook, type CollectionAfterDeleteHook, type CollectionBeforeValidateHook, APIError } from "payload";
import { revalidatePath } from "next/cache";
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
// afterChange / afterDelete hook — revalidate storefront pages
//
// Detail (/products/[slug]) and catalog (/products) pages are statically
// generated. Without this, CMS edits (e.g. a newly uploaded product image)
// would not appear until the next redeploy — the exact cause of products
// rendering the "no image" placeholder despite having images in the CMS.
// ---------------------------------------------------------------------------

function revalidateStorefront(slugs: Array<string | null | undefined>) {
  try {
    for (const slug of new Set(slugs)) {
      if (typeof slug === "string" && slug.trim()) {
        revalidatePath(`/products/${slug}`);
      }
    }
    revalidatePath("/products");
    revalidatePath("/");
  } catch {
    // revalidatePath throws outside a Next request/render context
    // (e.g. Payload CLI migrations/seeds). Safe to ignore there.
  }
}

const revalidateOnChange: CollectionAfterChangeHook = ({ doc, previousDoc }) => {
  // Include previousDoc.slug so a slug rename revalidates the old path too.
  revalidateStorefront([doc?.slug, previousDoc?.slug]);
  return doc;
};

const revalidateOnDelete: CollectionAfterDeleteHook = ({ doc }) => {
  revalidateStorefront([doc?.slug]);
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
    defaultColumns: ["name", "brand", "category", "isActive", "featured"],
    group: "Catálogo",
    description: "Catálogo multi-categoría: interruptores, gabinetes, unicanal, fijación, soportería y herramientas.",
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
    afterChange: [createInitialVariantHook, cascadeSoftDeleteToVariants, revalidateOnChange],
    afterDelete: [revalidateOnDelete],
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
              type: "select",
              label: "Categoría",
              required: true,
              defaultValue: "interruptores",
              options: [
                { label: "Interruptores termomagnéticos", value: "interruptores" },
                { label: "Gabinetes y tableros", value: "gabinetes_tableros" },
                { label: "Unicanal galvanizado", value: "unicanal" },
                { label: "Sistemas de fijación", value: "fijacion" },
                { label: "Soportería", value: "soporteria" },
                { label: "Herramientas y accesorios", value: "herramientas_accesorios" },
              ],
              admin: {
                description:
                  "Define qué campos técnicos se muestran abajo. Los specs específicos por SKU " +
                  "(precio, stock, medida exacta) van en cada Variante.",
              },
            },
            {
              name: "productLine",
              type: "text",
              label: "Línea / Serie",
              admin: {
                description:
                  "Línea o serie del fabricante. Ej. I-LINE, Caja Moldeada, Power Pact, " +
                  "ED63B, FXD63B, NF, NQ. Opcional.",
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
            // -----------------------------------------------------------------
            // Común a todas las categorías
            // -----------------------------------------------------------------
            {
              name: "stock",
              type: "number",
              label: "Stock total disponible",
              min: 0,
              defaultValue: 0,
              admin: {
                description: "Suma de todas las variantes. Actualizar manualmente o via webhook de inventario.",
              },
            },

            // =================================================================
            // A. Interruptores termomagnéticos
            // =================================================================
            {
              name: "amperage",
              type: "number",
              label: "Amperaje (A)",
              min: 0,
              admin: {
                description: "Corriente nominal en Amperes. Ej. 10, 16, 25, 63.",
                condition: (data) => data.category === "interruptores",
              },
            },
            {
              name: "poles",
              type: "select",
              label: "Número de polos",
              options: [
                { label: "1 polo  — monofásico", value: "1" },
                { label: "2 polos — bifásico", value: "2" },
                { label: "3 polos — trifásico", value: "3" },
                { label: "4 polos — trifásico + neutro", value: "4" },
              ],
              admin: {
                condition: (data) => data.category === "interruptores",
              },
            },
            {
              name: "voltage",
              type: "number",
              label: "Voltaje (V)",
              min: 0,
              admin: {
                description: "Tensión nominal de operación. Ej. 120, 240, 380, 480.",
                condition: (data) => data.category === "interruptores",
              },
            },
            {
              name: "tripCurve",
              type: "select",
              label: "Curva de disparo",
              options: [
                { label: "Curva B — protección de líneas (3–5× In)", value: "B" },
                { label: "Curva C — uso general (5–10× In)", value: "C" },
                { label: "Curva D — motores y transformadores (10–20× In)", value: "D" },
              ],
              admin: {
                condition: (data) => data.category === "interruptores",
              },
            },
            {
              name: "interruptingCapacity",
              type: "number",
              label: "Capacidad interruptiva (kA)",
              min: 0,
              admin: {
                description: "Capacidad de ruptura en kA. Ej. 10, 25, 65.",
                condition: (data) => data.category === "interruptores",
              },
            },
            {
              name: "mountingType",
              type: "select",
              label: "Tipo de montaje",
              options: [
                { label: "Barra I-LINE (plug-in)", value: "iline" },
                { label: "Tornillo / gabinete", value: "screw" },
              ],
              admin: {
                condition: (data) => data.category === "interruptores",
              },
            },
            {
              name: "breakerType",
              type: "text",
              label: "Tipo de interruptor",
              admin: {
                description: "Ej. Caja moldeada, Power Pact, Master Pact.",
                condition: (data) => data.category === "interruptores",
              },
            },
            {
              name: "frame",
              type: "text",
              label: "Frame / Marco",
              admin: {
                description: "Designación de frame del fabricante. Ej. FA, KA, LA, MA.",
                condition: (data) => data.category === "interruptores",
              },
            },

            // =================================================================
            // B. Gabinetes y tableros
            // =================================================================
            {
              name: "boardType",
              type: "select",
              label: "Tipo de tablero / gabinete",
              options: [
                { label: "Tablero NF (industrial)", value: "nf" },
                { label: "Tablero NQ (comercial)", value: "nq" },
                { label: "Tablero I-LINE", value: "iline" },
                { label: "Autosoportado", value: "autosoportado" },
                { label: "Gabinete (centro de carga)", value: "gabinete" },
              ],
              admin: {
                condition: (data) => data.category === "gabinetes_tableros",
              },
            },
            {
              name: "nemaRating",
              type: "select",
              label: "Clasificación NEMA",
              options: [
                { label: "NEMA 1 — interior", value: "1" },
                { label: "NEMA 3R — intemperie", value: "3r" },
              ],
              admin: {
                condition: (data) => data.category === "gabinetes_tableros",
              },
            },
            {
              name: "amperageCapacity",
              type: "number",
              label: "Capacidad (A)",
              min: 0,
              admin: {
                description: "Capacidad de corriente del tablero/gabinete. Ej. 100, 400, 1200, 5000.",
                condition: (data) => data.category === "gabinetes_tableros",
              },
            },
            {
              name: "enclosureUse",
              type: "select",
              label: "Uso del gabinete",
              options: [
                { label: "Interior", value: "interior" },
                { label: "Intemperie", value: "intemperie" },
              ],
              admin: {
                condition: (data) => data.category === "gabinetes_tableros",
              },
            },
            {
              name: "spaces",
              type: "number",
              label: "Espacios",
              min: 0,
              admin: {
                condition: (data) => data.category === "gabinetes_tableros",
              },
            },
            {
              name: "circuits",
              type: "number",
              label: "Circuitos",
              min: 0,
              admin: {
                condition: (data) => data.category === "gabinetes_tableros",
              },
            },
            {
              name: "compatibleBreakerLine",
              type: "text",
              label: "Línea de interruptor compatible",
              admin: {
                description: "Ej. I-LINE, Caja Moldeada.",
                condition: (data) => data.category === "gabinetes_tableros",
              },
            },

            // =================================================================
            // C. Unicanal galvanizado
            // =================================================================
            {
              name: "channelType",
              type: "select",
              label: "Tipo de unicanal",
              options: [
                { label: "Sólido (sin perforación)", value: "solido" },
                { label: "Perforado", value: "perforado" },
              ],
              admin: {
                condition: (data) => data.category === "unicanal",
              },
            },
            {
              name: "gauge",
              type: "select",
              label: "Calibre",
              options: [
                { label: "Calibre 14", value: "14" },
                { label: "Calibre 16", value: "16" },
                { label: "Calibre 18", value: "18" },
              ],
              admin: {
                condition: (data) => data.category === "unicanal",
              },
            },
            {
              name: "dimensions",
              type: "text",
              label: "Medida",
              admin: {
                description: 'Ej. 4 × 2", 4 × 4".',
                condition: (data) => data.category === "unicanal",
              },
            },
            {
              name: "length",
              type: "text",
              label: "Largo",
              admin: {
                description: "Ej. 3.05 m (largo estándar).",
                condition: (data) => data.category === "unicanal",
              },
            },
            {
              name: "finish",
              type: "text",
              label: "Acabado",
              admin: {
                description: "Ej. Galvanizado.",
                condition: (data) =>
                  data.category === "unicanal" || data.category === "soporteria",
              },
            },
            {
              name: "customLengthAvailable",
              type: "checkbox",
              label: "Largo a la medida disponible",
              defaultValue: false,
              admin: {
                condition: (data) => data.category === "unicanal",
              },
            },

            // =================================================================
            // D. Sistemas de fijación
            // =================================================================
            {
              name: "anchorType",
              type: "text",
              label: "Tipo de anclaje",
              admin: {
                description: "Ej. Expanzor Z, Expanzor TX, ADI, Ancla-Arpón, Cuña.",
                condition: (data) => data.category === "fijacion",
              },
            },
            {
              name: "boxQuantity",
              type: "number",
              label: "Piezas por caja",
              min: 0,
              admin: {
                description: "Cantidad de piezas en presentación de caja/mayoreo.",
                condition: (data) => data.category === "fijacion",
              },
            },

            // =================================================================
            // E. Soportería
            // =================================================================
            {
              name: "supportType",
              type: "text",
              label: "Tipo de soporte",
              admin: {
                description: "Ej. Varilla roscada, Tuerca resorte, Mordaza, Trapecio, Cinta perforada.",
                condition: (data) => data.category === "soporteria",
              },
            },
            {
              name: "compatibleWithUnicanal",
              type: "checkbox",
              label: "Compatible con unicanal",
              defaultValue: false,
              admin: {
                condition: (data) => data.category === "soporteria",
              },
            },

            // =================================================================
            // F. Herramientas y accesorios
            // =================================================================
            {
              name: "accessoryType",
              type: "text",
              label: "Tipo de accesorio / herramienta",
              admin: {
                description: "Ej. Clavos, Cartuchos, Pernos, Brocas SDS.",
                condition: (data) => data.category === "herramientas_accesorios",
              },
            },
            {
              name: "compatibleTool",
              type: "text",
              label: "Herramienta compatible",
              admin: {
                description: "Ej. Pistola de fijación, Rotomartillo.",
                condition: (data) => data.category === "herramientas_accesorios",
              },
            },
            {
              name: "application",
              type: "text",
              label: "Aplicación",
              admin: {
                description: "Ej. Concreto, Fierro estructural, Alta velocidad.",
                condition: (data) =>
                  data.category === "fijacion" ||
                  data.category === "herramientas_accesorios",
              },
            },
            {
              name: "presentation",
              type: "text",
              label: "Presentación",
              admin: {
                description: "Ej. Por pieza, Caja, Ciento, Rollo.",
                condition: (data) => data.category === "herramientas_accesorios",
              },
            },

            // -----------------------------------------------------------------
            // Compartidos: medidas físicas (fijación / soportería / herramientas)
            // -----------------------------------------------------------------
            {
              name: "material",
              type: "text",
              label: "Material",
              admin: {
                description: "Ej. Acero, Latón, Acero galvanizado.",
                condition: (data) =>
                  data.category === "fijacion" || data.category === "soporteria",
              },
            },
            {
              name: "dimDiameter",
              type: "text",
              label: "Diámetro",
              admin: {
                description: 'Medida nominal. Ej. 3/16", 1/4", 3/4".',
                condition: (data) =>
                  data.category === "fijacion" ||
                  data.category === "soporteria" ||
                  data.category === "herramientas_accesorios",
              },
            },
            {
              name: "dimLength",
              type: "text",
              label: "Largo",
              admin: {
                description: 'Ej. 1 m, 3 m, 2.1/2".',
                condition: (data) =>
                  data.category === "fijacion" ||
                  data.category === "soporteria" ||
                  data.category === "herramientas_accesorios",
              },
            },
          ],
        },

        // -------------------------------------------------------------------
        // Tab 3: Variantes
        // -------------------------------------------------------------------
        {
          label: "Variantes",
          fields: [
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

        // -------------------------------------------------------------------
        // Tab 4: Media
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
          ],
        },

        // -------------------------------------------------------------------
        // Tab 5: SEO
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
        // Tab 6: Estado y visibilidad
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
      ],
    },
  ],
};
