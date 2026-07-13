import type { CollectionConfig, CollectionAfterChangeHook, CollectionAfterDeleteHook, PayloadRequest } from "payload";
import { revalidatePath } from "next/cache";
import { isAdmin } from "../lib/payload-access";
import { guardMediaDelete } from "../lib/payload-delete-guards";

// ---------------------------------------------------------------------------
// Revalidate storefront pages that reference a media file
//
// Detail pages (/products/[slug]) are statically prerendered. When a media file
// is re-uploaded, replaced, or soft-deleted without editing the product itself,
// the product's afterChange hook never fires — so the detail page would keep
// serving a stale image (or the "no image" placeholder). This finds every
// product that references the media (gallery image, datasheet, or SEO image)
// and revalidates its path.
// ---------------------------------------------------------------------------

async function revalidateProductsUsingMedia(
  mediaId: string | number,
  req: PayloadRequest,
) {
  try {
    const result = await req.payload.find({
      collection: "products",
      where: {
        or: [
          { "images.image": { equals: mediaId } },
          { datasheet: { equals: mediaId } },
          { metaImage: { equals: mediaId } },
        ],
      },
      depth: 0,
      limit: 1000,
      select: { slug: true },
      req,
    });
    for (const product of result.docs) {
      const slug = product.slug;
      if (typeof slug === "string" && slug.trim()) {
        revalidatePath(`/products/${slug}`);
      }
    }
    revalidatePath("/products");
    revalidatePath("/");
  } catch {
    // Best-effort: revalidatePath throws outside a Next request/render context
    // (Payload CLI migrations/seeds), and a failed lookup must not break the
    // media save. Safe to ignore.
  }
}

const revalidateOnMediaChange: CollectionAfterChangeHook = async ({ doc, req }) => {
  await revalidateProductsUsingMedia(doc.id, req);
  return doc;
};

const revalidateOnMediaDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  await revalidateProductsUsingMedia(doc.id, req);
  return doc;
};

export const Media: CollectionConfig = {
  slug: "media",
  labels: { singular: "Archivo", plural: "Archivos" },
  trash: true,
  upload: {
    staticDir: "public/media",
    // Payload Admin (list, detail preview, and the upload/relationship field
    // preview inside Products) renders thumbnails from this. By default it uses
    // `media.url` / `sizes.thumbnail.url`, which point at Payload's proxy route
    // (/api/media/file/...). That 404s whenever the original `_key` is null and
    // breaks in production when serverURL is wrong. Render the DIRECT public
    // UploadThing URL (https://utfs.io/f/<key>) instead — same approach as the
    // storefront mapper. Prefer the thumbnail size key (small, fast), then the
    // card key, then the original; fall back to doc.url for media with no key.
    adminThumbnail: ({ doc }) => {
      const sizes = doc?.sizes as
        | Record<string, { _key?: string | null } | null>
        | undefined;
      const key =
        sizes?.thumbnail?._key ||
        sizes?.card?._key ||
        (doc?._key as string | null | undefined);
      if (key) return `https://utfs.io/f/${key}`;
      return (doc?.url as string | undefined) ?? null;
    },
    mimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/svg+xml",
      "application/pdf",
    ],
    imageSizes: [
      {
        name: "thumbnail",
        width: 400,
        height: 400,
        position: "centre",
      },
      {
        name: "card",
        width: 800,
        height: 800,
        position: "centre",
      },
    ],
  },
  admin: {
    group: "Contenido",
    description: "Imágenes de producto, fichas técnicas PDF y otros documentos.",
    useAsTitle: "filename",
  },
  access: {
    // Media is publicly readable (images/PDFs are served statically)
    read: () => true,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [
      ({ data }) => {
        if (data.deletedAt && !data.isDeleted) {
          data.isDeleted = true;
        }
        if (!data.deletedAt && data.isDeleted) {
          data.isDeleted = false;
        }
        return data;
      },
    ],
    beforeDelete: [
      async ({ id, req }) => {
        await guardMediaDelete(req, id);
      },
    ],
    afterChange: [revalidateOnMediaChange],
    afterDelete: [revalidateOnMediaDelete],
  },
  fields: [
    {
      name: "alt",
      type: "text",
      label: "Texto alternativo (alt)",
      admin: {
        description:
          "Requerido para imágenes de producto. Describe la imagen para lectores de pantalla y SEO. " +
          "No aplica para PDFs.",
      },
    },
    {
      name: "caption",
      type: "text",
      label: "Descripción / pie de foto",
      admin: {
        description: "Opcional. Aparece debajo de la imagen en el detalle del producto.",
      },
    },
    {
      name: "documentType",
      type: "select",
      label: "Tipo de archivo",
      required: true,
      defaultValue: "image",
      options: [
        { label: "Imagen de producto", value: "image" },
        { label: "Ficha técnica / Datasheet (PDF)", value: "datasheet" },
        { label: "Imagen SEO / Open Graph", value: "og-image" },
        { label: "Otro documento", value: "document" },
      ],
      admin: {
        description:
          "Usado por el filtro de relaciones en Productos para mostrar solo el tipo correcto " +
          "en cada campo (imágenes → image, ficha técnica → datasheet, meta → og-image).",
      },
    },
    {
      name: "isDeleted",
      type: "checkbox",
      label: "Eliminado (soft delete)",
      defaultValue: false,
      admin: {
        description:
          "Marcado como eliminado. El archivo se oculta del storefront pero se conserva en la base de datos.",
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
};
