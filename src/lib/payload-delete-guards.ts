import { APIError } from "payload";
import type { PayloadRequest } from "payload";

// ---------------------------------------------------------------------------
// Helper: fetch document title for error messages
// ---------------------------------------------------------------------------

async function getDocTitle(
  req: PayloadRequest,
  collection: string,
  id: string | number,
): Promise<string> {
  try {
    const doc = (await req.payload.findByID({
      collection: collection as any,
      id,
      req,
      depth: 0,
    })) as any;
    return (
      doc.filename ??
      doc.name ??
      doc.title ??
      doc.slug ??
      doc.sku ??
      String(id)
    );
  } catch {
    return String(id);
  }
}

// ---------------------------------------------------------------------------
// Helper: format a list of items with truncation at 3
// ---------------------------------------------------------------------------

function formatList(items: string[]): string {
  const displayed = items.slice(0, 3);
  let list = displayed.join(", ");
  if (items.length > 3) {
    list += ` y ${items.length - 3} más`;
  }
  return list;
}

// ---------------------------------------------------------------------------
// Media guards
// ---------------------------------------------------------------------------

export async function guardMediaDelete(
  req: PayloadRequest,
  id: string | number,
): Promise<void> {
  const title = await getDocTitle(req, "media", id);

  const refs: string[] = [];

  // Images inside products.images array
  const imageProducts = await req.payload.find({
    collection: "products",
    where: { "images.image": { equals: id } },
    limit: 0,
    depth: 0,
    req,
  });
  for (const p of imageProducts.docs) {
    const name = (p as any).name ?? String(p.id);
    refs.push(`Producto '${name}' (imagen de producto)`);
  }

  // Datasheet
  const dsProducts = await req.payload.find({
    collection: "products",
    where: { datasheet: { equals: id } },
    limit: 0,
    depth: 0,
    req,
  });
  for (const p of dsProducts.docs) {
    const name = (p as any).name ?? String(p.id);
    refs.push(`Producto '${name}' (ficha técnica)`);
  }

  // Meta image
  const metaProducts = await req.payload.find({
    collection: "products",
    where: { metaImage: { equals: id } },
    limit: 0,
    depth: 0,
    req,
  });
  for (const p of metaProducts.docs) {
    const name = (p as any).name ?? String(p.id);
    refs.push(`Producto '${name}' (imagen SEO)`);
  }

  if (refs.length === 0) return;

  const list = formatList(refs);
  throw new APIError(
    `No se puede eliminar permanentemente el archivo '${title}' porque está siendo usado por: ${list}. Elimina las relaciones primero.`,
    409,
  );
}

// ---------------------------------------------------------------------------
// Product guards
// ---------------------------------------------------------------------------

export async function guardProductDelete(
  req: PayloadRequest,
  id: string | number,
): Promise<void> {
  const title = await getDocTitle(req, "products", id);

  const parts: string[] = [];

  const variants = await req.payload.find({
    collection: "variants",
    where: { product: { equals: id } },
    limit: 0,
    depth: 0,
    req,
  });
  if (variants.totalDocs > 0) {
    parts.push(
      `${variants.totalDocs} ${variants.totalDocs === 1 ? "variante" : "variantes"}`,
    );
  }

  const orderItems = await req.payload.find({
    collection: "order-items",
    where: { product: { equals: id } },
    limit: 0,
    depth: 0,
    req,
  });
  if (orderItems.totalDocs > 0) {
    parts.push(
      `${orderItems.totalDocs} ${orderItems.totalDocs === 1 ? "artículo de orden" : "artículos de orden"}`,
    );
  }

  const tickets = await req.payload.find({
    collection: "tickets",
    where: { "relations.product": { equals: id } },
    limit: 0,
    depth: 0,
    req,
  });
  if (tickets.totalDocs > 0) {
    parts.push(
      `${tickets.totalDocs} ${tickets.totalDocs === 1 ? "ticket" : "tickets"}`,
    );
  }

  if (parts.length === 0) return;

  const partsStr =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(", ")} y ${parts[parts.length - 1]}`;

  throw new APIError(
    `No se puede eliminar permanentemente el producto '${title}' porque tiene ${partsStr} relacionados. Elimina las relaciones primero.`,
    409,
  );
}

// ---------------------------------------------------------------------------
// Variant guards
// ---------------------------------------------------------------------------

export async function guardVariantDelete(
  req: PayloadRequest,
  id: string | number,
): Promise<void> {
  const title = await getDocTitle(req, "variants", id);

  const orderItems = await req.payload.find({
    collection: "order-items",
    where: { variant: { equals: id } },
    limit: 0,
    depth: 0,
    req,
  });

  if (orderItems.totalDocs === 0) return;

  const count = orderItems.totalDocs;
  throw new APIError(
    `No se puede eliminar permanentemente la variante '${title}' porque tiene ${count} ${count === 1 ? "artículo de orden" : "artículos de orden"} relacionados. Elimina las relaciones primero.`,
    409,
  );
}

// ---------------------------------------------------------------------------
// Order guards
// ---------------------------------------------------------------------------

export async function guardOrderDelete(
  req: PayloadRequest,
  id: string | number,
): Promise<void> {
  const title = await getDocTitle(req, "orders", id);

  const orderItems = await req.payload.find({
    collection: "order-items",
    where: { order: { equals: id } },
    limit: 0,
    depth: 0,
    req,
  });

  if (orderItems.totalDocs === 0) return;

  const count = orderItems.totalDocs;
  throw new APIError(
    `No se puede eliminar permanentemente la orden '${title}' porque tiene ${count} ${count === 1 ? "artículo" : "artículos"} relacionados. Elimina las relaciones primero.`,
    409,
  );
}
