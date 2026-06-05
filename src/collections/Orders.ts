import type { CollectionConfig, CollectionBeforeValidateHook } from "payload";
import { isAdmin } from "../lib/payload-access";
import { guardOrderDelete } from "../lib/payload-delete-guards";
import { validateNumber } from "../lib/payload-validation-guards";

const validateOrderFields: CollectionBeforeValidateHook = ({ data }) => {
  if (!data) return data;
  validateNumber(data.pricing?.subtotal, "El subtotal", 0);
  validateNumber(data.pricing?.shipping, "El costo de envío", 0);
  validateNumber(data.pricing?.total, "El total", 0);
  return data;
};

export const Orders: CollectionConfig = {
  slug: "orders",
  labels: { singular: "Orden", plural: "Órdenes" },
  admin: {
    // `customerEmail` is nested inside the `customer` group; Payload v3 does not
    // resolve group-prefixed paths in useAsTitle, so we use `status` — a
    // top-level field — as the document title in the admin list view.
    useAsTitle: "status",
    defaultColumns: ["status", "createdAt"],
    group: "Ventas",
    description: "Órdenes de compra de clientes del storefront.",
  },
  access: {
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  timestamps: true,
  hooks: {
    beforeValidate: [validateOrderFields],
    beforeDelete: [
      async ({ id, req }) => {
        await guardOrderDelete(req, id);
      },
    ],
  },
  fields: [
    // -------------------------------------------------------------------------
    // Group: Cliente
    // -------------------------------------------------------------------------
    {
      type: "group",
      name: "customer",
      label: "Cliente",
      fields: [
        {
          name: "customerEmail",
          type: "email",
          label: "Email del cliente",
          required: true,
        },
        {
          name: "customerAuthId",
          type: "text",
          label: "Auth.js userId",
          admin: {
            description:
              "ID del usuario en la tabla `users` de Auth.js. Se vincula en Fase 6 (auth real). " +
              "No editar manualmente.",
            readOnly: true,
          },
        },
      ],
    },

    // -------------------------------------------------------------------------
    // Group: Estado
    // -------------------------------------------------------------------------
    {
      name: "status",
      type: "select",
      label: "Estado de la orden",
      required: true,
      defaultValue: "pending",
      options: [
        { label: "Pendiente  — esperando pago", value: "pending" },
        { label: "Pagada     — pago confirmado por Stripe", value: "paid" },
        { label: "Fallida    — pago rechazado o error", value: "failed" },
        { label: "Cancelada  — cancelada por cliente o admin", value: "cancelled" },
        { label: "Entregada  — enviada y confirmada", value: "fulfilled" },
      ],
      admin: {
        description: "Solo cambiar manualmente si Stripe no actualizó el estado vía webhook.",
      },
    },

    // -------------------------------------------------------------------------
    // Group: Totales
    // -------------------------------------------------------------------------
    {
      type: "group",
      name: "pricing",
      label: "Totales",
      fields: [
        {
          name: "subtotal",
          type: "number",
          label: "Subtotal (MXN)",
          required: true,
          min: 0,
          admin: {
            description: "Suma de artículos antes de envío.",
          },
        },
        {
          name: "shipping",
          type: "number",
          label: "Costo de envío (MXN)",
          required: true,
          min: 0,
          defaultValue: 0,
        },
        {
          name: "total",
          type: "number",
          label: "Total (MXN)",
          required: true,
          min: 0,
          admin: {
            description: "Subtotal + envío. IVA incluido.",
          },
        },
        {
          name: "taxIncluded",
          type: "checkbox",
          label: "IVA incluido en el total",
          defaultValue: true,
        },
      ],
    },

    // -------------------------------------------------------------------------
    // Group: Pago — campos de Stripe (readonly en admin, se llenan via webhook)
    // -------------------------------------------------------------------------
    {
      type: "group",
      name: "stripe",
      label: "Pago (Stripe)",
      admin: {
        description: "Estos campos son llenados automáticamente por el webhook de Stripe. No editar.",
      },
      fields: [
        {
          name: "stripePaymentIntentId",
          type: "text",
          label: "PaymentIntent ID",
          admin: {
            readOnly: true,
            description: "Ej. pi_3Qxxx. Se completa en Fase 6 (integración Stripe).",
          },
        },
        {
          name: "stripeCheckoutSessionId",
          type: "text",
          label: "Checkout Session ID",
          admin: {
            readOnly: true,
            description: "Ej. cs_test_xxx. Se completa en Fase 6.",
          },
        },
      ],
    },

    // -------------------------------------------------------------------------
    // Notas internas
    // -------------------------------------------------------------------------
    {
      name: "internalNotes",
      type: "textarea",
      label: "Notas internas",
      admin: {
        description:
          "Notas privadas del equipo sobre esta orden. Nunca visibles para el cliente.",
      },
    },

    // -------------------------------------------------------------------------
    // Virtual join — order-items that belong to this order
    //
    // Note: a reverse join from orders → tickets is intentionally omitted.
    // The `order` relationship in the Tickets collection is nested inside the
    // `relations` group, so Payload cannot resolve a top-level `on: "order"`
    // path for it.  Navigate in the other direction: open a Ticket and use its
    // "Orden relacionada" relationship field to reach the order.
    // -------------------------------------------------------------------------
    {
      name: "items",
      type: "join",
      collection: "order-items",
      on: "order",
      label: "Artículos de la orden",
    },
  ],
};
