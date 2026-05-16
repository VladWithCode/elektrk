"use client";

/**
 * PasswordInput — Input[type=password] with a show/hide toggle button.
 *
 * Drop-in replacement for <Input type="password" />.
 * Forwards all standard input props. The toggle button:
 *   - switches between type="password" and type="text"
 *   - has aria-label "Mostrar contraseña" / "Ocultar contraseña"
 *   - is keyboard-accessible and touch-friendly
 *   - does not submit the form (type="button")
 */

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

type PasswordInputProps = Omit<React.ComponentProps<"input">, "type">;

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, disabled, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);

    return (
      <div className="relative">
        <input
          {...props}
          ref={ref}
          type={visible ? "text" : "password"}
          disabled={disabled}
          data-slot="input"
          className={cn(
            // same styles as <Input> but with right-padding for the toggle button
            "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 pr-9 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
            className
          )}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          className={cn(
            "absolute inset-y-0 right-0 flex items-center justify-center w-9 text-muted-foreground transition-colors",
            "hover:text-foreground focus-visible:outline-none focus-visible:text-foreground",
            "disabled:pointer-events-none disabled:opacity-50"
          )}
          tabIndex={0}
        >
          {visible ? (
            <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>
      </div>
    );
  }
);
PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
