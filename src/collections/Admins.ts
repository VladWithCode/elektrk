import type { CollectionConfig, CollectionBeforeChangeHook } from "payload";
import { guardUniqueEmail } from "../lib/payload-unique-guards";

const checkUniqueEmail: CollectionBeforeChangeHook = async ({ data, originalDoc, operation, req }) => {
  const email = typeof data.email === "string" ? data.email.trim() : "";
  if (!email) return data;
  const currentId = operation === "update" ? originalDoc?.id : undefined;
  await guardUniqueEmail(req, email, currentId);
  return data;
};

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
  hooks: {
    beforeChange: [checkUniqueEmail],
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
