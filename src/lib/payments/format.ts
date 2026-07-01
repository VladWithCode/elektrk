/**
 * Payment-details formatting — ElektrK
 *
 * Shared, side-effect-free helpers that turn the store's bank details into a
 * "Datos de pago" block. Reused by the WhatsApp message builder, the
 * order-confirmation email, and the order detail page so the customer sees the
 * exact same information everywhere.
 *
 * NOTE: relative-import / alias-free — this module is reachable from the Orders
 * collection import chain (via the WhatsApp builder). Keep it dependency-free.
 */

export interface PaymentDetails {
  bankName?: string | null;
  accountHolder?: string | null;
  clabe?: string | null;
  accountNumber?: string | null;
  /** Free-form instructions (settings.payment.paymentInstructions). */
  instructions?: string | null;
}

/**
 * Adapts the `settings.payment` group (which names the free-form field
 * `paymentInstructions`) to the `PaymentDetails` shape used by the formatters.
 */
export function paymentDetailsFrom(p: {
  bankName?: string | null;
  accountHolder?: string | null;
  clabe?: string | null;
  accountNumber?: string | null;
  paymentInstructions?: string | null;
}): PaymentDetails {
  return {
    bankName: p.bankName ?? null,
    accountHolder: p.accountHolder ?? null,
    clabe: p.clabe ?? null,
    accountNumber: p.accountNumber ?? null,
    instructions: p.paymentInstructions ?? null,
  };
}

function clean(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** True when at least one payment field is filled. */
export function hasPaymentDetails(p?: PaymentDetails | null): boolean {
  if (!p) return false;
  return Boolean(
    clean(p.bankName) ||
      clean(p.accountHolder) ||
      clean(p.clabe) ||
      clean(p.accountNumber) ||
      clean(p.instructions)
  );
}

/**
 * Returns the payment block as plain-text lines (for the WhatsApp message and
 * plain-text email). Empty array when no details are configured. Does NOT
 * include a leading heading — callers add "Datos de pago:" so they control
 * spacing.
 */
export function formatPaymentLines(p?: PaymentDetails | null): string[] {
  if (!hasPaymentDetails(p)) return [];
  const lines: string[] = [];
  const bank = clean(p!.bankName);
  const holder = clean(p!.accountHolder);
  const clabe = clean(p!.clabe);
  const account = clean(p!.accountNumber);
  const instructions = clean(p!.instructions);
  if (bank) lines.push(`Banco: ${bank}`);
  if (holder) lines.push(`Titular: ${holder}`);
  if (clabe) lines.push(`CLABE: ${clabe}`);
  if (account) lines.push(`Cuenta: ${account}`);
  if (instructions) lines.push(instructions);
  return lines;
}
