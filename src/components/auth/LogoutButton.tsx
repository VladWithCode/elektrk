"use client";

/**
 * LogoutButton — client component that calls signOut() from next-auth/react.
 *
 * Use this inside Server Components (like /account) that can't import
 * next-auth/react directly. Renders a styled button that:
 *   - calls signOut({ callbackUrl }) on click
 *   - redirects to "/" by default (configurable via `callbackUrl`)
 *   - accepts className for layout customisation
 *   - is safe to render when there is no active session (signOut is a no-op)
 */

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogoutButtonProps {
  callbackUrl?: string;
  className?: string;
  children?: React.ReactNode;
}

export function LogoutButton({
  callbackUrl = "/",
  className,
  children,
}: LogoutButtonProps) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl })}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium",
        "text-destructive hover:bg-destructive/10 transition-colors w-full",
        className
      )}
    >
      <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
      {children ?? "Cerrar sesión"}
    </button>
  );
}
