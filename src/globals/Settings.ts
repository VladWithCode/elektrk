import type { GlobalConfig } from "payload";
import { isAdmin } from "../lib/payload-access";

export const Settings: GlobalConfig = {
  slug: "settings",
  label: "Configuración de tienda",
  admin: {
    group: "Sistema",
    description: "Configuración global del storefront. Cambios aquí afectan toda la tienda.",
  },
  access: {
    read: isAdmin,
    update: isAdmin,
  },
  fields: [
    // -------------------------------------------------------------------------
    // Group: Tienda
    // -------------------------------------------------------------------------
    {
      type: "group",
      name: "store",
      label: "Datos de la tienda",
      fields: [
        {
          name: "storeName",
          type: "text",
          label: "Nombre de la tienda",
          required: true,
          defaultValue: "Distribuidor Electrico Monterrey",
        },
        {
          name: "supportEmail",
          type: "email",
          label: "Email de soporte / ventas",
          defaultValue: "ventas@elektrk.mx",
          admin: {
            description: "Dirección visible para clientes. Debe ser un email válido.",
          },
        },
        {
          name: "storePhone",
          type: "text",
          label: "Teléfono de contacto",
          admin: {
            description: "Opcional. Ej. +52 55 1234 5678. Se muestra en el footer y soporte.",
          },
        },
        {
          name: "whatsapp",
          type: "text",
          label: "WhatsApp",
          admin: {
            description:
              "Opcional. Número con código de país, sin espacios ni guiones. Ej. 5215512345678. " +
              "Se usa para generar el enlace wa.me/{número}.",
          },
        },
        {
          name: "businessHours",
          type: "text",
          label: "Horario de atención",
          admin: {
            description: "Opcional. Ej. Lun–Vie 9:00–18:00, Sáb 10:00–14:00 (hora Ciudad de México).",
          },
        },
      ],
    },

    // -------------------------------------------------------------------------
    // Group: Precios y envío
    // -------------------------------------------------------------------------
    {
      type: "group",
      name: "pricing",
      label: "Precios y envío",
      fields: [
        {
          name: "flatShippingRate",
          type: "number",
          label: "Tarifa plana de envío (MXN)",
          required: true,
          min: 0,
          defaultValue: 180,
          admin: {
            description: "Costo de envío fijo para todas las órdenes. 0 = envío gratis.",
          },
        },
        {
          name: "currency",
          type: "select",
          label: "Moneda",
          required: true,
          defaultValue: "MXN",
          options: [
            { label: "Peso mexicano (MXN)", value: "MXN" },
            { label: "Dólar estadounidense (USD)", value: "USD" },
          ],
        },
        {
          name: "taxIncludedByDefault",
          type: "checkbox",
          label: "Precios publicados con IVA incluido",
          defaultValue: true,
          admin: {
            description:
              "Si está activo, se muestra 'IVA incluido' en el storefront. " +
              "No afecta los precios almacenados en Variantes.",
          },
        },
      ],
    },

    // -------------------------------------------------------------------------
    // Group: Banner de anuncio
    // -------------------------------------------------------------------------
    {
      type: "group",
      name: "announcement",
      label: "Banner de anuncio",
      admin: {
        description: "Banner informativo opcional que aparece en la parte superior del storefront.",
      },
      fields: [
        {
          name: "announcementEnabled",
          type: "checkbox",
          label: "Mostrar banner",
          defaultValue: false,
        },
        {
          name: "announcementBanner",
          type: "text",
          label: "Texto del banner",
          admin: {
            description:
              "Se muestra solo cuando 'Mostrar banner' está activo. " +
              "Ej. Envío gratis en pedidos mayores a $5,000 MXN.",
          },
        },
      ],
    },
  ],
};
