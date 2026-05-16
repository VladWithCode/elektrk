import type { CollectionConfig } from "payload";

export const Admins: CollectionConfig = {
  slug: "admins",
  auth: true,
  admin: {
    useAsTitle: "email",
    group: "Sistema",
  },
  access: {
    read: ({ req }) => req.user?.collection === "admins",
    create: ({ req }) => req.user?.collection === "admins",
    update: ({ req }) => req.user?.collection === "admins",
    delete: ({ req }) => req.user?.collection === "admins",
  },
  fields: [
    {
      name: "name",
      type: "text",
      label: "Nombre completo",
      required: true,
    },
    {
      name: "role",
      type: "select",
      label: "Rol",
      required: true,
      defaultValue: "superadmin",
      options: [
        { label: "Super Admin", value: "superadmin" },
        { label: "Editor", value: "editor" },
      ],
    },
  ],
  timestamps: true,
};
