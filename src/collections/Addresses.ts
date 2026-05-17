import type { CollectionConfig } from "payload";
import { isAdmin } from "../lib/payload-access";

export const Addresses: CollectionConfig = {
  slug: "addresses",
  labels: { singular: "Domicilio", plural: "Domicilios" },
  admin: {
    useAsTitle: "label",
    defaultColumns: ["label", "customerEmail", "city", "state", "isDefault"],
    group: "Clientes",
    description: "Domicilios guardados por los clientes para el checkout.",
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
    // Identificación del cliente
    // -------------------------------------------------------------------------
    {
      name: "customerAuthId",
      type: "text",
      label: "ID Auth.js del cliente",
      required: true,
      admin: { description: "session.user.id del cliente (JWT sub)." },
    },
    {
      name: "customerEmail",
      type: "email",
      label: "Email del cliente",
      required: true,
    },
    // -------------------------------------------------------------------------
    // Etiqueta y nombre
    // -------------------------------------------------------------------------
    {
      name: "label",
      type: "text",
      label: "Etiqueta",
      required: true,
      admin: {
        description: 'Nombre del domicilio. Ej: "Casa", "Oficina".',
      },
    },
    {
      name: "fullName",
      type: "text",
      label: "Nombre completo del destinatario",
      required: true,
    },
    {
      name: "phone",
      type: "text",
      label: "Teléfono de contacto",
    },
    // -------------------------------------------------------------------------
    // Dirección
    // -------------------------------------------------------------------------
    {
      name: "addressLine1",
      type: "text",
      label: "Dirección (línea 1)",
      required: true,
      admin: { description: "Calle, número exterior e interior, colonia." },
    },
    {
      name: "addressLine2",
      type: "text",
      label: "Dirección (línea 2)",
      admin: { description: "Opcional: referencias adicionales." },
    },
    {
      name: "city",
      type: "text",
      label: "Ciudad",
      required: true,
    },
    {
      name: "state",
      type: "text",
      label: "Estado",
      required: true,
    },
    {
      name: "postalCode",
      type: "text",
      label: "Código postal",
      required: true,
    },
    {
      name: "country",
      type: "text",
      label: "País",
      defaultValue: "MX",
      required: true,
    },
    // -------------------------------------------------------------------------
    // Predeterminado
    // -------------------------------------------------------------------------
    {
      name: "isDefault",
      type: "checkbox",
      label: "Domicilio predeterminado",
      defaultValue: false,
      admin: {
        description: "Si está marcado, se selecciona automáticamente en el checkout.",
      },
    },
  ],
};
