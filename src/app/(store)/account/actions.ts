"use server";

/**
 * Account Server Actions — ElektrK
 *
 * Provides:
 *   - updateProfileAction: update name (and optionally phone) in Auth.js users table
 *   - changePasswordAction: verify current password then store a new hash
 *
 * Both actions require an active session. They read user.id from the JWT
 * and hit the Neon `users` table directly (same DB the Neon adapter uses).
 *
 * Guards:
 *   - isAuthConfigured() → friendly error when DATABASE_URL is missing
 *   - requireUser() → redirects to /login if session expired
 */

import { isAuthConfigured } from "@auth";
import { getSessionSafe } from "@/lib/auth/helpers";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { Pool } from "@neondatabase/serverless";

// ---------------------------------------------------------------------------
// updateProfileAction
// ---------------------------------------------------------------------------

export interface UpdateProfileState {
  error?: string;
  success?: boolean;
}

export async function updateProfileAction(
  _prevState: UpdateProfileState,
  formData: FormData
): Promise<UpdateProfileState> {
  if (!isAuthConfigured()) {
    return { error: "Base de datos no configurada. Conecta Neon para habilitar esta función." };
  }

  const session = await getSessionSafe();
  if (!session?.user?.id) {
    return { error: "Sesión no encontrada. Inicia sesión nuevamente." };
  }

  const name = (formData.get("name") as string | null)?.trim() ?? "";
  if (!name) return { error: "El nombre es requerido." };
  if (name.length > 100) return { error: "El nombre no puede superar los 100 caracteres." };

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query(
      "UPDATE users SET name = $1 WHERE id = $2",
      [name, session.user.id]
    );
    return { success: true };
  } catch {
    return { error: "Error al actualizar el perfil. Inténtalo de nuevo." };
  } finally {
    await pool.end();
  }
}

// ---------------------------------------------------------------------------
// changePasswordAction
// ---------------------------------------------------------------------------

export interface ChangePasswordState {
  error?: string;
  success?: boolean;
}

const MIN_PASSWORD_LENGTH = 8;

export async function changePasswordAction(
  _prevState: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  if (!isAuthConfigured()) {
    return { error: "Base de datos no configurada. Conecta Neon para habilitar esta función." };
  }

  const session = await getSessionSafe();
  if (!session?.user?.id) {
    return { error: "Sesión no encontrada. Inicia sesión nuevamente." };
  }

  const currentPassword = (formData.get("currentPassword") as string | null) ?? "";
  const newPassword = (formData.get("newPassword") as string | null) ?? "";
  const confirmPassword = (formData.get("confirmPassword") as string | null) ?? "";

  if (!currentPassword) return { error: "La contraseña actual es requerida." };
  if (!newPassword) return { error: "La nueva contraseña es requerida." };
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return { error: `La nueva contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.` };
  }
  if (newPassword !== confirmPassword) {
    return { error: "Las contraseñas no coinciden." };
  }
  if (currentPassword === newPassword) {
    return { error: "La nueva contraseña debe ser diferente a la actual." };
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const result = await pool.query(
      "SELECT password_hash FROM users WHERE id = $1 LIMIT 1",
      [session.user.id]
    );
    const user = result.rows[0];
    if (!user?.password_hash) {
      return { error: "Esta cuenta no tiene contraseña configurada (usa OAuth)." };
    }

    const valid = await verifyPassword(currentPassword, user.password_hash);
    if (!valid) {
      return { error: "La contraseña actual es incorrecta." };
    }

    const newHash = await hashPassword(newPassword);
    await pool.query(
      "UPDATE users SET password_hash = $1 WHERE id = $2",
      [newHash, session.user.id]
    );
    return { success: true };
  } catch {
    return { error: "Error al cambiar la contraseña. Inténtalo de nuevo." };
  } finally {
    await pool.end();
  }
}
