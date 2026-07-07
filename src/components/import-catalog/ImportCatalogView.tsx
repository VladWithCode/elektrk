import type { AdminViewServerProps } from "payload";

import { DefaultTemplate } from "@payloadcms/next/templates";
import { Gutter } from "@payloadcms/ui";
import { redirect } from "next/navigation";
import React from "react";

import { ImportWizard } from "./ImportWizard";

/**
 * Vista admin personalizada: /admin/import-products
 *
 * Carga el catálogo desde un archivo JSON (formato seed-products.json) y lo
 * registra en dos pasos revisables: productos → variantes.
 */
export function ImportCatalogView({
  initPageResult,
  params,
  searchParams,
}: AdminViewServerProps) {
  const { req, locale, permissions, visibleEntities } = initPageResult;

  // El panel admin solo autentica admins, pero la vista es de alto impacto:
  // verificación explícita por si se añaden otras colecciones auth.
  if (req.user?.collection !== "admins") {
    redirect(req.payload.config.routes.admin);
  }

  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={locale}
      params={params}
      payload={req.payload}
      permissions={permissions}
      searchParams={searchParams}
      user={req.user || undefined}
      visibleEntities={visibleEntities}
    >
      <Gutter>
        <ImportWizard />
      </Gutter>
    </DefaultTemplate>
  );
}
