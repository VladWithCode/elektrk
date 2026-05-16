/**
 * Ticket mapper — ElektrK
 *
 * Converts a raw Payload CMS ticket document into the storefront Ticket type.
 *
 * Payload shape assumptions (src/collections/Tickets.ts):
 *   - Top-level fields: id, status, priority, createdAt, updatedAt
 *   - Group "inquiry":  subject, message
 *   - Group "relations": product (relation → Products), order (relation → Orders)
 *   - Group "customer": authId, email
 *
 * The mapper is defensive: every field uses ?? null / safe fallbacks so a
 * partially-filled Payload document never throws.
 *
 * Usage (Phase 9B — when DATA_SOURCE="payload"):
 *   const raw = await payload.findByID({ collection: "tickets", id });
 *   const ticket = mapPayloadTicket(raw);
 */

import type { Ticket, TicketStatus, TicketPriority } from "@/types/ticket";
import { isValidTicketStatus, isValidTicketPriority } from "@/types/ticket";

// ---------------------------------------------------------------------------
// Raw Payload ticket shape (what the API returns)
// ---------------------------------------------------------------------------

/**
 * Loosely-typed Payload ticket document.
 * Using `unknown` fields forces explicit narrowing inside the mapper —
 * safer than trusting Payload's generated types which may drift.
 */
export interface RawPayloadTicket {
  id: string;
  status?: unknown;
  priority?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;

  /** Group: inquiry */
  inquiry?: {
    subject?: unknown;
    message?: unknown;
  };

  /** Group: clientInfo — customer contact details */
  clientInfo?: {
    customerAuthId?: unknown;
    customerEmail?: unknown;
  };

  /** Group: relations */
  relations?: {
    /** Can be a populated Product object or a bare ID string. */
    product?: unknown;
    /** Can be a populated Order object or a bare ID string. */
    order?: unknown;
  };
}

// ---------------------------------------------------------------------------
// mapPayloadTicket
// ---------------------------------------------------------------------------

/**
 * Maps a raw Payload ticket document to the storefront Ticket interface.
 * Safe to call with partial/unknown data — returns sensible fallbacks.
 */
export function mapPayloadTicket(raw: RawPayloadTicket): Ticket {
  // --- Status ---
  const rawStatus = raw.status;
  const status: TicketStatus = isValidTicketStatus(rawStatus)
    ? rawStatus
    : "open";

  // --- Priority ---
  const rawPriority = raw.priority;
  const priority: TicketPriority = isValidTicketPriority(rawPriority)
    ? rawPriority
    : "medium";

  // --- Inquiry group ---
  const subject =
    typeof raw.inquiry?.subject === "string" ? raw.inquiry.subject : "";
  const message =
    typeof raw.inquiry?.message === "string" ? raw.inquiry.message : "";

  // --- Client info group ---
  const customerAuthId =
    typeof raw.clientInfo?.customerAuthId === "string" ? raw.clientInfo.customerAuthId : "";
  const customerEmail =
    typeof raw.clientInfo?.customerEmail === "string" ? raw.clientInfo.customerEmail : "";

  // --- Relations group ---
  const productRef = raw.relations?.product;
  const orderRef = raw.relations?.order;

  // Product may be a populated object with id/slug/name, or a bare ID string
  const productSlug = resolveRelationField(productRef, "slug");
  const productName = resolveRelationField(productRef, "name");
  const orderId = resolveRelationId(orderRef);

  // --- Dates ---
  const createdAt = toIsoString(raw.createdAt);
  const updatedAt = toIsoString(raw.updatedAt);

  return {
    id: raw.id,
    customerAuthId,
    customerEmail,
    subject,
    message,
    status,
    priority,
    productSlug,
    productName,
    orderId,
    createdAt,
    updatedAt,
  };
}

// ---------------------------------------------------------------------------
// mapMockTicket  (identity pass-through for mock data)
// ---------------------------------------------------------------------------

/**
 * No-op mapper for mock tickets — already in the correct shape.
 * Exists so callers don't need to branch on data source when iterating.
 */
export function mapMockTicket(ticket: Ticket): Ticket {
  return ticket;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extracts a string field from a Payload relation reference.
 * The reference can be:
 *   - A populated object: { id, slug, name, ... }
 *   - A bare ID string (when depth=0)
 *   - null / undefined
 */
function resolveRelationField(
  ref: unknown,
  field: string
): string | null {
  if (!ref) return null;
  if (typeof ref === "object" && ref !== null) {
    const val = (ref as Record<string, unknown>)[field];
    return typeof val === "string" ? val : null;
  }
  return null;
}

/**
 * Extracts the ID from a Payload relation reference.
 * If the relation is just a bare string ID, returns it directly.
 */
function resolveRelationId(ref: unknown): string | null {
  if (!ref) return null;
  if (typeof ref === "string") return ref;
  if (typeof ref === "object" && ref !== null) {
    const id = (ref as Record<string, unknown>).id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

/** Coerces any date-like value to an ISO 8601 string. */
function toIsoString(value: unknown): string {
  if (typeof value === "string" && value.length > 0) return value;
  if (value instanceof Date) return value.toISOString();
  return new Date().toISOString();
}
