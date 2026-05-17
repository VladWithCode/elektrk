"use client";

/**
 * ProfileEditSection — inline edit form for name in /account.
 *
 * Shows "Editar perfil" button by default; when clicked, expands an inline
 * form. On success the updated name is reflected immediately (via router.refresh)
 * and the session is updated so the Navbar shows the new name.
 */

import { useActionState, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Loader2, AlertCircle, CheckCircle2, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updateProfileAction,
  type UpdateProfileState,
} from "@/app/(store)/account/actions";

interface ProfileEditSectionProps {
  currentName: string | null;
}

const initialState: UpdateProfileState = {};

export function ProfileEditSection({ currentName }: ProfileEditSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [state, formAction, isPending] = useActionState(updateProfileAction, initialState);
  const router = useRouter();
  const { update } = useSession();

  // On success: refresh session so the Navbar updates, then refresh the page
  useEffect(() => {
    if (state.success) {
      update().then(() => {
        router.refresh();
        setIsEditing(false);
      });
    }
  }, [state.success, update, router]);

  if (!isEditing) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsEditing(true)}
        className="gap-1.5"
      >
        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
        Editar perfil
      </Button>
    );
  }

  return (
    <form action={formAction} className="space-y-3 pt-1">
      {state.error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
          <span>{state.error}</span>
        </div>
      )}

      {state.success && (
        <div role="status" className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/5 px-3 py-2 text-sm text-green-700 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Perfil actualizado.</span>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="profile-name" className="text-sm">Nombre</Label>
        <Input
          id="profile-name"
          name="name"
          type="text"
          defaultValue={currentName ?? ""}
          placeholder="Tu nombre completo"
          autoComplete="name"
          maxLength={100}
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
            "Guardar"
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={() => setIsEditing(false)}
          className="gap-1.5 text-muted-foreground"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Cancelar
        </Button>
      </div>
    </form>
  );
}
