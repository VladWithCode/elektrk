"use server";

/**
 * Payment-proof upload — customer side.
 *
 * The customer attaches a receipt (image or PDF) to their own order while it is
 * still awaiting payment. Security is enforced here:
 *   - authenticated session required
 *   - the order must belong to the caller
 *   - the order must be in an uploadable state (pending / payment_pending)
 *   - file type + size validated before touching storage
 *
 * The repository uploads the file to Media and appends it to the order's
 * paymentProofs array (auto-advancing pending → payment_pending).
 */

import { revalidatePath } from "next/cache";
import { getSessionSafe } from "@/lib/auth/helpers";
import {
  getOrderById,
  attachPaymentProof,
  updateOrderStatus,
  removePaymentProof,
  markWhatsAppSent,
} from "@/lib/repositories/orders";

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB (matches Payload upload limit)
const UPLOADABLE_STATUSES = ["pending", "payment_pending"];

export interface UploadProofResult {
  ok: boolean;
  error?: string;
}

export async function uploadPaymentProof(
  orderId: string,
  formData: FormData
): Promise<UploadProofResult> {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const session = await getSessionSafe();
  if (!session?.user?.id) {
    return { ok: false, error: "Debes iniciar sesión para subir un comprobante." };
  }

  // ── Ownership ────────────────────────────────────────────────────────────
  const order = await getOrderById(orderId);
  if (!order || order.customerAuthId !== session.user.id) {
    return { ok: false, error: "No encontramos esta orden." };
  }

  // ── Status gate ──────────────────────────────────────────────────────────
  if (!UPLOADABLE_STATUSES.includes(order.status)) {
    return {
      ok: false,
      error: "Esta orden ya no admite comprobantes de pago.",
    };
  }

  // ── File validation ──────────────────────────────────────────────────────
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Selecciona un archivo." };
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      ok: false,
      error: "Formato no válido. Sube una imagen (JPG, PNG, WebP) o un PDF.",
    };
  }
  if (file.size > MAX_SIZE_BYTES) {
    return { ok: false, error: "El archivo excede el límite de 10 MB." };
  }

  // ── Upload + attach ──────────────────────────────────────────────────────
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await attachPaymentProof(
      orderId,
      { buffer, mimetype: file.type, filename: file.name, size: file.size },
      "customer"
    );
  } catch (err) {
    console.error("[uploadPaymentProof] failed:", err);
    return {
      ok: false,
      error: "No se pudo subir el comprobante. Inténtalo de nuevo.",
    };
  }

  revalidatePath(`/account/orders/${orderId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Cancel own order (§7.2)
// ---------------------------------------------------------------------------

const CANCELLABLE_STATUSES = ["pending", "payment_pending"];

export interface OrderActionResult {
  ok: boolean;
  error?: string;
}

/**
 * Lets the customer cancel their own order while it is still pending / awaiting
 * payment review. No stock impact (stock is only decremented once paid). The
 * cancel email + statusHistory entry are handled by the Orders afterChange hook.
 */
export async function cancelOrder(orderId: string): Promise<OrderActionResult> {
  const session = await getSessionSafe();
  if (!session?.user?.id) {
    return { ok: false, error: "Debes iniciar sesión." };
  }

  const order = await getOrderById(orderId);
  if (!order || order.customerAuthId !== session.user.id) {
    return { ok: false, error: "No encontramos esta orden." };
  }

  if (!CANCELLABLE_STATUSES.includes(order.status)) {
    return { ok: false, error: "Esta orden ya no se puede cancelar." };
  }

  try {
    await updateOrderStatus(orderId, "cancelled", {
      actor: "customer",
      note: "Cancelada por el cliente.",
    });
  } catch (err) {
    console.error("[cancelOrder] failed:", err);
    return { ok: false, error: "No se pudo cancelar la orden. Inténtalo de nuevo." };
  }

  revalidatePath(`/account/orders/${orderId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Remove own pending proof (§7.3)
// ---------------------------------------------------------------------------

/**
 * Removes a payment proof the customer uploaded, but only while it is still
 * awaiting review (reviewStatus === "pending"). Once an admin has accepted or
 * rejected it, it is locked.
 */
export async function removeProof(
  orderId: string,
  proofId: string
): Promise<OrderActionResult> {
  const session = await getSessionSafe();
  if (!session?.user?.id) {
    return { ok: false, error: "Debes iniciar sesión." };
  }

  const order = await getOrderById(orderId);
  if (!order || order.customerAuthId !== session.user.id) {
    return { ok: false, error: "No encontramos esta orden." };
  }

  const proof = order.paymentProofs.find((p) => p.id === proofId);
  if (!proof) {
    return { ok: false, error: "No encontramos ese comprobante." };
  }
  if (proof.uploadedBy !== "customer" || proof.reviewStatus !== "pending") {
    return {
      ok: false,
      error: "Este comprobante ya no se puede eliminar.",
    };
  }

  try {
    await removePaymentProof(orderId, proofId);
  } catch (err) {
    console.error("[removeProof] failed:", err);
    return { ok: false, error: "No se pudo eliminar el comprobante." };
  }

  revalidatePath(`/account/orders/${orderId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Record WhatsApp hand-off (§7.1)
// ---------------------------------------------------------------------------

/**
 * Best-effort: records that the customer opened the WhatsApp message for their
 * order. Fire-and-forget from the client — a failure never blocks the wa.me
 * navigation.
 */
export async function recordWhatsAppSent(
  orderId: string
): Promise<OrderActionResult> {
  const session = await getSessionSafe();
  if (!session?.user?.id) {
    return { ok: false };
  }

  const order = await getOrderById(orderId);
  if (!order || order.customerAuthId !== session.user.id) {
    return { ok: false };
  }

  try {
    await markWhatsAppSent(orderId);
  } catch (err) {
    console.error("[recordWhatsAppSent] failed:", err);
    return { ok: false };
  }
  return { ok: true };
}
