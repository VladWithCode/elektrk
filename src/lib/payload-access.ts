import type { Access } from "payload";

/** True only for authenticated admin users. */
export const isAdmin: Access = ({ req }) =>
  req.user?.collection === "admins";

/**
 * Admins see everything; anonymous/customers only see documents
 * where isActive === true.
 */
export const isAdminOrActive: Access = ({ req }) => {
  if (req.user?.collection === "admins") return true;
  return { isActive: { equals: true } };
};
