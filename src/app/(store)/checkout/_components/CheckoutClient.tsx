"use client";

/**
 * CheckoutClient — Phase 13B
 *
 * Client-side checkout form. Receives storefront settings (shipping rate,
 * currency, taxIncluded) as props from the CheckoutPage server component.
 * All cart/auth state is read via hooks; totals use the real settings passed in.
 */

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  ShoppingBag,
  Truck,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Package,
} from "lucide-react";
import { useCart } from "@/context/CartContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/EmptyState";
import { PriceDisplay } from "@/components/shared/PriceDisplay";
import {
  formatOrderTotals,
  validateCartItems,
  validateCartStock,
} from "@/lib/pricing";
import type { StorefrontSettings } from "@/data/mock-settings";
import type { Address } from "@/types/address";
import { submitCheckout } from "../actions";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CheckoutClientProps {
  /** Real storefront settings from Payload (or MOCK_SETTINGS when DATA_SOURCE=mock). */
  settings: Pick<StorefrontSettings, "flatShippingRate" | "currency" | "taxIncludedByDefault">;
  /** Customer's saved addresses (empty when not logged in or mock mode). */
  savedAddresses?: Address[];
}

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface CheckoutForm {
  nombre: string;
  email: string;
  telefono: string;
  direccion: string;
  ciudad: string;
  estado: string;
  codigoPostal: string;
  notas: string;
}

const EMPTY_FORM: CheckoutForm = {
  nombre: "",
  email: "",
  telefono: "",
  direccion: "",
  ciudad: "",
  estado: "",
  codigoPostal: "",
  notas: "",
};

const REQUIRED_FIELDS: (keyof CheckoutForm)[] = [
  "nombre",
  "email",
  "telefono",
  "direccion",
  "ciudad",
  "estado",
  "codigoPostal",
];

/** Mexican mobile: at least 10 digits after stripping spaces/dashes/parens. */
function isValidPhone(value: string): boolean {
  return value.replace(/\D/g, "").length >= 10;
}

const ESTADOS_MX = [
  "Aguascalientes", "Baja California", "Baja California Sur", "Campeche",
  "Chiapas", "Chihuahua", "Ciudad de México", "Coahuila", "Colima",
  "Durango", "Guanajuato", "Guerrero", "Hidalgo", "Jalisco",
  "Estado de México", "Michoacán", "Morelos", "Nayarit", "Nuevo León",
  "Oaxaca", "Puebla", "Querétaro", "Quintana Roo", "San Luis Potosí",
  "Sinaloa", "Sonora", "Tabasco", "Tamaulipas", "Tlaxcala",
  "Veracruz", "Yucatán", "Zacatecas",
];

/** Stable-per-mount key so a double-submit / retry can't create two orders. */
function makeIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CheckoutClient({ settings, savedAddresses = [] }: CheckoutClientProps) {
  const { data: session, status: sessionStatus } = useSession();
  const { items, clear } = useCart();

  // Pick the default address (or first) so we can pre-populate the form on mount.
  const defaultAddr =
    savedAddresses.find((a) => a.isDefault) ?? savedAddresses[0] ?? null;

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    defaultAddr?.id ?? null
  );

  // Initialize form with default address data immediately (synchronous prop).
  // Nombre/email are filled by the session useEffect below once auth resolves.
  const [form, setForm] = useState<CheckoutForm>(() => {
    if (!defaultAddr) return EMPTY_FORM;
    return {
      ...EMPTY_FORM,
      telefono: defaultAddr.phone ?? "",
      direccion:
        defaultAddr.addressLine1 +
        (defaultAddr.addressLine2 ? `, ${defaultAddr.addressLine2}` : ""),
      ciudad: defaultAddr.city,
      estado: defaultAddr.state,
      codigoPostal: defaultAddr.postalCode,
    };
  });
  const [submitState, setSubmitState] = useState<"idle" | "loading" | "error">("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Generated once per checkout mount; reused across retries so the server
  // dedupes resubmissions into a single order (§2.4).
  const [idempotencyKey] = useState(makeIdempotencyKey);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof CheckoutForm, string>>>({});

  // Prefill contact fields from session when it becomes available.
  // Only fills empty fields so the user can still override manually.
  useEffect(() => {
    if (session?.user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm((prev) => ({
        ...prev,
        nombre: prev.nombre || session.user?.name || "",
        email: prev.email || session.user?.email || "",
      }));
    }
  }, [session]);

  // Populates address fields when user selects a saved address.
  // Always overwrites shipping fields (user chose this address explicitly).
  // Preserves contact fields (nombre, email) already typed/filled from session.
  function handleAddressSelect(addr: Address) {
    setSelectedAddressId(addr.id);
    setForm((prev) => ({
      ...prev,
      telefono: addr.phone ?? prev.telefono,
      direccion: addr.addressLine1 + (addr.addressLine2 ? `, ${addr.addressLine2}` : ""),
      ciudad: addr.city,
      estado: addr.state,
      codigoPostal: addr.postalCode,
    }));
  }

  // Compute totals using real settings from Payload
  const totals = useMemo(
    () => formatOrderTotals(items, settings),
    [items, settings]
  );

  // Cart validation errors
  const cartErrors = useMemo(
    () => [...validateCartItems(items), ...validateCartStock(items)],
    [items]
  );
  const cartIsValid = cartErrors.length === 0;

  // Form completeness check (phone must also be a valid 10-digit number)
  const isFormComplete =
    REQUIRED_FIELDS.every((f) => form[f].trim().length > 0) &&
    isValidPhone(form.telefono);

  const isGuest = sessionStatus !== "loading" && !session?.user;

  // --- Empty cart ---
  if (items.length === 0 && submitState !== "loading") {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
        <EmptyState
          icon={ShoppingBag}
          title="Tu carrito está vacío"
          description="Agrega productos desde el catálogo para continuar con tu compra."
          action={
            <Button asChild>
              <Link href="/products">Ver catálogo</Link>
            </Button>
          }
        />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleField(key: keyof CheckoutForm, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (fieldErrors[key]) {
      setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  }

  function validateForm(): boolean {
    const errors: Partial<Record<keyof CheckoutForm, string>> = {};
    for (const field of REQUIRED_FIELDS) {
      if (!form[field].trim()) {
        const labels: Record<keyof CheckoutForm, string> = {
          nombre: "Nombre", email: "Correo electrónico", telefono: "Celular",
          direccion: "Dirección", ciudad: "Ciudad", estado: "Estado",
          codigoPostal: "Código postal", notas: "Notas",
        };
        errors[field] = `${labels[field]} es requerido.`;
      }
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errors.email = "El correo electrónico no es válido.";
    }
    if (form.telefono && !isValidPhone(form.telefono)) {
      errors.telefono = "El celular debe tener al menos 10 dígitos.";
    }
    if (form.codigoPostal && !/^\d{5}$/.test(form.codigoPostal)) {
      errors.codigoPostal = "El código postal debe tener 5 dígitos.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    // Guard against re-entry (double click / Enter) while a submit is in flight.
    if (submitState === "loading") return;

    if (!validateForm()) return;
    if (!cartIsValid) {
      setSubmitError("Hay problemas con los artículos en tu carrito. Revísalos antes de continuar.");
      return;
    }

    setSubmitState("loading");

    try {
      const result = await submitCheckout({
        items: items.map((item) => ({
          productId: item.productId,
          productSlug: item.productSlug,
          productName: item.productName,
          variantSku: item.variantSku,
          variantLabel: item.variantLabel,
          price: item.price,
          quantity: item.quantity,
        })),
        email: form.email,
        shippingName: form.nombre,
        shippingAddress: form.direccion,
        shippingCity: form.ciudad,
        shippingState: form.estado,
        shippingPostalCode: form.codigoPostal,
        shippingPhone: form.telefono,
        notes: form.notas,
        idempotencyKey,
      });

      // Clear cart before redirecting (order is saved in Payload).
      clear();
      // The success page shows the order number + the "Enviar por WhatsApp"
      // button that opens the pre-filled message to the store.
      const tokenParam = result.guestToken
        ? `&t=${encodeURIComponent(result.guestToken)}`
        : "";
      window.location.href = `/checkout/success?orderId=${encodeURIComponent(result.orderId)}${tokenParam}`;
    } catch (err) {
      setSubmitState("error");
      const msg = err instanceof Error ? err.message : "Error al procesar el pedido. Inténtalo de nuevo.";
      setSubmitError(msg);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
        <Link href="/cart" className="flex items-center gap-1 hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          Carrito
        </Link>
        <span>/</span>
        <span className="text-foreground">Checkout</span>
      </nav>

      {/* Cart-level validation errors */}
      {!cartIsValid && (
        <div role="alert" className="mb-6 rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-3 space-y-1">
          {cartErrors.map((err) => (
            <div key={err.sku ?? err.type} className="flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
              <span>{err.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Guest notice — checkout works without an account */}
      {isGuest && (
        <div className="mb-6 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Puedes comprar como invitado. Si tienes cuenta,{" "}
          <Link
            href="/login?callbackUrl=/checkout"
            className="font-medium text-foreground underline underline-offset-2"
          >
            inicia sesión
          </Link>{" "}
          para prellenar y guardar tus datos.
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* ----------------------------------------------------------------
              LEFT — Contact + Shipping form
          ---------------------------------------------------------------- */}
          <div className="lg:col-span-3 space-y-8">

            {/* Contact */}
            <section className="rounded-xl border border-border bg-card p-6 space-y-5">
              <h2 className="text-base font-semibold text-card-foreground">
                Datos de contacto
              </h2>
              <div className="grid grid-cols-1 gap-4">
                <FormField
                  id="nombre" label="Nombre completo" required
                  value={form.nombre} error={fieldErrors.nombre}
                  onChange={(v) => handleField("nombre", v)}
                  placeholder="Juan García"
                  autoComplete="name"
                />
                <FormField
                  id="email" label="Correo electrónico" required type="email"
                  value={form.email} error={fieldErrors.email}
                  onChange={(v) => handleField("email", v)}
                  placeholder="tu@correo.com"
                  autoComplete="email"
                />
                <FormField
                  id="telefono" label="Celular" required type="tel"
                  value={form.telefono} error={fieldErrors.telefono}
                  onChange={(v) => handleField("telefono", v)}
                  placeholder="55 1234 5678"
                  autoComplete="tel"
                />
              </div>
            </section>

            {/* Shipping address */}
            <section className="rounded-xl border border-border bg-card p-6 space-y-5">
              <h2 className="text-base font-semibold text-card-foreground flex items-center gap-2">
                <Truck className="h-4 w-4 text-muted-foreground" />
                Dirección de entrega
              </h2>

              {/* Saved address selector */}
              {savedAddresses.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Mis domicilios guardados
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    {savedAddresses.map((addr) => (
                      <label
                        key={addr.id}
                        className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                          selectedAddressId === addr.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-accent/30"
                        }`}
                      >
                        <input
                          type="radio"
                          name="savedAddress"
                          value={addr.id}
                          checked={selectedAddressId === addr.id}
                          onChange={() => handleAddressSelect(addr)}
                          className="mt-0.5 shrink-0"
                        />
                        <div className="text-sm min-w-0">
                          <p className="font-medium text-card-foreground">{addr.label}</p>
                          <p className="text-muted-foreground text-xs">
                            {addr.addressLine1}, {addr.city}, {addr.state} {addr.postalCode}
                          </p>
                        </div>
                      </label>
                    ))}
                    <label className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                      selectedAddressId === null
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-accent/30"
                    }`}>
                      <input
                        type="radio"
                        name="savedAddress"
                        value=""
                        checked={selectedAddressId === null}
                        onChange={() => setSelectedAddressId(null)}
                        className="mt-0.5 shrink-0"
                      />
                      <span className="text-sm text-card-foreground">Ingresar nueva dirección</span>
                    </label>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4">
                <FormField
                  id="direccion" label="Dirección" required
                  value={form.direccion} error={fieldErrors.direccion}
                  onChange={(v) => handleField("direccion", v)}
                  placeholder="Calle Reforma 123, Col. Centro"
                  autoComplete="street-address"
                />
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    id="ciudad" label="Ciudad" required
                    value={form.ciudad} error={fieldErrors.ciudad}
                    onChange={(v) => handleField("ciudad", v)}
                    placeholder="Ciudad de México"
                    autoComplete="address-level2"
                  />
                  <div className="space-y-1.5">
                    <Label htmlFor="estado" className="text-sm">
                      Estado <span className="text-destructive">*</span>
                    </Label>
                    <select
                      id="estado"
                      value={form.estado}
                      onChange={(e) => handleField("estado", e.target.value)}
                      autoComplete="address-level1"
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                    >
                      <option value="">Selecciona…</option>
                      {ESTADOS_MX.map((e) => (
                        <option key={e} value={e}>{e}</option>
                      ))}
                    </select>
                    {fieldErrors.estado && (
                      <p className="text-xs text-destructive">{fieldErrors.estado}</p>
                    )}
                  </div>
                </div>
                <FormField
                  id="codigoPostal" label="Código postal" required
                  value={form.codigoPostal} error={fieldErrors.codigoPostal}
                  onChange={(v) => handleField("codigoPostal", v)}
                  placeholder="06600"
                  autoComplete="postal-code"
                  maxLength={5}
                  className="max-w-[180px]"
                />
              </div>
            </section>

            {/* Notes */}
            <section className="rounded-xl border border-border bg-card p-6 space-y-3">
              <h2 className="text-base font-semibold text-card-foreground">
                Notas del pedido
              </h2>
              <div className="space-y-1.5">
                <Label htmlFor="notas" className="text-sm text-muted-foreground">
                  Instrucciones especiales de entrega (opcional)
                </Label>
                <textarea
                  id="notas"
                  value={form.notas}
                  onChange={(e) => handleField("notas", e.target.value)}
                  rows={3}
                  placeholder="Ej. Entregar en horario de oficina, preguntar por recepción."
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring placeholder:text-muted-foreground resize-none"
                />
              </div>
            </section>

            {/* Submit error — supports multi-line stock messages (split on \n) */}
            {submitError && (
              <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
                <div className="space-y-0.5">
                  {submitError.split("\n").map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              </div>
            )}

            {/* WhatsApp notice */}
            <div className="flex items-start gap-2.5 rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-3 text-sm text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Tu orden se registra y luego te mostramos un botón para
                <strong> enviar tu pedido por WhatsApp</strong>. Ahí coordinamos
                el pago (transferencia o en tienda) y la entrega.
              </span>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full gap-2"
              disabled={!cartIsValid || !isFormComplete || submitState === "loading"}
            >
              {submitState === "loading" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generando pedido…
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Continuar por WhatsApp
                </>
              )}
            </Button>
          </div>

          {/* ----------------------------------------------------------------
              RIGHT — Order summary
          ---------------------------------------------------------------- */}
          <aside className="lg:col-span-2">
            <div className="sticky top-20 rounded-xl border border-border bg-card p-6 space-y-5">
              <h2 className="font-semibold text-card-foreground flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                Resumen del pedido
              </h2>

              {/* Line items */}
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.variantSku} className="flex items-start gap-3">
                    <div className="w-10 h-10 shrink-0 rounded-lg bg-muted flex items-center justify-center">
                      <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-card-foreground line-clamp-1">
                        {item.productName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.variantLabel} · {item.brand}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <Badge variant="outline" className="text-xs font-mono px-1.5 py-0">
                          ×{item.quantity}
                        </Badge>
                        <PriceDisplay price={item.price * item.quantity} size="sm" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Totals */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Subtotal ({totals.itemCount} artículo{totals.itemCount !== 1 ? "s" : ""})
                  </span>
                  <span className="font-medium">{totals.formatted.subtotal}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Truck className="h-3.5 w-3.5" />
                    Envío (tarifa plana)
                  </span>
                  <span className="font-medium">{totals.formatted.shipping}</span>
                </div>
              </div>

              <Separator />

              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span className="text-lg">{totals.formatted.total}</span>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                {totals.taxIncluded ? "IVA incluido en el precio" : "IVA no incluido"}
              </p>
            </div>
          </aside>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FormField helper component
// ---------------------------------------------------------------------------

interface FormFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  maxLength?: number;
  className?: string;
}

function FormField({
  id, label, value, onChange, error, required, type = "text",
  placeholder, autoComplete, maxLength, className,
}: FormFieldProps) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label htmlFor={id} className="text-sm">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        maxLength={maxLength}
        className={error ? "border-destructive focus-visible:ring-destructive" : ""}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
