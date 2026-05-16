import type { TicketStatus } from "@/types/ticket";
import { AlertCircle, CheckCircle, Clock } from "lucide-react";

export const SPEC_LABELS: Record<string, string> = {
  amperage: "Amperaje",
  poles: "Polos",
  voltage: "Voltaje",
  tripCurve: "Curva de disparo",
  brand: "Marca",
  model: "Modelo",
  category: "Categoría",
};

export const TICKET_STATUS_CONFIG: Record<
  TicketStatus,
  { label: string; icon: React.ElementType; variant: "default" | "secondary" | "outline" }
> = {
  open: { label: "Abierto", icon: AlertCircle, variant: "default" },
  in_progress: { label: "En proceso", icon: Clock, variant: "secondary" },
  resolved: { label: "Resuelto", icon: CheckCircle, variant: "outline" },
};

// ORDER_STATUS_VARIANT keyed by canonical OrderStatus (Phase 10A).
// See ORDER_STATUS_BADGE_VARIANT in src/types/order.ts for the full record.
export const ORDER_STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "outline"
> = {
  // Legacy Spanish keys — kept for any remaining uses
  Entregado:    "secondary",
  "En tránsito":"default",
  Pendiente:    "outline",
  // Canonical English keys
  fulfilled: "default",
  paid:      "secondary",
  pending:   "outline",
  cancelled: "outline",
  failed:    "outline",
};
