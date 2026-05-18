"use client";

/**
 * LoginForm — client component for /login
 *
 * Uses React 19 useActionState to call the loginAction Server Action and
 * display validation / server errors without a full page reload.
 *
 * On success: calls useSession().update() to refresh the JWT state in the
 * client-side session cache (so the Navbar sees the new session immediately),
 * then navigates to the redirectTo URL from the action result.
 *
 * When DATABASE_URL is not configured, the action returns a friendly message
 * instead of an authentication attempt.
 */

import { useActionState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { loginAction, type LoginState } from "@/app/(store)/login/actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { update } = useSession();

  const callbackUrl = searchParams.get("callbackUrl") ?? "";

  // After a successful login, refresh the session in useSession() before
  // navigating — this updates the Navbar without requiring a full page reload.
  useEffect(() => {
    if (state.success && state.redirectTo) {
      update().then(() => {
        router.push(state.redirectTo!);
      });
    }
  }, [state.success, state.redirectTo, update, router]);

  return (
    <form action={formAction} className="space-y-4">
      {/* Pass callbackUrl through the form so the action can read it */}
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      {/* Error banner */}
      {state.error && (
        <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
          <span>{state.error}</span>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="email">Correo electrónico</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="tu@correo.com"
          autoComplete="email"
          required
          disabled={isPending}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Contraseña</Label>
          <Link
            href="/forgot-password"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
        <PasswordInput
          id="password"
          name="password"
          placeholder="••••••••"
          autoComplete="current-password"
          required
          disabled={isPending}
        />
      </div>

      <Button type="submit" className="w-full" size="lg" disabled={isPending}>
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Verificando…
          </>
        ) : (
          "Iniciar sesión"
        )}
      </Button>

      <div className="mt-2">
        <div className="relative">
          <Separator />
          <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center">
            <span className="bg-background px-3 text-xs text-muted-foreground">
              o continúa con
            </span>
          </span>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2">
          {/* OAuth buttons — enabled when providers are configured (Phase 6B) */}
          <Button variant="outline" type="button" className="w-full" disabled>
            Google (próximamente)
          </Button>
        </div>
      </div>
    </form>
  );
}
