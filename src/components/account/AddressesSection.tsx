"use client";

/**
 * AddressesSection — saved addresses management in /account.
 *
 * Lists existing addresses and provides a form to add new ones.
 * Each address can be set as default or deleted.
 */

import { useActionState, useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Plus, Star, Trash2, Loader2, AlertCircle, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import type { Address } from "@/types/address";
import {
  createAddressAction,
  deleteAddressAction,
  setDefaultAddressAction,
  type AddressFormState,
} from "@/app/(store)/account/address-actions";

const ESTADOS_MX = [
  "Aguascalientes", "Baja California", "Baja California Sur", "Campeche",
  "Chiapas", "Chihuahua", "Ciudad de México", "Coahuila", "Colima",
  "Durango", "Guanajuato", "Guerrero", "Hidalgo", "Jalisco",
  "Estado de México", "Michoacán", "Morelos", "Nayarit", "Nuevo León",
  "Oaxaca", "Puebla", "Querétaro", "Quintana Roo", "San Luis Potosí",
  "Sinaloa", "Sonora", "Tabasco", "Tamaulipas", "Tlaxcala",
  "Veracruz", "Yucatán", "Zacatecas",
];

interface AddressesSectionProps {
  initialAddresses: Address[];
}

const initialFormState: AddressFormState = {};

export function AddressesSection({ initialAddresses }: AddressesSectionProps) {
  const [addresses, setAddresses] = useState<Address[]>(initialAddresses);
  const [showForm, setShowForm] = useState(false);
  const [state, formAction, isPending] = useActionState(createAddressAction, initialFormState);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPendingAction, startTransition] = useTransition();
  const router = useRouter();

  // On successful create, hide form and refresh
  useEffect(() => {
    if (state.success) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowForm(false);
      router.refresh();
    }
  }, [state.success, router]);

  function handleDelete(id: string) {
    startTransition(async () => {
      setActionError(null);
      const result = await deleteAddressAction(id);
      if (result.error) {
        setActionError(result.error);
      } else {
        setAddresses((prev) => prev.filter((a) => a.id !== id));
        router.refresh();
      }
    });
  }

  function handleSetDefault(id: string) {
    startTransition(async () => {
      setActionError(null);
      const result = await setDefaultAddressAction(id);
      if (result.error) {
        setActionError(result.error);
      } else {
        setAddresses((prev) =>
          prev.map((a) => ({ ...a, isDefault: a.id === id }))
        );
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-card-foreground flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          Mis domicilios
        </h2>
        {!showForm && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowForm(true)}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Agregar domicilio
          </Button>
        )}
      </div>

      {actionError && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Address list */}
      {addresses.length === 0 && !showForm ? (
        <p className="text-sm text-muted-foreground">
          Aún no tienes domicilios guardados. Agrega uno para agilizar el checkout.
        </p>
      ) : (
        <div className="space-y-3">
          {addresses.map((address) => (
            <div
              key={address.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-border p-4"
            >
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-card-foreground">{address.label}</p>
                  {address.isDefault && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <Star className="h-2.5 w-2.5 fill-current" aria-hidden="true" />
                      Predeterminado
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{address.fullName}</p>
                <p className="text-xs text-muted-foreground">
                  {address.addressLine1}
                  {address.addressLine2 ? `, ${address.addressLine2}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {address.city}, {address.state} {address.postalCode}
                </p>
                {address.phone && (
                  <p className="text-xs text-muted-foreground">{address.phone}</p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {!address.isDefault && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSetDefault(address.id)}
                    disabled={isPendingAction}
                    className="text-muted-foreground hover:text-foreground h-8 px-2"
                    title="Establecer como predeterminado"
                  >
                    <Star className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="sr-only">Predeterminado</span>
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(address.id)}
                  disabled={isPendingAction}
                  className="text-muted-foreground hover:text-destructive h-8 px-2"
                  title="Eliminar domicilio"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="sr-only">Eliminar</span>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add address form */}
      {showForm && (
        <>
          {addresses.length > 0 && <Separator />}
          <form action={formAction} className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-card-foreground">Nuevo domicilio</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowForm(false)}
                className="text-muted-foreground gap-1"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                Cancelar
              </Button>
            </div>

            {state.error && (
              <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
                <span>{state.error}</span>
              </div>
            )}

            {state.success && (
              <div role="status" className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/5 px-3 py-2 text-sm text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Domicilio guardado.</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <AddressField id="label" label="Etiqueta" name="label" placeholder="Casa, Oficina…" required disabled={isPending} />
              <AddressField id="fullName" label="Nombre del destinatario" name="fullName" placeholder="Juan García" required disabled={isPending} autoComplete="name" />
            </div>

            <AddressField id="addressLine1" label="Dirección (línea 1)" name="addressLine1" placeholder="Calle Reforma 123, Col. Centro" required disabled={isPending} autoComplete="street-address" />
            <AddressField id="addressLine2" label="Dirección (línea 2)" name="addressLine2" placeholder="Depto. 4B, piso 2 (opcional)" disabled={isPending} />

            <div className="grid grid-cols-2 gap-3">
              <AddressField id="city" label="Ciudad" name="city" placeholder="Ciudad de México" required disabled={isPending} autoComplete="address-level2" />
              <div className="space-y-1.5">
                <Label htmlFor="state-addr" className="text-sm">
                  Estado <span className="text-destructive">*</span>
                </Label>
                <select
                  id="state-addr"
                  name="state"
                  required
                  disabled={isPending}
                  autoComplete="address-level1"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                >
                  <option value="">Selecciona…</option>
                  {ESTADOS_MX.map((e) => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <AddressField id="postalCode" label="Código postal" name="postalCode" placeholder="06600" required disabled={isPending} autoComplete="postal-code" maxLength={5} />
              <AddressField id="phone" label="Teléfono" name="phone" placeholder="+52 55 1234 5678 (opcional)" disabled={isPending} autoComplete="tel" type="tel" />
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" name="isDefault" className="h-4 w-4 rounded border-input" />
              <span>Establecer como domicilio predeterminado</span>
            </label>

            <Button type="submit" size="sm" disabled={isPending} className="gap-1.5">
              {isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  Guardando…
                </>
              ) : (
                "Guardar domicilio"
              )}
            </Button>
          </form>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Field helper
// ---------------------------------------------------------------------------

interface AddressFieldProps {
  id: string;
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  autoComplete?: string;
  type?: string;
  maxLength?: number;
}

function AddressField({
  id, label, name, placeholder, required, disabled, autoComplete, type = "text", maxLength,
}: AddressFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <Input
        id={id}
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autoComplete={autoComplete}
        maxLength={maxLength}
      />
    </div>
  );
}
