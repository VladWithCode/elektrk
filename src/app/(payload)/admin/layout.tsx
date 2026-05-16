/**
 * Payload CMS admin layout — ElektrK
 *
 * RootLayout provides:
 *   1. PayloadProvider context (required by all admin client components).
 *   2. ServerFunctionsProvider — wired via a Next.js "use server" action so
 *      the admin UI can call Payload server functions (live preview, document
 *      render, slugify, etc.).
 *
 * `serverFunction` is a Server Action (marked "use server") that delegates to
 * `handleServerFunctions` from @payloadcms/next/layouts. This is the standard
 * Payload v3 pattern for Next.js App Router.
 */

import type React from "react";
import { RootLayout } from "@payloadcms/next/layouts";
import { handleServerFunctions } from "@payloadcms/next/layouts";
import type { ServerFunctionClient } from "payload";
import configPromise from "@payload-config";
import { importMap } from "./importMap.js";

// Turbopack (Next.js 16 default) silently drops CSS/SCSS imports from server
// component files in node_modules. Payload's RootLayout imports SCSS that
// never reaches the CSS bundle. @payloadcms/ui/dist/styles.css is also
// incomplete (missing :root variable definitions and many component styles).
//
// The COMPLETE production stylesheet is @payloadcms/next/dist/prod/styles.css
// (exported as @payloadcms/next/css). It contains all CSS custom properties,
// color tokens, component styles (template-minimal, field-type, etc.), and
// global resets. We import it via a local CSS file with @import because
// Turbopack processes local CSS imports correctly.
import "./payload-admin.css";

type Props = {
  children: React.ReactNode;
};

const serverFunction: ServerFunctionClient = async (args) => {
  "use server";
  return handleServerFunctions({
    ...args,
    config: configPromise,
    importMap,
  });
};

export default function AdminLayout({ children }: Props) {
  return (
    <RootLayout
      config={configPromise}
      importMap={importMap}
      serverFunction={serverFunction}
    >
      {children}
    </RootLayout>
  );
}
