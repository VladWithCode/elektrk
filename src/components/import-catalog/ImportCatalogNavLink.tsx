import Link from "next/link";
import React from "react";

/** Enlace a la vista de importación en la navegación del admin. */
export function ImportCatalogNavLink() {
  return (
    <Link className="nav__link" href="/admin/import-products">
      Importar catálogo
    </Link>
  );
}
