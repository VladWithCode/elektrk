"use client";

/**
 * ChangePasswordSection — password change form in /account.
 *
 * Shows a collapsible form with three fields: current password, new password,
 * confirm new password. On success, shows a confirmation and collapses.
 */

import { useActionState, useState, useEffect } from "react";
import { Loader2, AlertCircle, CheckCircle2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  changePasswordAction,
  type ChangePasswordState,
} from "@/app/(store)/account/actions";

const initialState: ChangePasswordState = {};

export function ChangePasswordSection() {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(changePasswordAction, initialState);

  useEffect(() => {
    if (state.success) {
      const timer = setTimeout(() => setIsOpen(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [state.success]);

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-card-foreground flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
          Contraseña
        </h2>
        {!isOpen && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsOpen(true)}
          >
            Cambiar contraseña
          </Button>
        )}
      </div>

      {!isOpen && (
        <p className="text-sm text-muted-foreground">
          Por seguridad, tu contraseña no se muestra. Haz clic en &ldquo;Cambiar contraseña&rdquo; para actualizarla.
        </p>
      )}

      {isOpen && (
        <>
          <Separator />
          <form action={formAction} className="space-y-4">
            {state.error && (
              <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
                <span>{state.error}</span>
              </div>
            )}

            {state.success && (
              <div role="status" className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/5 px-3 py-2 text-sm text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Contraseña actualizada correctamente.</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="currentPassword" className="text-sm">Contraseña actual</Label>
              <PasswordInput
                id="currentPassword"
                name="currentPassword"
                placeholder="••••••••"
                autoComplete="current-password"
                required
                disabled={isPending}
                className="max-w-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="newPassword" className="text-sm">Nueva contraseña</Label>
              <PasswordInput
                id="newPassword"
                name="newPassword"
                placeholder="••••••••"
                autoComplete="new-password"
                required
                disabled={isPending}
                className="max-w-xs"
              />
              <p className="text-xs text-muted-foreground">Mínimo 8 caracteres.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="text-sm">Confirmar nueva contraseña</Label>
              <PasswordInput
                id="confirmPassword"
                name="confirmPassword"
                placeholder="••••••••"
                autoComplete="new-password"
                required
                disabled={isPending}
                className="max-w-xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" disabled={isPending} className="gap-1.5">
                {isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    Guardando…
                  </>
                ) : (
                  "Actualizar contraseña"
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() => setIsOpen(false)}
                className="text-muted-foreground"
              >
                Cancelar
              </Button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
