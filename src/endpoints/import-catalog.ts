/**
 * Endpoints del importador de catálogo (vista admin /admin/import-products).
 *
 *   GET  /api/import-catalog/existing  → slugs/SKUs existentes (pre-chequeo de colisiones)
 *   POST /api/import-catalog/products  → alta por lote de productos (per-item, skip-existing)
 *   POST /api/import-catalog/variants  → alta por lote de variantes + recálculo de stock
 *
 * Semántica per-item: cada elemento se procesa de forma independiente y el
 * resultado se reporta como created | skipped | failed. Reintentos seguros:
 * los elementos cuyo slug/SKU ya existe se omiten (idempotencia).
 */

import type { Endpoint, PayloadRequest } from "payload";
import {
  productSchema,
  variantSchema,
  type ExistingResponse,
  type ProductImportResult,
  type VariantImportResult,
} from "../lib/import-catalog/schema";

function unauthorized(req: PayloadRequest): Response | null {
  if (req.user?.collection !== "admins") {
    return Response.json({ message: "No autorizado." }, { status: 403 });
  }
  return null;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Error desconocido.";
}

const existingHandler = async (req: PayloadRequest): Promise<Response> => {
  const denied = unauthorized(req);
  if (denied) return denied;

  const { payload } = req;

  // trash: true — los documentos en papelera conservan su slug/SKU único,
  // por lo que también cuentan como colisión.
  const [productsRes, variantsRes] = await Promise.all([
    payload.find({
      collection: "products",
      limit: 0,
      pagination: false,
      depth: 0,
      select: { slug: true },
      trash: true,
    }),
    payload.find({
      collection: "variants",
      limit: 0,
      pagination: false,
      depth: 0,
      select: { sku: true },
      trash: true,
    }),
  ]);

  const products: ExistingResponse["products"] = {};
  for (const doc of productsRes.docs) {
    if (typeof doc.slug === "string") products[doc.slug] = doc.id;
  }

  const body: ExistingResponse = {
    products,
    skus: variantsRes.docs
      .map((d) => d.sku)
      .filter((s): s is string => typeof s === "string"),
  };

  return Response.json(body);
};

const importProductsHandler = async (req: PayloadRequest): Promise<Response> => {
  const denied = unauthorized(req);
  if (denied) return denied;

  const { payload } = req;

  let body: unknown;
  try {
    body = await req.json?.();
  } catch {
    return Response.json({ message: "Cuerpo JSON inválido." }, { status: 400 });
  }

  const items = (body as { items?: unknown })?.items;
  if (!Array.isArray(items)) {
    return Response.json({ message: "Se esperaba 'items' como arreglo." }, { status: 400 });
  }

  const results: ProductImportResult[] = [];

  for (const item of items) {
    const importId = String((item as { importId?: unknown })?.importId ?? "");
    if (!importId) {
      results.push({ importId: "?", status: "failed", message: "Falta importId." });
      continue;
    }

    const parsed = productSchema.safeParse((item as { data?: unknown })?.data);
    if (!parsed.success) {
      results.push({
        importId,
        status: "failed",
        message: parsed.error.issues.map((i) => i.message).join(" "),
      });
      continue;
    }

    try {
      const existing = await payload.find({
        collection: "products",
        where: { slug: { equals: parsed.data.slug } },
        limit: 1,
        depth: 0,
        select: { slug: true },
        trash: true,
      });
      if (existing.totalDocs > 0) {
        results.push({ importId, status: "skipped", dbId: existing.docs[0].id });
        continue;
      }

      const doc = await payload.create({
        collection: "products",
        data: parsed.data,
      });
      results.push({ importId, status: "created", dbId: doc.id });
    } catch (err) {
      results.push({ importId, status: "failed", message: errorMessage(err) });
    }
  }

  return Response.json({ results });
};

const importVariantsHandler = async (req: PayloadRequest): Promise<Response> => {
  const denied = unauthorized(req);
  if (denied) return denied;

  const { payload } = req;

  let body: unknown;
  try {
    body = await req.json?.();
  } catch {
    return Response.json({ message: "Cuerpo JSON inválido." }, { status: 400 });
  }

  const items = (body as { items?: unknown })?.items;
  if (!Array.isArray(items)) {
    return Response.json({ message: "Se esperaba 'items' como arreglo." }, { status: 400 });
  }

  const results: VariantImportResult[] = [];
  const productsToRecompute = new Set<number | string>();

  for (const item of items) {
    const variantId = String((item as { variantId?: unknown })?.variantId ?? "");
    const productId = (item as { productId?: unknown })?.productId;
    if (!variantId) {
      results.push({ variantId: "?", status: "failed", message: "Falta variantId." });
      continue;
    }
    if (typeof productId !== "number" && typeof productId !== "string") {
      results.push({ variantId, status: "failed", message: "Falta productId." });
      continue;
    }

    const parsed = variantSchema.safeParse((item as { data?: unknown })?.data);
    if (!parsed.success) {
      results.push({
        variantId,
        status: "failed",
        message: parsed.error.issues.map((i) => i.message).join(" "),
      });
      continue;
    }

    try {
      const existing = await payload.find({
        collection: "variants",
        where: { sku: { equals: parsed.data.sku } },
        limit: 1,
        depth: 0,
        select: { sku: true },
        trash: true,
      });
      if (existing.totalDocs > 0) {
        results.push({ variantId, status: "skipped", dbId: existing.docs[0].id });
        continue;
      }

      const doc = await payload.create({
        collection: "variants",
        data: {
          ...parsed.data,
          product: productId as number,
        },
      });
      results.push({ variantId, status: "created", dbId: doc.id });
      productsToRecompute.add(productId);
    } catch (err) {
      results.push({ variantId, status: "failed", message: errorMessage(err) });
    }
  }

  // Recalcular stock del producto: Σ(stock × unitsPerPackage) de todas sus
  // variantes no eliminadas. Solo para productos con ≥1 variante creada.
  const stockUpdates: Record<string, number> = {};
  const stockWarnings: string[] = [];

  for (const productId of productsToRecompute) {
    try {
      const variants = await payload.find({
        collection: "variants",
        where: { product: { equals: productId } },
        limit: 0,
        pagination: false,
        depth: 0,
        select: { stock: true, unitsPerPackage: true },
      });
      const total = variants.docs.reduce((sum, v) => {
        const stock = typeof v.stock === "number" ? v.stock : 0;
        const units = typeof v.unitsPerPackage === "number" ? v.unitsPerPackage : 1;
        return sum + stock * units;
      }, 0);

      await payload.update({
        collection: "products",
        id: productId,
        data: { stock: total },
      });
      stockUpdates[String(productId)] = total;
    } catch (err) {
      stockWarnings.push(
        `No se pudo recalcular el stock del producto ${productId}: ${errorMessage(err)}`,
      );
    }
  }

  return Response.json({ results, stockUpdates, stockWarnings });
};

export const importCatalogEndpoints: Endpoint[] = [
  { path: "/import-catalog/existing", method: "get", handler: existingHandler },
  { path: "/import-catalog/products", method: "post", handler: importProductsHandler },
  { path: "/import-catalog/variants", method: "post", handler: importVariantsHandler },
];
