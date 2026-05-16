"use client";

/**
 * Thin wrapper around next-auth/react SessionProvider.
 *
 * Placed in its own file so the store layout (a Server Component) can import
 * it without needing "use client" on the layout itself.
 *
 * The SessionProvider exposes useSession() to all client components in the
 * store subtree (Navbar, etc.) so they can show auth state reactively.
 *
 * When AUTH_SECRET is not set (development before Neon), useSession() returns
 * { status: "unauthenticated" } — no errors, no crashes.
 */

export { SessionProvider } from "next-auth/react";
