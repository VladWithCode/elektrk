import type { CollectionConfig, CollectionBeforeChangeHook } from "payload";
import { isAdmin } from "../lib/payload-access";
import { guardVariantDelete } from "../lib/payload-delete-guards";

const syncDeletedFields: CollectionBeforeChangeHook = ({ data }) => {
  if (data.deletedAt && !data.isDeleted) {
    data.isDeleted = true;
  }
  if (!data.deletedAt && data.isDeleted) {
    data.isDeleted = false;
  }
  return data;
};

export const Variants: CollectionConfig = {
  slug: "variants",
  labels: { singular: "Variante", plural: "Variantes" },
  admin: {
    useAsTitle: "sku",
    defaultColumns: ["sku", "product", "saleType", "price", "stock", "isActive"],
    group: "Catálogo",
    description: "Presentaciones de venta (pieza, caja, lote) de cada producto.",
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
  trash: true,
  hooks: {
    beforeChange: [syncDeletedFields],
    beforeDelete: [
      async ({ id, req }) => {
        await guardVariantDelete(req, id);
      },
    ],
  },
  fields: [
    {
      name: "product",
      type: "relationship",
      relationTo: "products",
      label: "Producto",
      required: true,
      hasMany: false,
      admin: {
        description: "Producto al que pertenece esta variante.",
      },
    },
    {
      name: "sku",
      type: "text",
      label: "SKU",
      required: true,
      unique: true,
      admin: {
        description:
          "Código único de referencia. Debe ser único en todo el catálogo. " +
          "Ej. SIEM-5SL6110-7-PIE, SIEM-5SL6110-7-CAJ12. " +
          // TODO (Fase 5): agregar hook beforeChange que verifique unicidad de SKU
          // en la misma collection y lance un error claro si ya existe.
          "Cambiar el SKU después de crear órdenes puede romper los snapshots históricos.",
      },
    },
    {
      name: "saleType",
      type: "select",
      label: "Tipo de presentación",
      required: true,
      options: [
        {
          label: "Pieza  — unidad individual",
          value: "piece",
        },
        {
          label: "Caja   — empaque con múltiples unidades (definir cantidad en unitsPerPackage)",
          value: "box",
        },
        {
          label: "Lote   — cantidad mayor con descuento (definir cantidad en unitsPerPackage)",
          value: "lot",
        },
      ],
      admin: {
        description: "Determina cómo se presenta al cliente en el storefront.",
      },
    },
    {
      name: "unitsPerPackage",
      type: "number",
      label: "Unidades por empaque",
      required: true,
      min: 1,
      defaultValue: 1,
      admin: {
        description:
          "Para pieza: 1. Para caja o lote: número de unidades incluidas en el precio.",
      },
    },
    {
      name: "price",
      type: "number",
      label: "Precio (MXN, IVA incluido)",
      required: true,
      min: 0,
      admin: {
        description: "Precio de venta al público. Debe incluir IVA. No ingresar centavos: ej. 299.00",
      },
    },
    {
      name: "stock",
      type: "number",
      label: "Stock disponible",
      required: true,
      min: 0,
      defaultValue: 0,
      admin: {
        description: "Unidades disponibles de esta presentación específica.",
      },
    },
    {
      name: "isActive",
      type: "checkbox",
      label: "Variante activa",
      defaultValue: true,
      admin: {
        description:
          "Desactivar para ocultar esta presentación sin eliminarla. " +
          "Las variantes inactivas no aparecen en el storefront.",
      },
    },
    {
      name: "isDeleted",
      type: "checkbox",
      label: "Eliminada (soft delete)",
      defaultValue: false,
      admin: {
        description:
          "Marcada como eliminada cuando el producto padre se elimina. " +
          "Se conserva para el historial de órdenes.",
        readOnly: true,
      },
    },
    {
      name: "deletedAt",
      type: "date",
      label: "Fecha de eliminación",
      admin: {
        description: "Fecha y hora en que se marcó como eliminada.",
        readOnly: true,
        condition: (data) => !!data.isDeleted,
      },
    },
  ],
};
