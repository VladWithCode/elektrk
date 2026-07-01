"use client";

/**
 * OrderActionsBar — owner-only actions on the order detail page, shown while the
 * order is still pending / awaiting payment review:
 *   - Re-send the pre-filled WhatsApp message (records the hand-off, §7.1).
 *   - Cancel the order (§7.2, with an inline confirmation).
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cancelOrder, recordWhatsAppSent } from "../actions";

interface Props {
  orderId: string;
  /** Pre-built wa.me link, or null when the store has no WhatsApp configured. */
  whatsappUrl: string | null;
  canCancel: boolean;
}

export function OrderActionsBar({ orderId, whatsappUrl, canCancel }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleWhatsApp() {
    // Record the hand-off (fire-and-forget) then open WhatsApp synchronously so
    // the popup is not blocked.
    void recordWhatsAppSent(orderId);
    if (whatsappUrl) {
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    }
  }

  function handleCancel() {
    setError(null);
    startTransition(async () => {
      const res = await cancelOrder(orderId);
      if (res.ok) {
        setConfirming(false);
        router.refresh();
      } else {
        setError(res.error ?? "No se pudo cancelar la orden.");
      }
    });
  }

  if (!whatsappUrl && !canCancel) return null;

  return (
    <section className="rounded-xl border border-border bg-card px-5 py-4 space-y-3">
      {whatsappUrl && (
        <Button
          onClick={handleWhatsApp}
          className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
        >
          <MessageCircle className="h-4 w-4" />
          Enviar / reenviar por WhatsApp
        </Button>
      )}

      {canCancel &&
        (confirming ? (
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 space-y-3">
            <p className="text-sm text-card-foreground">
              ¿Seguro que quieres cancelar esta orden? Esta acción no se puede
              deshacer.
            </p>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleCancel}
                disabled={pending}
                className="gap-2"
              >
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Sí, cancelar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirming(false)}
                disabled={pending}
              >
                No, conservar
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setConfirming(true)}
          >
            Cancelar orden
          </Button>
        ))}

      {error && (
        <div role="alert" className="flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </section>
  );
}
