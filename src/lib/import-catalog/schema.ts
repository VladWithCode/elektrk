/**
 * Import de catálogo — esquemas, tipos y parseo del archivo JSON.
 *
 * Módulo compartido cliente/servidor (solo zod, sin imports de Payload).
 * El formato canónico es el de `seed-products.json`:
 *   { "products": [...], "variants": [{ "productSlug": "...", ... }] }
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Enums (espejo de src/collections/Products.ts y Variants.ts)
// ---------------------------------------------------------------------------

export const PRODUCT_CATEGORIES = [
  "interruptores",
  "gabinetes_tableros",
  "unicanal",
  "fijacion",
  "soporteria",
  "herramientas_accesorios",
] as const;

export const CATEGORY_LABELS: Record<(typeof PRODUCT_CATEGORIES)[number], string> = {
  interruptores: "Interruptores termomagnéticos",
  gabinetes_tableros: "Gabinetes y tableros",
  unicanal: "Unicanal galvanizado",
  fijacion: "Sistemas de fijación",
  soporteria: "Soportería",
  herramientas_accesorios: "Herramientas y accesorios",
};

export const SALE_TYPES = ["piece", "box", "lot"] as const;

export const SALE_TYPE_LABELS: Record<(typeof SALE_TYPES)[number], string> = {
  piece: "Pieza",
  box: "Caja",
  lot: "Lote",
};

// ---------------------------------------------------------------------------
// Esquemas zod
// ---------------------------------------------------------------------------

const requiredText = (label: string) =>
  z
    .string({ error: `${label} es requerido.` })
    .trim()
    .min(1, `${label} es requerido.`);

const optionalText = z.string().trim().optional();

const optionalNonNegative = (label: string) =>
  z.coerce
    .number({ error: `${label} debe ser un número.` })
    .min(0, `${label} debe ser >= 0.`)
    .optional();

/** Acepta tags como ["x"] o [{ tag: "x" }] y normaliza a [{ tag }]. */
const tagsSchema = z
  .array(
    z.union([
      z.string().trim().min(1),
      z.object({ tag: z.string().trim().min(1) }),
    ]),
  )
  .transform((arr) => arr.map((t) => (typeof t === "string" ? { tag: t } : t)))
  .optional();

export const productSchema = z.object({
  // Núcleo requerido
  name: requiredText("El nombre"),
  slug: requiredText("El slug").regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "El slug solo permite minúsculas, números y guiones.",
  ),
  brand: requiredText("La marca"),
  model: requiredText("El modelo"),
  category: z.enum(PRODUCT_CATEGORIES, {
    error: "Categoría inválida.",
  }),
  description: requiredText("La descripción"),

  // Núcleo opcional
  productLine: optionalText,
  shortDescription: optionalText,
  technicalSummary: optionalText,
  tags: tagsSchema,
  isActive: z.boolean().optional(),
  featured: z.boolean().optional(),
  stock: optionalNonNegative("El stock"),

  // A. Interruptores
  amperage: optionalNonNegative("El amperaje"),
  poles: z.enum(["1", "2", "3", "4"]).optional(),
  voltage: optionalNonNegative("El voltaje"),
  tripCurve: z.enum(["B", "C", "D"]).optional(),
  interruptingCapacity: optionalNonNegative("La capacidad interruptiva"),
  mountingType: z.enum(["iline", "screw"]).optional(),
  breakerType: optionalText,
  frame: optionalText,

  // B. Gabinetes y tableros
  boardType: z.enum(["nf", "nq", "iline", "autosoportado", "gabinete"]).optional(),
  nemaRating: z.enum(["1", "3r"]).optional(),
  amperageCapacity: optionalNonNegative("La capacidad"),
  enclosureUse: z.enum(["interior", "intemperie"]).optional(),
  spaces: optionalNonNegative("Los espacios"),
  circuits: optionalNonNegative("Los circuitos"),
  compatibleBreakerLine: optionalText,

  // C. Unicanal
  channelType: z.enum(["solido", "perforado"]).optional(),
  gauge: z.enum(["14", "16", "18"]).optional(),
  dimensions: optionalText,
  length: optionalText,
  finish: optionalText,
  customLengthAvailable: z.boolean().optional(),

  // D. Fijación
  anchorType: optionalText,
  boxQuantity: optionalNonNegative("Las piezas por caja"),

  // E. Soportería
  supportType: optionalText,
  compatibleWithUnicanal: z.boolean().optional(),

  // F. Herramientas y accesorios
  accessoryType: optionalText,
  compatibleTool: optionalText,
  application: optionalText,
  presentation: optionalText,

  // Compartidos
  material: optionalText,
  dimDiameter: optionalText,
  dimLength: optionalText,
});

export const variantSchema = z.object({
  sku: requiredText("El SKU"),
  saleType: z.enum(SALE_TYPES, { error: "Tipo de presentación inválido." }),
  unitsPerPackage: z.coerce
    .number({ error: "Las unidades por empaque deben ser un número." })
    .min(1, "Las unidades por empaque deben ser >= 1."),
  price: z.coerce
    .number({ error: "El precio debe ser un número." })
    .min(0, "El precio debe ser >= 0."),
  stock: z.coerce
    .number({ error: "El stock debe ser un número." })
    .min(0, "El stock debe ser >= 0."),
  variantSpec: optionalText,
  presentation: optionalText,
  unitLabel: optionalText,
  isActive: z.boolean().optional(),
});

export type ProductInput = z.infer<typeof productSchema>;
export type VariantInput = z.infer<typeof variantSchema>;

export const KNOWN_PRODUCT_KEYS = new Set(Object.keys(productSchema.shape));
export const KNOWN_VARIANT_KEYS = new Set([...Object.keys(variantSchema.shape), "productSlug"]);

// ---------------------------------------------------------------------------
// Definición de campos para render condicional en las tarjetas
// (espejo de las condiciones admin de Products.ts)
// ---------------------------------------------------------------------------

export type Category = (typeof PRODUCT_CATEGORIES)[number];

export type SpecFieldDef = {
  name: keyof ProductInput & string;
  label: string;
  type: "text" | "number" | "select" | "checkbox";
  options?: { label: string; value: string }[];
  /** Categorías donde aplica; ausente = todas. */
  categories?: Category[];
};

export const SPEC_FIELD_DEFS: SpecFieldDef[] = [
  { name: "stock", label: "Stock total", type: "number" },

  { name: "amperage", label: "Amperaje (A)", type: "number", categories: ["interruptores"] },
  {
    name: "poles",
    label: "Polos",
    type: "select",
    options: ["1", "2", "3", "4"].map((v) => ({ label: `${v} polo(s)`, value: v })),
    categories: ["interruptores"],
  },
  { name: "voltage", label: "Voltaje (V)", type: "number", categories: ["interruptores"] },
  {
    name: "tripCurve",
    label: "Curva de disparo",
    type: "select",
    options: ["B", "C", "D"].map((v) => ({ label: `Curva ${v}`, value: v })),
    categories: ["interruptores"],
  },
  {
    name: "interruptingCapacity",
    label: "Cap. interruptiva (kA)",
    type: "number",
    categories: ["interruptores"],
  },
  {
    name: "mountingType",
    label: "Tipo de montaje",
    type: "select",
    options: [
      { label: "Barra I-LINE (plug-in)", value: "iline" },
      { label: "Tornillo / gabinete", value: "screw" },
    ],
    categories: ["interruptores"],
  },
  { name: "breakerType", label: "Tipo de interruptor", type: "text", categories: ["interruptores"] },
  { name: "frame", label: "Frame / Marco", type: "text", categories: ["interruptores"] },

  {
    name: "boardType",
    label: "Tipo de tablero",
    type: "select",
    options: [
      { label: "Tablero NF (industrial)", value: "nf" },
      { label: "Tablero NQ (comercial)", value: "nq" },
      { label: "Tablero I-LINE", value: "iline" },
      { label: "Autosoportado", value: "autosoportado" },
      { label: "Gabinete (centro de carga)", value: "gabinete" },
    ],
    categories: ["gabinetes_tableros"],
  },
  {
    name: "nemaRating",
    label: "Clasificación NEMA",
    type: "select",
    options: [
      { label: "NEMA 1 — interior", value: "1" },
      { label: "NEMA 3R — intemperie", value: "3r" },
    ],
    categories: ["gabinetes_tableros"],
  },
  { name: "amperageCapacity", label: "Capacidad (A)", type: "number", categories: ["gabinetes_tableros"] },
  {
    name: "enclosureUse",
    label: "Uso del gabinete",
    type: "select",
    options: [
      { label: "Interior", value: "interior" },
      { label: "Intemperie", value: "intemperie" },
    ],
    categories: ["gabinetes_tableros"],
  },
  { name: "spaces", label: "Espacios", type: "number", categories: ["gabinetes_tableros"] },
  { name: "circuits", label: "Circuitos", type: "number", categories: ["gabinetes_tableros"] },
  {
    name: "compatibleBreakerLine",
    label: "Línea de interruptor compatible",
    type: "text",
    categories: ["gabinetes_tableros"],
  },

  {
    name: "channelType",
    label: "Tipo de unicanal",
    type: "select",
    options: [
      { label: "Sólido", value: "solido" },
      { label: "Perforado", value: "perforado" },
    ],
    categories: ["unicanal"],
  },
  {
    name: "gauge",
    label: "Calibre",
    type: "select",
    options: ["14", "16", "18"].map((v) => ({ label: `Calibre ${v}`, value: v })),
    categories: ["unicanal"],
  },
  { name: "dimensions", label: "Medida", type: "text", categories: ["unicanal"] },
  { name: "length", label: "Largo", type: "text", categories: ["unicanal"] },
  { name: "finish", label: "Acabado", type: "text", categories: ["unicanal", "soporteria"] },
  {
    name: "customLengthAvailable",
    label: "Largo a la medida",
    type: "checkbox",
    categories: ["unicanal"],
  },

  { name: "anchorType", label: "Tipo de anclaje", type: "text", categories: ["fijacion"] },
  { name: "boxQuantity", label: "Piezas por caja", type: "number", categories: ["fijacion"] },

  { name: "supportType", label: "Tipo de soporte", type: "text", categories: ["soporteria"] },
  {
    name: "compatibleWithUnicanal",
    label: "Compatible con unicanal",
    type: "checkbox",
    categories: ["soporteria"],
  },

  {
    name: "accessoryType",
    label: "Tipo de accesorio",
    type: "text",
    categories: ["herramientas_accesorios"],
  },
  {
    name: "compatibleTool",
    label: "Herramienta compatible",
    type: "text",
    categories: ["herramientas_accesorios"],
  },
  {
    name: "application",
    label: "Aplicación",
    type: "text",
    categories: ["fijacion", "herramientas_accesorios"],
  },
  {
    name: "presentation",
    label: "Presentación",
    type: "text",
    categories: ["herramientas_accesorios"],
  },

  { name: "material", label: "Material", type: "text", categories: ["fijacion", "soporteria"] },
  {
    name: "dimDiameter",
    label: "Diámetro",
    type: "text",
    categories: ["fijacion", "soporteria", "herramientas_accesorios"],
  },
  {
    name: "dimLength",
    label: "Largo",
    type: "text",
    categories: ["fijacion", "soporteria", "herramientas_accesorios"],
  },
];

export function specFieldsForCategory(category: string): SpecFieldDef[] {
  return SPEC_FIELD_DEFS.filter(
    (f) => !f.categories || f.categories.includes(category as Category),
  );
}

// ---------------------------------------------------------------------------
// Drafts (estado editable en el wizard)
// ---------------------------------------------------------------------------

/** Datos editables: mismos campos que ProductInput pero sin garantía de validez. */
export type ProductDraftData = Partial<ProductInput> & Record<string, unknown>;
export type VariantDraftData = Partial<VariantInput> & Record<string, unknown>;

export type ProductDraft = {
  _importId: string;
  data: ProductDraftData;
  /** Claves desconocidas descartadas del archivo. */
  warnings: string[];
  excluded: boolean;
  /** El slug ya existe en la BD (se omitirá al registrar). */
  existsInDb: boolean;
};

export type VariantDraft = {
  _variantId: string;
  productImportId: string;
  /** Slug original del archivo (solo informativo tras el parseo). */
  productSlug: string;
  data: VariantDraftData;
  warnings: string[];
  excluded: boolean;
  existsInDb: boolean;
};

export type FieldErrors = Record<string, string>;

export function validateProductDraft(data: ProductDraftData): FieldErrors {
  const res = productSchema.safeParse(data);
  if (res.success) return {};
  const errors: FieldErrors = {};
  for (const issue of res.error.issues) {
    const key = String(issue.path[0] ?? "_");
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

export function validateVariantDraft(data: VariantDraftData): FieldErrors {
  const res = variantSchema.safeParse(data);
  if (res.success) return {};
  const errors: FieldErrors = {};
  for (const issue of res.error.issues) {
    const key = String(issue.path[0] ?? "_");
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Parseo del archivo
// ---------------------------------------------------------------------------

export type ExistingCatalog = {
  slugs: string[];
  skus: string[];
};

/** Respuesta de GET /api/import-catalog/existing. */
export type ExistingResponse = {
  /** Mapa slug → id de los productos existentes en BD. */
  products: Record<string, number | string>;
  skus: string[];
};

export type ParseSuccess = {
  ok: true;
  products: ProductDraft[];
  variants: VariantDraft[];
  fileWarnings: string[];
};

export type ParseFailure = {
  ok: false;
  errors: string[];
};

export type ParseResult = ParseSuccess | ParseFailure;

function pickKnown(
  raw: Record<string, unknown>,
  known: Set<string>,
): { data: Record<string, unknown>; unknownKeys: string[] } {
  const data: Record<string, unknown> = {};
  const unknownKeys: string[] = [];
  for (const [key, value] of Object.entries(raw)) {
    if (known.has(key)) data[key] = value;
    else unknownKeys.push(key);
  }
  return { data, unknownKeys };
}

/** Normaliza tags si vienen como strings planos, sin validar el resto. */
function normalizeTags(data: Record<string, unknown>): void {
  if (Array.isArray(data.tags)) {
    data.tags = data.tags.map((t) => (typeof t === "string" ? { tag: t } : t));
  }
}

export function parseImportFile(text: string, existing: ExistingCatalog): ParseResult {
  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, errors: [`El archivo no es JSON válido: ${msg}`] };
  }

  if (typeof root !== "object" || root === null || Array.isArray(root)) {
    return { ok: false, errors: ["El archivo debe ser un objeto JSON con claves 'products' y/o 'variants'."] };
  }

  const rootObj = root as Record<string, unknown>;
  const rawProducts = rootObj.products ?? [];
  const rawVariants = rootObj.variants ?? [];

  const errors: string[] = [];
  if (!Array.isArray(rawProducts)) errors.push("'products' debe ser un arreglo.");
  if (!Array.isArray(rawVariants)) errors.push("'variants' debe ser un arreglo.");
  if (errors.length > 0) return { ok: false, errors };

  const productsArr = rawProducts as unknown[];
  const variantsArr = rawVariants as unknown[];

  if (productsArr.length === 0 && variantsArr.length === 0) {
    return { ok: false, errors: ["El archivo no contiene productos ni variantes."] };
  }

  const fileWarnings: string[] = [];
  const existingSlugSet = new Set(existing.slugs);
  const existingSkuSet = new Set(existing.skus);

  // --- Productos -----------------------------------------------------------
  const products: ProductDraft[] = [];
  const slugToImportId = new Map<string, string>();

  for (let i = 0; i < productsArr.length; i++) {
    const raw = productsArr[i];
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      errors.push(`products[${i}]: debe ser un objeto.`);
      continue;
    }
    const { data, unknownKeys } = pickKnown(raw as Record<string, unknown>, KNOWN_PRODUCT_KEYS);
    normalizeTags(data);

    const slug = typeof data.slug === "string" ? data.slug : "";
    const importId = crypto.randomUUID();

    if (slug) {
      if (slugToImportId.has(slug)) {
        errors.push(`products[${i}]: slug duplicado en el archivo ("${slug}").`);
      } else {
        slugToImportId.set(slug, importId);
      }
    }

    products.push({
      _importId: importId,
      data: data as ProductDraftData,
      warnings:
        unknownKeys.length > 0
          ? [`Campos desconocidos descartados: ${unknownKeys.join(", ")}.`]
          : [],
      excluded: false,
      existsInDb: slug !== "" && existingSlugSet.has(slug),
    });
  }

  // --- Variantes -----------------------------------------------------------
  const variants: VariantDraft[] = [];
  const seenSkus = new Set<string>();

  for (let i = 0; i < variantsArr.length; i++) {
    const raw = variantsArr[i];
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      errors.push(`variants[${i}]: debe ser un objeto.`);
      continue;
    }
    const rawObj = raw as Record<string, unknown>;
    const { data, unknownKeys } = pickKnown(rawObj, KNOWN_VARIANT_KEYS);

    const productSlug = typeof data.productSlug === "string" ? (data.productSlug as string) : "";
    delete data.productSlug;

    const sku = typeof data.sku === "string" ? (data.sku as string) : "";
    if (sku) {
      if (seenSkus.has(sku)) {
        errors.push(`variants[${i}]: SKU duplicado en el archivo ("${sku}").`);
      }
      seenSkus.add(sku);
    }

    if (!productSlug) {
      errors.push(`variants[${i}]${sku ? ` (${sku})` : ""}: falta 'productSlug'.`);
      continue;
    }

    // Resolución de pertenencia: producto del archivo o producto ya en BD.
    let productImportId = slugToImportId.get(productSlug);
    if (!productImportId) {
      if (existingSlugSet.has(productSlug)) {
        // Variante para producto existente en BD: grupo sintético por slug.
        productImportId = `db:${productSlug}`;
      } else {
        errors.push(
          `variants[${i}]${sku ? ` (${sku})` : ""}: productSlug "${productSlug}" no existe ni en el archivo ni en la base de datos.`,
        );
        continue;
      }
    }

    variants.push({
      _variantId: crypto.randomUUID(),
      productImportId,
      productSlug,
      data: data as VariantDraftData,
      warnings:
        unknownKeys.length > 0
          ? [`Campos desconocidos descartados: ${unknownKeys.join(", ")}.`]
          : [],
      excluded: false,
      existsInDb: sku !== "" && existingSkuSet.has(sku),
    });
  }

  if (errors.length > 0) return { ok: false, errors };

  return { ok: true, products, variants, fileWarnings };
}

// ---------------------------------------------------------------------------
// DTOs de los endpoints
// ---------------------------------------------------------------------------

export type ImportStatus = "created" | "skipped" | "failed";

export type ProductImportItem = {
  importId: string;
  data: ProductInput;
};

export type ProductImportResult = {
  importId: string;
  status: ImportStatus;
  dbId?: number | string;
  message?: string;
};

export type VariantImportItem = {
  variantId: string;
  /** Id real del producto en BD (resuelto tras el paso 1). */
  productId: number | string;
  data: VariantInput;
};

export type VariantImportResult = {
  variantId: string;
  status: ImportStatus;
  dbId?: number | string;
  message?: string;
};
