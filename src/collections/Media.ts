import type { CollectionConfig } from "payload";
import { isAdmin } from "../lib/payload-access";

export const Media: CollectionConfig = {
  slug: "media",
  labels: { singular: "Archivo", plural: "Archivos" },
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
  ],
};
