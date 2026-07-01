/**
 * OrderTimeline — vertical, read-only status history for the order detail page.
 * Renders the append-only statusHistory (oldest → newest) with customer-friendly
 * labels, dates, and any admin note. Server component (pure render).
 */

import { History } from "lucide-react";
import { ORDER_STATUS_LABELS } from "@/types/order";
import type { OrderStatusChange } from "@/types/order";

interface Props {
  entries: OrderStatusChange[];
}

const ACTOR_LABELS: Record<string, string> = {
  customer: "Tú",
  admin: "La tienda",
  system: "Sistema",
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("es-MX", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "";
  }
}

export function OrderTimeline({ entries }: Props) {
  if (entries.length === 0) return null;

  return (
    <section className="rounded-xl border border-border bg-card px-5 py-4">
      <div className="flex items-center gap-2 mb-4">
        <History className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Seguimiento</h2>
      </div>

      <ol className="relative border-l border-border ml-1.5 space-y-4">
        {entries.map((entry, i) => {
          const isLast = i === entries.length - 1;
          return (
            <li key={`${entry.status}-${entry.changedAt ?? i}`} className="ml-4">
              <span
                className={`absolute -left-[5px] mt-1 h-2.5 w-2.5 rounded-full border ${
                  isLast
                    ? "bg-primary border-primary"
                    : "bg-muted border-border"
                }`}
                aria-hidden
              />
              <p className="text-sm font-medium text-card-foreground">
                {ORDER_STATUS_LABELS[entry.status] ?? entry.status}
              </p>
              <p className="text-xs text-muted-foreground">
                {[formatDateTime(entry.changedAt), ACTOR_LABELS[entry.changedBy]]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {entry.note && (
                <p className="text-xs text-muted-foreground mt-0.5">{entry.note}</p>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
