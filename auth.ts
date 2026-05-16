/**
 * Auth.js v5 (next-auth@beta) — ElektrK configuration
 *
 * Session strategy:
 *   - DATABASE_URL set   → database sessions via @auth/neon-adapter
 *   - DATABASE_URL unset → JWT sessions (stateless, no DB needed)
 *
 * Providers:
 *   - Credentials  — always listed; returns friendly error when DB not ready
 *   - Google       — only activated when GOOGLE_CLIENT_ID + SECRET are set
 *   - Facebook     — only activated when FACEBOOK_CLIENT_ID + SECRET are set
 *
 * The adapter and Pool are created INSIDE the factory callback so that
 * module-level imports never touch the DB connection at build/load time.
 */

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Facebook from "next-auth/providers/facebook";
import NeonAdapter from "@auth/neon-adapter";
import { Pool } from "@neondatabase/serverless";
import { verifyPassword } from "@/lib/auth/password";

// ---------------------------------------------------------------------------
// Guard — exported so helpers and Server Actions can reuse it
// ---------------------------------------------------------------------------

/**
 * Returns true when Auth.js can use the Neon adapter (DATABASE_URL is set).
 * False = JWT-only mode; Credentials provider will reject with a clear message.
 */
export function isAuthConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

// ---------------------------------------------------------------------------
// NextAuth configuration
// ---------------------------------------------------------------------------

export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const configured = isAuthConfigured();

  // Build the adapter only when the DB URL is present.
  // Constructing Pool(undefined) would fail at query time; guard it here so
  // the module never attempts a DB connection during builds or mock-mode runs.
  const adapter = configured
    ? NeonAdapter(new Pool({ connectionString: process.env.DATABASE_URL }))
    : undefined;

  // Conditional OAuth providers — excluded entirely when credentials are absent
  // so Auth.js doesn't register unconfigured providers.
  const oauthProviders = [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    ...(process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET
      ? [
          Facebook({
            clientId: process.env.FACEBOOK_CLIENT_ID,
            clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
          }),
        ]
      : []),
  ];

  return {
    // Attach adapter only when DB is available
    ...(adapter ? { adapter } : {}),

    session: {
      /**
       * Always "jwt" — NextAuth v5 requires JWT strategy when Credentials provider
       * is included in the providers array. Using "database" with Credentials throws
       * UnsupportedStrategy at runtime.
       *
       * The NeonAdapter is still attached (when DATABASE_URL is set) so OAuth
       * sign-ins create accounts/users in the DB. JWT sessions are stored in
       * a signed cookie — no `sessions` table needed for Credentials logins.
       *
       * TODO (Phase 6B): If you want DB sessions for OAuth users AND Credentials,
       * consider removing the Credentials provider and using OAuth-only with
       * strategy: "database".
       */
      strategy: "jwt",
    },

    providers: [
      /**
       * Credentials provider — Phase 6B active
       *
       * When DATABASE_URL is not set, authorize() throws a typed error that
       * the login Server Action catches and surfaces as a friendly message.
       * When configured: queries `users` table, verifies scrypt password_hash,
       * and returns { id, name, email } on success.
       */
      Credentials({
        name: "Credenciales",
        credentials: {
          email: { label: "Correo electrónico", type: "email" },
          password: { label: "Contraseña", type: "password" },
        },
        async authorize(credentials) {
          if (!configured) {
            // Typed error string — caught by the Server Action
            throw new Error("DB_NOT_CONFIGURED");
          }

          if (!credentials?.email || !credentials?.password) {
            return null;
          }

          // Phase 6B — query users table and verify password_hash
          // Prerequisite: DATABASE_URL set, Neon connected, db:auth:migrate executed.
          // users.password_hash column created by auth-migration.sql.
          const pool = new Pool({ connectionString: process.env.DATABASE_URL });
          try {
            const result = await pool.query(
              "SELECT id, name, email, password_hash FROM users WHERE email = $1 LIMIT 1",
              [(credentials.email as string).toLowerCase().trim()]
            );
            const user = result.rows[0];
            if (!user?.password_hash) return null; // no account or OAuth-only user
            const valid = await verifyPassword(
              credentials.password as string,
              user.password_hash
            );
            if (!valid) return null;
            return { id: user.id, name: user.name, email: user.email };
          } finally {
            await pool.end();
          }
        },
      }),

      ...oauthProviders,
    ],

    pages: {
      signIn: "/login",
      error: "/login",
    },

    callbacks: {
      /**
       * Populate session.user.id from either the DB user record (database
       * strategy) or the JWT subject claim (jwt strategy).
       */
      session({ session, user, token }) {
        if (session.user) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const dbId = (user as any)?.id as string | undefined;
          const jwtId = (token as { sub?: string } | undefined)?.sub;
          session.user.id = dbId ?? jwtId ?? "";
        }
        return session;
      },
    },
  };
});
