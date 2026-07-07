"use client";

/**
 * OrderProofUpload — customer-facing payment-proof section on the order detail
 * page. Lists any receipts already attached (by the customer or the store),
 * shows each one's admin review status + note, lets the customer remove a proof
 * they uploaded while it is still awaiting review, and — while the order still
 * awaits payment — lets them upload a new one (image or PDF).
 */

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  Loader2,
  FileText,
  ImageIcon,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { PaymentProof, PaymentProofReviewStatus } from "@/types/order";
import { PROOF_REVIEW_LABELS } from "@/types/order";
import { uploadPaymentProof, removeProof } from "../actions";

interface Props {
  orderId: string;
  proofs: PaymentProof[];
  /** Whether the order is still in an uploadable state (pending / payment_pending). */
  canUpload: boolean;
}

const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

const REVIEW_BADGE_VARIANT: Record<
  PaymentProofReviewStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  pending: "secondary",
  accepted: "default",
  rejected: "destructive",
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

export function OrderProofUpload({ orderId, proofs, canUpload }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [, startRemove] = useTransition();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError("Selecciona un archivo.");
      return;
    }
    setState("loading");
    const formData = new FormData();
    formData.set("file", file);
    const result = await uploadPaymentProof(orderId, formData);
    if (result.ok) {
      setState("success");
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } else {
      setState("error");
      setError(result.error ?? "No se pudo subir el comprobante.");
    }
  }

  function handleRemove(proofId: string) {
    setError(null);
    setRemovingId(proofId);
    startRemove(async () => {
      const result = await removeProof(orderId, proofId);
      setRemovingId(null);
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error ?? "No se pudo eliminar el comprobante.");
      }
    });
  }

  return (
    <section className="rounded-xl border border-border bg-card px-5 py-4">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Comprobantes de pago</h2>
      </div>

      {/* Existing proofs */}
      {proofs.length > 0 ? (
        <ul className="space-y-2 mb-4">
          {proofs.map((proof) => {
            const canRemove =
              proof.uploadedBy === "customer" && proof.reviewStatus === "pending";
            const isRemoving = removingId === proof.id;
            return (
              <li
                key={proof.id}
                className="rounded-lg border border-border bg-background px-3 py-2 space-y-1.5"
              >
                <div className="flex items-center gap-3">
                  <a
                    href={proof.url ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 min-w-0 flex-1 hover:underline"
                  >
                    {proof.isImage && proof.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={proof.url}
                        alt={proof.filename}
                        className="h-10 w-10 rounded object-cover border border-border shrink-0"
                      />
                    ) : (
                      <span className="h-10 w-10 rounded bg-muted flex items-center justify-center shrink-0">
                        {proof.isImage ? (
                          <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        )}
                      </span>
                    )}
                    <span className="text-sm text-card-foreground truncate">
                      {proof.filename}
                    </span>
                  </a>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={REVIEW_BADGE_VARIANT[proof.reviewStatus]} className="text-xs">
                      {PROOF_REVIEW_LABELS[proof.reviewStatus]}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {proof.uploadedBy === "customer" ? "Tú" : "Tienda"}
                    </Badge>
                    {canRemove && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemove(proof.id)}
                        disabled={isRemoving}
                        aria-label="Eliminar comprobante"
                      >
                        {isRemoving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
                {proof.uploadedAt && (
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(proof.uploadedAt)}
                  </p>
                )}
                {proof.reviewStatus === "rejected" && proof.reviewNote && (
                  <p className="text-xs text-destructive">{proof.reviewNote}</p>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground mb-4">
          Aún no se ha adjuntado ningún comprobante.
        </p>
      )}

      {/* Upload form */}
      {canUpload ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Adjunta tu comprobante de transferencia o pago (imagen o PDF, máx. 10 MB).
            El administrador lo revisará para confirmar tu pago.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setState("idle");
              setError(null);
            }}
            className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer"
          />

          {error && (
            <div role="alert" className="flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {state === "success" && (
            <div className="flex items-start gap-2 text-sm text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Comprobante subido. El administrador lo revisará.</span>
            </div>
          )}

          <Button type="submit" size="sm" className="gap-2" disabled={!file || state === "loading"}>
            {state === "loading" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Subiendo…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Subir comprobante
              </>
            )}
          </Button>
        </form>
      ) : (
        <>
          {/* Removal errors still surface when the upload form is hidden. */}
          {error && (
            <div role="alert" className="flex items-start gap-2 text-sm text-destructive mb-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Esta orden ya no admite nuevos comprobantes.
          </p>
        </>
      )}
    </section>
  );
}
