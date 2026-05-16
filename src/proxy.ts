/**
 * proxy.ts — ElektrK
 *
 * Next.js 16 proxy (renaming of middleware).
 * MUST export a named function `proxy` or a plain default function.
 * NextAuth's `auth()` wrapper is NOT compatible with Next.js 16 static analysis.
 *
 * Auth strategy:
 *   - The proxy only checks for the presence of a session cookie (lightweight,
 *     no DB query). Actual session validation happens server-side in each page.
 *   - NextAuth v5 (database strategy) sets `__Secure-authjs.session-token` (HTTPS)
 *     or `authjs.session-token` (HTTP / localhost).
 *   - JWT strategy sets `authjs.session-token` regardless of protocol.
 *
 * Protected routes (server-side pages also validate; proxy is defence-in-depth):
 *   - /account    → requires any session cookie
 *   - /account/*  → requires any session cookie
 *
 * Explicitly excluded from proxy (via matcher):
 *   - /admin, /admin/*   — Payload CMS manages its own session
 *   - /api/auth/*        — NextAuth internal routes (prevent recursion)
 *   - /api/*             — Payload REST API
 *   - /media/*           — Payload uploads (public)
 *   - /_next/*           — Next.js static/image assets
 *   - favicon.ico, sitemap.xml, robots.txt
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Cookie names used by NextAuth v5 / Auth.js */
const SESSION_COOKIES = [
  "__Secure-authjs.session-token", // HTTPS (production)
  "authjs.session-token",          // HTTP / localhost / JWT fallback
] as const;

function hasSessionCookie(req: NextRequest): boolean {
  return SESSION_COOKIES.some((name) => req.cookies.has(name));
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Protect /account and all sub-paths
  if (pathname === "/account" || pathname.startsWith("/account/")) {
    if (!hasSessionCookie(req)) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Run proxy on all paths EXCEPT:
     *   _next/static  — Next.js static assets
     *   _next/image   — image optimisation
     *   favicon.ico, sitemap.xml, robots.txt — metadata files
     *   admin         — Payload CMS admin (manages its own auth)
     *   api/auth      — NextAuth internal routes
     *   api/          — Payload REST API routes
     *   media/        — Payload public media uploads
     */
    "/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|admin|api/auth|api/|media/).*)",
  ],
};
