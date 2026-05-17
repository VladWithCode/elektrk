"use server";

/**
 * Login Server Action
 *
 * Called by LoginForm via useActionState. Returns a typed result object
 * so the form can display errors without a full page reload.
 *
 * On success, returns { success: true, redirectTo } so the client component
 * can call useSession().update() to refresh the JWT cookie, then router.push()
 * — this avoids the bug where a server-side redirect sets the cookie but the
 * client-side useSession() hook in the Navbar never sees it without a full reload.
 *
 * Guards:
 *   - If DATABASE_URL is not set → friendly message (DB_NOT_CONFIGURED)
 *   - Basic field validation before attempting signIn
 *   - Auth.js errors are caught and translated to user-friendly messages
 */

import { isAuthConfigured } from "@auth";

export interface LoginState {
  error?: string;
  success?: boolean;
  redirectTo?: string;
}

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  // Guard: auth backend not yet connected
  if (!isAuthConfigured()) {
    return {
      error:
        "El inicio de sesión real requiere base de datos configurada. " +
        "Sigue los pasos en docs/NEON_SETUP.md para conectar Neon.",
    };
  }

  const email = (formData.get("email") as string | null)?.trim() ?? "";
  const password = (formData.get("password") as string | null) ?? "";
  const rawCallback = (formData.get("callbackUrl") as string | null) ?? "";

  // Only allow internal routes to prevent open-redirect attacks
  const redirectTo =
    rawCallback.startsWith("/") && !rawCallback.startsWith("//")
      ? rawCallback
      : "/account";

  // Basic field validation
  if (!email) return { error: "El correo electrónico es requerido." };
  if (!password) return { error: "La contraseña es requerida." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "El correo electrónico no es válido." };
  }

  try {
    const { signIn } = await import("@auth");
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Auth.js v5 errors carry the type in .name (e.g. "CredentialsSignin")
    const name = err instanceof Error ? (err.name ?? "") : "";

    if (message === "DB_NOT_CONFIGURED") {
      return {
        error:
          "El inicio de sesión real requiere base de datos configurada. " +
          "Sigue los pasos en docs/NEON_SETUP.md para conectar Neon.",
      };
    }

    // Auth.js throws CredentialsSignin when authorize() returns null.
    // In v5 the type appears in error.name; the message may be a docs URL.
    if (
      name.includes("CredentialsSignin") ||
      message.includes("CredentialsSignin") ||
      message.includes("credentials")
    ) {
      return { error: "Credenciales incorrectas. Verifica tu correo y contraseña." };
    }

    return { error: "Error al iniciar sesión. Inténtalo de nuevo." };
  }

  // Return success + destination so the client can call update() before navigating.
  // This ensures useSession() in the Navbar reflects the new session immediately.
  return { success: true, redirectTo };
}
