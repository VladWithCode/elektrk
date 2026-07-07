import { APIError } from "payload";
import type { PayloadRequest } from "payload";

// ---------------------------------------------------------------------------
// Helper: fetch a single document by a unique field to check duplicates
// ---------------------------------------------------------------------------

async function findByField(
  req: PayloadRequest,
  collection: string,
  field: string,
  value: string,
  currentId?: string | number,
) {
  const where = currentId
    ? { and: [{ [field]: { equals: value } }, { id: { not_equals: currentId } }] }
    : { [field]: { equals: value } };

  const result = await req.payload.find({
    collection: collection as any,
    where,
    limit: 1,
    depth: 0,
    req,
  });

  return result.docs[0] ?? null;
}

// ---------------------------------------------------------------------------
// Product slug
// ---------------------------------------------------------------------------

export async function guardUniqueSlug(
  req: PayloadRequest,
  slug: string,
  currentId?: string | number,
): Promise<void> {
  const slugValue = typeof slug === "string" ? slug.trim() : "";
  if (!slugValue) return; // empty slug handled by schema validation

  const existing = await findByField(req, "products", "slug", slugValue, currentId);
  if (existing) {
    throw new APIError(
      `Ya existe un producto con el slug '${slugValue}'. Usa un slug diferente.`,
      409,
    );
  }
}

// ---------------------------------------------------------------------------
// Variant SKU
// ---------------------------------------------------------------------------

export async function guardUniqueSku(
  req: PayloadRequest,
  sku: string,
  currentId?: string | number,
): Promise<void> {
  const skuValue = typeof sku === "string" ? sku.trim() : "";
  if (!skuValue) return; // empty SKU handled by schema validation

  const existing = await findByField(req, "variants", "sku", skuValue, currentId);
  if (existing) {
    throw new APIError(
      `Ya existe una variante con el SKU '${skuValue}'. Usa un SKU diferente.`,
      409,
    );
  }
}

// ---------------------------------------------------------------------------
// Admin email
// ---------------------------------------------------------------------------

export async function guardUniqueEmail(
  req: PayloadRequest,
  email: string,
  currentId?: string | number,
): Promise<void> {
  const emailValue = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!emailValue) return; // empty email handled by schema validation

  const existing = await findByField(req, "admins", "email", emailValue, currentId);
  if (existing) {
    throw new APIError(
      `Ya existe un administrador con el email '${emailValue}'. Usa un email diferente.`,
      409,
    );
  }
}
