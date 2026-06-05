import type { CollectionConfig, CollectionBeforeValidateHook } from "payload";
import { isAdmin } from "../lib/payload-access";
import { validateNumber } from "../lib/payload-validation-guards";

const validateOrderItemFields: CollectionBeforeValidateHook = ({ data }) => {
  if (!data) return data;
  validateNumber(data.quantity, "La cantidad", 1);
  validateNumber(data.unitPrice, "El precio unitario", 0);
  validateNumber(data.total, "El total", 0);
  return data;
};

export const OrderItems: CollectionConfig = {
  slug: "order-items",
  labels: { singular: "Artículo de orden", plural: "Artículos de órdenes" },
  admin: {
    useAsTitle: "productNameSnapshot",
    defaultColumns: ["order", "productNameSnapshot", "variantSkuSnapshot", "quantity", "unitPrice", "total"],
    group: "Ventas",
    description:
      "Líneas de cada orden. Los campos snapshot son inmutables: preservan el estado del " +
      "catálogo al momento de la compra, aunque después cambie nombre o precio.",
  },
  access: {
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    beforeValidate: [validateOrderItemFields],
  },
  fields: [
    // -------------------------------------------------------------------------
    // Relations
    // -------------------------------------------------------------------------
    {
      name: "order",
      type: "relationship",
      relationTo: "orders",
      label: "Orden",
      required: true,
      hasMany: false,
    },
    {
      name: "product",
      type: "relationship",
      relationTo: "products",
      label: "Producto (referencia actual)",
      required: true,
      hasMany: false,
      admin: {
        description:
          "Referencia al producto actual. Puede cambiar si el producto es editado; " +
          "use los campos snapshot para el dato histórico.",
      },
    },
    {
      name: "variant",
      type: "relationship",
      relationTo: "variants",
      label: "Variante (referencia actual)",
      required: true,
      hasMany: false,
    },

    // -------------------------------------------------------------------------
    // Snapshots — immutable records of the product state at purchase time
    // -------------------------------------------------------------------------
    {
      name: "productNameSnapshot",
      type: "text",
      label: "Nombre del producto (snapshot)",
      required: true,
      admin: {
        description: "Copia del nombre al momento de la compra. No editar.",
        readOnly: true,
      },
    },
    {
      name: "variantSkuSnapshot",
      type: "text",
      label: "SKU de la variante (snapshot)",
      required: true,
      admin: {
        description: "Copia del SKU al momento de la compra. No editar.",
        readOnly: true,
      },
    },

    // -------------------------------------------------------------------------
    // Quantities and pricing
    // -------------------------------------------------------------------------
    {
      name: "quantity",
      type: "number",
      label: "Cantidad",
      required: true,
      min: 1,
      admin: {
        description: "Número de unidades compradas de esta variante.",
      },
    },
    {
      name: "unitPrice",
      type: "number",
      label: "Precio unitario al momento de compra (MXN)",
      required: true,
      min: 0,
      admin: {
        description: "Precio unitario snapshot. IVA incluido. No editar.",
        readOnly: true,
      },
    },
    {
      name: "total",
      type: "number",
      label: "Total de línea (MXN)",
      required: true,
      min: 0,
      admin: {
        description: "quantity × unitPrice. No editar.",
        readOnly: true,
      },
    },
  ],
};
