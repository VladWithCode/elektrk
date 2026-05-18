"use client";

/**
 * RegisterForm — client component for /register
 *
 * Uses React 19 useActionState to call the registerAction Server Action.
 *
 * On success: calls useSession().update() to refresh the JWT state in the
 * client-side session cache (so the Navbar sees the new session immediately),
 * then navigates to the redirectTo URL from the action result.
 *
 * Same pattern as LoginForm — avoids the bug where a server-side redirect
 * bypasses update() and leaves the Navbar showing "Iniciar sesión".
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
import { registerAction, type RegisterState } from "@/app/(store)/register/actions";

const initialState: RegisterState = {};

export function RegisterForm() {
  const [state, formAction, isPending] = useActionState(registerAction, initialState);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { update } = useSession();

  const callbackUrl = searchParams.get("callbackUrl") ?? "";

  // After a successful registration, refresh the session in useSession() before
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

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="firstName">Nombre</Label>
          <Input
            id="firstName"
            name="firstName"
            placeholder="Juan"
            autoComplete="given-name"
            required
            disabled={isPending}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lastName">Apellido</Label>
          <Input
            id="lastName"
            name="lastName"
            placeholder="García"
            autoComplete="family-name"
            disabled={isPending}
          />
        </div>
      </div>

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
        <Label htmlFor="password">Contraseña</Label>
        <PasswordInput
          id="password"
          name="password"
          placeholder="Mínimo 8 caracteres"
          autoComplete="new-password"
          required
          disabled={isPending}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          placeholder="••••••••"
          autoComplete="new-password"
          required
          disabled={isPending}
        />
      </div>

      <Button
        type="submit"
        className="w-full"
        size="lg"
        disabled={isPending || !!state.success}
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Creando cuenta…
          </>
        ) : (
          "Crear cuenta"
        )}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        Al registrarte aceptas nuestros{" "}
        <Link href="#" className="underline hover:text-foreground">
          Términos de servicio
        </Link>{" "}
        y{" "}
        <Link href="#" className="underline hover:text-foreground">
          Política de privacidad
        </Link>
        .
      </p>
    </form>
  );
}
