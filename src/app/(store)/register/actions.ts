"use server";

/**
 * Register Server Action — Phase 6B (Neon + Credentials active)
 *
 * Called by RegisterForm via useActionState. Validates input, hashes the
 * password, and creates the user record in the `users` Auth.js table.
 *
 * On success: returns { success: true, redirectTo } so the client component
 * can call useSession().update() before navigating — this ensures the Navbar
 * sees the new session immediately without a full page reload.
 *
 * NOTE: redirect() must NOT be used here because it bypasses the client,
 * preventing RegisterForm from calling update(). Same pattern as loginAction.
 */

import { isAuthConfigured } from "@auth";
import { hashPassword } from "@/lib/auth/password";
import { Pool } from "@neondatabase/serverless";

export interface RegisterState {
  error?: string;
  success?: boolean;
  /** Client-side redirect target — only present on success. */
  redirectTo?: string;
}

// Minimum password requirements
const MIN_PASSWORD_LENGTH = 8;

export async function registerAction(
  _prevState: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  // Guard: auth backend not yet connected
  if (!isAuthConfigured()) {
    return {
      error:
        "El registro real requiere base de datos configurada. " +
        "Sigue los pasos en docs/NEON_SETUP.md para conectar Neon.",
    };
  }

  // Extract fields
  const firstName = (formData.get("firstName") as string | null)?.trim() ?? "";
  const lastName = (formData.get("lastName") as string | null)?.trim() ?? "";
  const name = `${firstName} ${lastName}`.trim();
  const email = (formData.get("email") as string | null)?.trim() ?? "";
  const password = (formData.get("password") as string | null) ?? "";
  const confirmPassword = (formData.get("confirmPassword") as string | null) ?? "";
  const rawCallback = (formData.get("callbackUrl") as string | null) ?? "";

  // Only allow internal routes to prevent open-redirect attacks
  const redirectTo =
    rawCallback.startsWith("/") && !rawCallback.startsWith("//")
      ? rawCallback
      : "/account";

  // Validation
  if (!firstName) return { error: "El nombre es requerido." };
  if (!email) return { error: "El correo electrónico es requerido." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "El correo electrónico no es válido." };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    };
  }
  if (password !== confirmPassword) {
    return { error: "Las contraseñas no coinciden." };
  }

  // Hash the password with scrypt (Node.js crypto — no external deps)
  const passwordHash = await hashPassword(password);

  // Phase 6B — insert into Neon and auto-login
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const normalizedEmail = email.toLowerCase();

    // Reject duplicate emails
    const existing = await pool.query(
      "SELECT id FROM users WHERE email = $1 LIMIT 1",
      [normalizedEmail]
    );
    if (existing.rows.length > 0) {
      return { error: "Ya existe una cuenta con ese correo electrónico." };
    }

    // Insert into Auth.js `users` table
    await pool.query(
      `INSERT INTO users (id, name, email, "emailVerified", password_hash)
       VALUES (gen_random_uuid()::text, $1, $2, NULL, $3)`,
      [name, normalizedEmail, passwordHash]
    );
  } finally {
    await pool.end();
  }

  // Sign in immediately after registration (sets JWT cookie in HTTP response)
  const { signIn } = await import("@auth");
  await signIn("credentials", { email: email.toLowerCase(), password, redirect: false });

  // Return success + destination so the client can call update() before navigating.
  // This ensures useSession() in the Navbar reflects the new session immediately.
  return { success: true, redirectTo };
}
