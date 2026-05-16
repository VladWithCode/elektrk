/**
 * Auth helpers — safe wrappers around Auth.js v5 server functions.
 *
 * All helpers gracefully handle the case where AUTH_SECRET or DATABASE_URL
 * are not set (e.g. during development before Neon is connected).
 *
 * Use these in Server Components, Server Actions, and route handlers.
 * Do NOT import `auth` from "@auth" directly in UI components — use these
 * helpers instead so the guard logic is centralised.
 */

import { redirect } from "next/navigation";
import { isAuthConfigured } from "@auth";
import type { Session } from "next-auth";

export { isAuthConfigured };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

// ---------------------------------------------------------------------------
// getSessionSafe
// ---------------------------------------------------------------------------

/**
 * Returns the current Auth.js session, or null if:
 *   - AUTH_SECRET is not set (auto-generated in dev, required in production)
 *   - No active session exists
 *   - Any unexpected error occurs
 *
 * Safe to call from any Server Component — never throws.
 */
export async function getSessionSafe(): Promise<Session | null> {
  try {
    const { auth } = await import("@auth");
    return await auth();
  } catch {
    // AUTH_SECRET missing in production, or other config error
    return null;
  }
}

// ---------------------------------------------------------------------------
// getCurrentUser
// ---------------------------------------------------------------------------

/**
 * Returns the authenticated user from the current session, or null.
 *
 * @example
 * const user = await getCurrentUser();
 * if (user) { ... }
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await getSessionSafe();
  if (!session?.user) return null;

  return {
    id: session.user.id ?? "",
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
  };
}

// ---------------------------------------------------------------------------
// requireUser
// ---------------------------------------------------------------------------

/**
 * Returns the current user or redirects to /login (with callbackUrl).
 *
 * Use in Server Components / Server Actions that require authentication.
 * The redirect is a thrown Next.js redirect — it does not return a value.
 *
 * @example
 * const user = await requireUser();
 * // If this line is reached, user is guaranteed non-null
 */
export async function requireUser(callbackUrl = "/account"): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }
  return user;
}

// ---------------------------------------------------------------------------
// requireAdmin (storefront admin check — NOT Payload admin)
// ---------------------------------------------------------------------------

/**
 * Placeholder for storefront-level admin check.
 *
 * In Phase 6B+ this will verify a role field on the user record.
 * Currently redirects all non-authenticated users to /login.
 *
 * NOTE: Payload CMS admin access is controlled separately via isAdmin()
 * in src/lib/payload-access.ts and does NOT use this helper.
 */
export async function requireAdmin(callbackUrl = "/"): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }
  // TODO (Phase 6B): check user.role === "admin" once roles are implemented
  return user;
}
