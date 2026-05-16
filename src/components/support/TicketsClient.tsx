"use client";

/**
 * TicketsClient — interactive ticket list and creation form
 *
 * Server Component (page.tsx) fetches real data and passes it here.
 * This client component handles:
 * - Form state and submission
 * - Filtering by status
 * - Creating new tickets via the createTicket() action
 */

import { useState, useMemo } from "react";
import { AlertCircle, CheckCircle, Clock, MessageSquare, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import type { Ticket, TicketPriority, TicketStatus } from "@/types/ticket";
import {
  TICKET_STATUS_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_PRIORITY_OPTIONS,
  isValidTicketPriority,
} from "@/types/ticket";
import { createTicket as createTicketAction } from "@/app/(store)/support/tickets/actions";

// Status badge config
const STATUS_CONFIG: Record<
  TicketStatus,
  { label: string; icon: React.ElementType; variant: "default" | "secondary" | "outline" }
> = {
  open:        { label: TICKET_STATUS_LABELS.open,        icon: AlertCircle,  variant: "default"   },
  in_progress: { label: TICKET_STATUS_LABELS.in_progress, icon: Clock,        variant: "secondary"  },
  resolved:    { label: TICKET_STATUS_LABELS.resolved,    icon: CheckCircle,  variant: "outline"    },
};

// Form state
interface FormState {
  subject: string;
  message: string;
  priority: TicketPriority;
}

interface FormErrors {
  subject?: string;
  message?: string;
  priority?: string;
  general?: string;
}

const EMPTY_FORM: FormState = { subject: "", message: "", priority: "medium" };

function validateForm(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!form.subject.trim())
    errors.subject = "El asunto es requerido.";
  else if (form.subject.trim().length > 200)
    errors.subject = "El asunto no puede superar los 200 caracteres.";
  if (!form.message.trim())
    errors.message = "El mensaje es requerido.";
  else if (form.message.trim().length > 2000)
    errors.message = "El mensaje no puede superar los 2000 caracteres.";
  if (!isValidTicketPriority(form.priority))
    errors.priority = "Selecciona una prioridad válida.";
  return errors;
}

interface TicketsClientProps {
  initialTickets: Ticket[];
  userEmail: string;
  userAuthId: string;
}

export function TicketsClient({ initialTickets, userEmail, userAuthId }: TicketsClientProps) {
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const visibleTickets = useMemo(() => {
    const filtered =
      statusFilter === "all" ? tickets : tickets.filter((t) => t.status === statusFilter);
    return [...filtered].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [tickets, statusFilter]);

  function handleFieldChange(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors = validateForm(form);
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const ticket = await createTicketAction({
        customerAuthId: userAuthId,
        customerEmail: userEmail,
        subject: form.subject.trim(),
        message: form.message.trim(),
        priority: form.priority,
        productSlug: null,
        orderId: null,
      });

      // Refresh ticket list
      setTickets((prev) => [ticket, ...prev]);
      setForm(EMPTY_FORM);
      setErrors({});
      setShowForm(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al crear el ticket. Intenta de nuevo.";
      setErrors({ general: message });
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCancel() {
    setForm(EMPTY_FORM);
    setErrors({});
    setShowForm(false);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
      <SectionHeader
        title="Mis tickets"
        subtitle="Seguimiento de consultas y soporte técnico"
        action={
          <Button onClick={() => setShowForm((v) => !v)} className="gap-2" size="sm">
            <Plus className="h-4 w-4" />
            Nuevo ticket
          </Button>
        }
        className="mb-8"
      />

      {/* New ticket form */}
      {showForm && (
        <div className="rounded-xl border border-border bg-card p-6 mb-6">
          <h2 className="font-semibold text-card-foreground mb-4">
            Nuevo ticket de soporte
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {errors.general && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {errors.general}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="subject">
                Asunto <span className="text-destructive">*</span>
              </Label>
              <Input
                id="subject"
                value={form.subject}
                onChange={(e) => handleFieldChange("subject", e.target.value)}
                placeholder="Describe brevemente tu problema"
                maxLength={200}
                aria-invalid={Boolean(errors.subject)}
                disabled={isSubmitting}
              />
              {errors.subject && (
                <p className="text-xs text-destructive">{errors.subject}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="message">
                Descripción <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="message"
                value={form.message}
                onChange={(e) => handleFieldChange("message", e.target.value)}
                placeholder="Explica detalladamente la situación..."
                rows={4}
                maxLength={2000}
                aria-invalid={Boolean(errors.message)}
                disabled={isSubmitting}
              />
              <div className="flex justify-between items-start">
                {errors.message ? (
                  <p className="text-xs text-destructive">{errors.message}</p>
                ) : <span />}
                <p className="text-xs text-muted-foreground">{form.message.length}/2000</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="priority">Prioridad</Label>
              <select
                id="priority"
                value={form.priority}
                onChange={(e) => handleFieldChange("priority", e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                disabled={isSubmitting}
              >
                {TICKET_PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {errors.priority && (
                <p className="text-xs text-destructive">{errors.priority}</p>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Enviando…
                  </>
                ) : (
                  "Enviar ticket"
                )}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handleCancel} disabled={isSubmitting}>
                Cancelar
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Status filter */}
      {tickets.length > 0 && (
        <div className="flex gap-1 mb-4 flex-wrap">
          {(["all", "open", "in_progress", "resolved"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={[
                "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                statusFilter === s
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
              ].join(" ")}
            >
              {s === "all" ? "Todos" : TICKET_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      )}

      {/* Ticket list */}
      {visibleTickets.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title={statusFilter === "all" ? "Sin tickets abiertos" : "Sin tickets con este estado"}
          description={
            statusFilter === "all"
              ? "Cuando tengas alguna consulta o problema, abre un ticket aquí."
              : "Prueba cambiando el filtro de estado."
          }
        />
      ) : (
        <div className="space-y-3">
          {visibleTickets.map((ticket) => {
            const { label, icon: StatusIcon, variant } = STATUS_CONFIG[ticket.status];
            return (
              <div key={ticket.id} className="rounded-xl border border-border bg-card p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-card-foreground truncate">
                        {ticket.subject}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">
                        {ticket.id} · {formatDate(ticket.createdAt)}
                        {ticket.priority !== "medium" && (
                          <span className="ml-2">
                            · Prioridad:{" "}
                            <span className={ticket.priority === "high" ? "text-destructive" : ""}>
                              {TICKET_PRIORITY_LABELS[ticket.priority]}
                            </span>
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <Badge variant={variant} className="gap-1 shrink-0 text-xs">
                    <StatusIcon className="h-3 w-3" />
                    {label}
                  </Badge>
                </div>

                <Separator />

                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                  {ticket.message}
                </p>

                {(ticket.productName ?? ticket.orderId) && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {ticket.productName && <span>Producto: {ticket.productName}</span>}
                    {ticket.orderId && <span>Orden: {ticket.orderId}</span>}
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Última actualización: {formatDate(ticket.updatedAt)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-MX", {
      year: "numeric", month: "short", day: "numeric",
    });
  } catch { return iso; }
}
