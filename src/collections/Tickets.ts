import type { CollectionConfig } from "payload";
import { isAdmin } from "../lib/payload-access";

export const Tickets: CollectionConfig = {
  slug: "tickets",
  labels: { singular: "Ticket", plural: "Tickets" },
  admin: {
    // `subject` is inside the `inquiry` group and `customerEmail` is inside
    // `clientInfo`; Payload v3 does not resolve group-prefixed paths in
    // useAsTitle or defaultColumns, so we restrict both to top-level fields.
    useAsTitle: "priority",
    defaultColumns: ["priority", "status", "createdAt"],
    group: "Soporte",
    description: "Tickets de soporte creados por clientes del storefront.",
  },
  access: {
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  timestamps: true,
  fields: [
    // -------------------------------------------------------------------------
    // Group: Cliente
    // -------------------------------------------------------------------------
    {
      type: "group",
      name: "clientInfo",
      label: "Información del cliente",
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
            description: "ID en la tabla `users` de Auth.js. Se vincula en Fase 6. No editar.",
            readOnly: true,
          },
        },
      ],
    },

    // -------------------------------------------------------------------------
    // Group: Consulta
    // -------------------------------------------------------------------------
    {
      type: "group",
      name: "inquiry",
      label: "Consulta",
      fields: [
        {
          name: "subject",
          type: "text",
          label: "Asunto",
          required: true,
          admin: {
            description: "Resumen breve del problema o consulta.",
          },
        },
        {
          name: "message",
          type: "textarea",
          label: "Mensaje del cliente",
          required: true,
          admin: {
            description: "Descripción detallada enviada por el cliente.",
          },
        },
      ],
    },

    // -------------------------------------------------------------------------
    // Group: Relaciones opcionales
    // -------------------------------------------------------------------------
    {
      type: "group",
      name: "relations",
      label: "Relaciones",
      admin: {
        description: "Vincular opcionalmente con un producto u orden relacionados.",
      },
      fields: [
        {
          name: "product",
          type: "relationship",
          relationTo: "products",
          label: "Producto relacionado",
          hasMany: false,
        },
        {
          name: "order",
          type: "relationship",
          relationTo: "orders",
          label: "Orden relacionada",
          hasMany: false,
        },
      ],
    },

    // -------------------------------------------------------------------------
    // Status and priority — top-level for quick scanning in the list view
    // -------------------------------------------------------------------------
    {
      name: "priority",
      type: "select",
      label: "Prioridad",
      required: true,
      defaultValue: "medium",
      options: [
        { label: "Alta  — responder en < 4 h", value: "high" },
        { label: "Media — responder en < 24 h", value: "medium" },
        { label: "Baja  — responder en < 72 h", value: "low" },
      ],
      admin: {
        description: "Alta para devoluciones, defectos o bloqueos de operación.",
      },
    },
    {
      name: "status",
      type: "select",
      label: "Estado",
      required: true,
      defaultValue: "open",
      options: [
        { label: "Abierto    — sin respuesta aún", value: "open" },
        { label: "En proceso — asignado o respondido parcialmente", value: "in_progress" },
        { label: "Resuelto   — cerrado satisfactoriamente", value: "resolved" },
      ],
    },

    // -------------------------------------------------------------------------
    // Admin area
    // -------------------------------------------------------------------------
    {
      name: "adminNotes",
      type: "textarea",
      label: "Notas internas del equipo",
      admin: {
        description: "Nunca visibles para el cliente. Historial de acciones, notas de escalada, etc.",
      },
    },
  ],
};
