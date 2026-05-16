/**
 * Ticket domain types — ElektrK
 *
 * Used by the storefront support section, the ticket repository,
 * the Payload mapper, and the tickets UI page.
 *
 * These are storefront-facing types — not Payload CMS internals.
 */

// ---------------------------------------------------------------------------
// Enums / unions
// ---------------------------------------------------------------------------

export type TicketStatus = "open" | "in_progress" | "resolved";

export type TicketPriority = "low" | "medium" | "high";

// ---------------------------------------------------------------------------
// Core domain type
// ---------------------------------------------------------------------------

export interface Ticket {
  /** Internal ID (UUID in Payload, "TKT-001" style in mocks). */
  id: string;

  /**
   * Auth.js session.user.id of the customer who opened the ticket.
   * Empty string when the ticket was submitted without authentication.
   */
  customerAuthId: string;

  /** Customer contact email — always present. */
  customerEmail: string;

  /** Short one-liner displayed in the ticket list. */
  subject: string;

  /** Full message body. */
  message: string;

  status: TicketStatus;

  priority: TicketPriority;

  /**
   * Optional reference to a product by slug (storefront ID).
   * Stored as a string to stay decoupled from Payload's relation shape.
   */
  productSlug?: string | null;

  /** Human-readable product name for display (denormalised). */
  productName?: string | null;

  /**
   * Optional reference to an order ID.
   * Stored as a string — Payload relation resolved to ID in mapper.
   */
  orderId?: string | null;

  /** ISO 8601 date string — e.g. "2024-06-01T00:00:00.000Z". */
  createdAt: string;

  /** ISO 8601 date string. */
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Input / mutation types
// ---------------------------------------------------------------------------

/**
 * Fields required to open a new ticket.
 * Server / repository adds id, status, createdAt, updatedAt.
 */
export interface TicketCreateInput {
  customerAuthId: string;
  customerEmail: string;
  subject: string;
  message: string;
  priority: TicketPriority;
  productSlug?: string | null;
  orderId?: string | null;
}

/**
 * Fields allowed in a ticket update.
 * Only status updates are supported in Phase 9A (from admin).
 */
export interface TicketUpdateInput {
  status: TicketStatus;
}

// ---------------------------------------------------------------------------
// Filter / query options
// ---------------------------------------------------------------------------

export interface TicketFilterOptions {
  status?: TicketStatus | "all";
  priority?: TicketPriority | "all";
  /** Filter by customer — used when fetching tickets for the logged-in user. */
  customerAuthId?: string;
  /** Maximum number of tickets to return. Defaults to 50. */
  limit?: number;
  /** Zero-based page index for pagination. */
  page?: number;
}

// ---------------------------------------------------------------------------
// Display helpers (keep UI config co-located with types)
// ---------------------------------------------------------------------------

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Abierto",
  in_progress: "En proceso",
  resolved: "Resuelto",
};

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
};

export const TICKET_STATUS_OPTIONS: { value: TicketStatus; label: string }[] = [
  { value: "open", label: "Abierto" },
  { value: "in_progress", label: "En proceso" },
  { value: "resolved", label: "Resuelto" },
];

export const TICKET_PRIORITY_OPTIONS: { value: TicketPriority; label: string }[] = [
  { value: "low", label: "Baja" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" },
];

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

export function isValidTicketStatus(value: unknown): value is TicketStatus {
  return value === "open" || value === "in_progress" || value === "resolved";
}

export function isValidTicketPriority(value: unknown): value is TicketPriority {
  return value === "low" || value === "medium" || value === "high";
}
