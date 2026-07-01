/**
 * Email transport wrapper — ElektrK
 *
 * Thin, never-throwing wrapper around `payload.sendEmail` (Resend adapter,
 * configured in payload.config.ts). Every failure is logged and swallowed so an
 * email problem never blocks the order write / status change that triggered it.
 *
 * NOTE: relative-import / alias-free — reachable from the Orders collection
 * import chain. Keep dependency-free.
 */

/** Verified Resend sender. Falls back to the Resend sandbox address in dev. */
export const EMAIL_FROM = process.env.EMAIL_FROM || "onboarding@resend.dev";

/** Storefront base URL, used to build deep links in emails. */
export const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000";

interface SendArgs {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
  to: string | null | undefined;
  subject: string;
  html: string;
}

/**
 * Sends one email. Returns true on success, false on any failure (missing
 * recipient, transport error, …). Never throws.
 */
export async function sendEmailSafe({
  payload,
  to,
  subject,
  html,
}: SendArgs): Promise<boolean> {
  const recipient = typeof to === "string" ? to.trim() : "";
  if (!recipient) return false;

  try {
    await payload.sendEmail({
      from: EMAIL_FROM,
      to: recipient,
      subject,
      html,
    });
    payload.logger?.info?.(`[email] sent "${subject}" → ${recipient}`);
    return true;
  } catch (err) {
    payload.logger?.error?.(
      `[email] failed "${subject}" → ${recipient}: ` +
        (err instanceof Error ? err.message : String(err))
    );
    return false;
  }
}
