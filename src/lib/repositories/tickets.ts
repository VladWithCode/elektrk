/**
 * Ticket repository — ElektrK
 *
 * Single access point for ticket data regardless of the underlying source.
 * The DATA_SOURCE env var selects the implementation at runtime:
 *
 *   DATA_SOURCE="mock"    → in-memory mocks from src/data/mock-tickets.ts
 *   DATA_SOURCE="payload" → Payload CMS (requires DATABASE_URL, Phase 9B)
 *
 * All functions are async so callers are source-agnostic and the swap to
 * Payload introduces zero changes to the UI or API routes.
 *
 * Hard constraints (Phase 9A):
 *   ✗ No Payload calls at runtime
 *   ✗ No DATABASE_URL required
 *   ✗ No real auth — customerAuthId comes from the caller (mock or session)
 *   ✗ No stock changes
 *   ✗ No Order creation
 *
 * TODO (Phase 9B — when Neon is ready):
 *   1. Replace the Payload stubs in _payload* helpers with real calls.
 *   2. Run `bun run payload:migrate` to ensure the tickets collection is synced.
 *   3. Import and use getPayloadClient() (or equivalent) inside the stubs.
 *   4. Remove the DATA_SOURCE guard once Payload is the primary source.
 */

import type { Ticket, TicketCreateInput, TicketUpdateInput, TicketFilterOptions } from "@/types/ticket";
import { isValidTicketStatus } from "@/types/ticket";
import {
  getMockTickets,
  findMockTicketById,
  addMockTicket,
  updateMockTicketStatus,
  nextMockTicketId,
} from "@/data/mock-tickets";
import { mapPayloadTicket, type RawPayloadTicket } from "@/lib/mappers/ticket.mapper";

// ---------------------------------------------------------------------------
// Lazy Payload client — only initialised when DATA_SOURCE=payload
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _payloadClient: any = null;

async function getPayloadClient() {
  if (_payloadClient) return _payloadClient;
  const { getPayload } = await import("payload");
  const { default: config } = await import("@payload-config");
  _payloadClient = await getPayload({ config });
  return _payloadClient;
}

// ---------------------------------------------------------------------------
// Data source guard — mirrors the pattern in src/lib/repositories/products.ts
// ---------------------------------------------------------------------------

function dataSource(): "mock" | "payload" {
  // Tickets Payload implementation — Phase 9B active.
  // DATA_SOURCE="payload" enables real Payload integration with Neon.
  return (process.env.DATA_SOURCE ?? "mock") === "payload" ? "payload" : "mock";
}

// ---------------------------------------------------------------------------
// getTicketsByCustomer
// ---------------------------------------------------------------------------

/**
 * Returns all tickets for a given customer, optionally filtered.
 * In mock mode, filters by customerAuthId match.
 *
 * @param customerAuthId - Auth.js session.user.id (or mock placeholder)
 * @param options        - Optional filter/pagination settings
 */
export async function getTicketsByCustomer(
  customerAuthId: string,
  options: Omit<TicketFilterOptions, "customerAuthId"> = {}
): Promise<Ticket[]> {
  if (dataSource() === "payload") {
    return _payloadGetTicketsByCustomer(customerAuthId, options);
  }

  let tickets = getMockTickets().filter(
    (t) => t.customerAuthId === customerAuthId
  );

  // Apply optional status filter
  if (options.status && options.status !== "all") {
    tickets = tickets.filter((t) => t.status === options.status);
  }

  // Apply optional priority filter
  if (options.priority && options.priority !== "all") {
    tickets = tickets.filter((t) => t.priority === options.priority);
  }

  // Sort: newest first
  tickets = tickets.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Pagination
  const limit = options.limit ?? 50;
  const page = options.page ?? 0;
  return tickets.slice(page * limit, page * limit + limit);
}

// ---------------------------------------------------------------------------
// getTicketById
// ---------------------------------------------------------------------------

/**
 * Returns a single ticket by its ID, or null if not found.
 */
export async function getTicketById(id: string): Promise<Ticket | null> {
  if (dataSource() === "payload") {
    return _payloadGetTicketById(id);
  }

  return findMockTicketById(id);
}

// ---------------------------------------------------------------------------
// createTicket
// ---------------------------------------------------------------------------

/**
 * Creates a new ticket and returns the created Ticket object.
 *
 * In mock mode: adds to the in-memory store and returns immediately.
 * In Payload mode: creates a Payload document (Phase 9B TODO).
 *
 * Validation:
 *   - subject: required, trimmed, max 200 chars
 *   - message: required, trimmed, max 2000 chars
 *   - priority: must be a valid TicketPriority value
 *   - customerEmail: required
 */
export async function createTicket(input: TicketCreateInput): Promise<Ticket> {
  // --- Input validation ---
  const subject = input.subject.trim();
  if (!subject) throw new Error("El asunto del ticket es requerido.");
  if (subject.length > 200)
    throw new Error("El asunto no puede superar los 200 caracteres.");

  const message = input.message.trim();
  if (!message) throw new Error("El mensaje del ticket es requerido.");
  if (message.length > 2000)
    throw new Error("El mensaje no puede superar los 2000 caracteres.");

  if (!input.customerEmail?.trim())
    throw new Error("El correo del cliente es requerido.");

  const validPriorities = ["low", "medium", "high"] as const;
  if (!validPriorities.includes(input.priority)) {
    throw new Error(`Prioridad inválida: "${input.priority}".`);
  }

  if (dataSource() === "payload") {
    return _payloadCreateTicket(input);
  }

  // --- Mock: build and store ticket ---
  const now = new Date().toISOString();
  const ticket: Ticket = {
    id: nextMockTicketId(),
    customerAuthId: input.customerAuthId,
    customerEmail: input.customerEmail.trim(),
    subject,
    message,
    status: "open",
    priority: input.priority,
    productSlug: input.productSlug ?? null,
    productName: null, // would be resolved from product catalog in Phase 9B
    orderId: input.orderId ?? null,
    createdAt: now,
    updatedAt: now,
  };

  addMockTicket(ticket);
  return ticket;
}

// ---------------------------------------------------------------------------
// updateTicketStatus
// ---------------------------------------------------------------------------

/**
 * Updates the status of an existing ticket.
 * In mock mode: mutates the in-memory store.
 *
 * Returns the updated ticket, or null if not found.
 */
export async function updateTicketStatus(
  id: string,
  update: TicketUpdateInput
): Promise<Ticket | null> {
  if (!isValidTicketStatus(update.status)) {
    throw new Error(`Estado inválido: "${update.status}".`);
  }

  if (dataSource() === "payload") {
    return _payloadUpdateTicketStatus(id, update);
  }

  const updated = updateMockTicketStatus(id, update.status);
  if (!updated) return null;
  return findMockTicketById(id);
}

// ---------------------------------------------------------------------------
// getTicketFilters
// ---------------------------------------------------------------------------

/**
 * Returns the available filter options for the UI.
 * In Phase 9B, this could query Payload for distinct values.
 */
export async function getTicketFilters(): Promise<{
  statuses: Array<{ value: string; label: string }>;
  priorities: Array<{ value: string; label: string }>;
}> {
  return {
    statuses: [
      { value: "all", label: "Todos" },
      { value: "open", label: "Abiertos" },
      { value: "in_progress", label: "En proceso" },
      { value: "resolved", label: "Resueltos" },
    ],
    priorities: [
      { value: "all", label: "Todas" },
      { value: "low", label: "Baja" },
      { value: "medium", label: "Media" },
      { value: "high", label: "Alta" },
    ],
  };
}

// ---------------------------------------------------------------------------
// Payload stubs (Phase 9B — safe TODOs, never executed in Phase 9A)
// ---------------------------------------------------------------------------

/**
 * Phase 9B — Query tickets from Payload filtered by customerAuthId.
 */
async function _payloadGetTicketsByCustomer(
  customerAuthId: string,
  options: Omit<TicketFilterOptions, "customerAuthId">
): Promise<Ticket[]> {
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: "tickets",
    where: { "clientInfo.customerAuthId": { equals: customerAuthId } },
    sort: "-createdAt",
    limit: options.limit ?? 50,
    page: (options.page ?? 0) + 1,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result.docs.map((doc: any) => mapPayloadTicket(doc as RawPayloadTicket));
}

/**
 * Phase 9B — Fetch a single ticket by ID from Payload.
 */
async function _payloadGetTicketById(id: string): Promise<Ticket | null> {
  const payload = await getPayloadClient();
  const doc = await payload.findByID({ collection: "tickets", id });
  return doc ? mapPayloadTicket(doc as RawPayloadTicket) : null;
}

/**
 * Phase 9B — Create a new ticket in Payload.
 * Note: validation is done in createTicket() before calling this.
 */
async function _payloadCreateTicket(input: TicketCreateInput): Promise<Ticket> {
  const payload = await getPayloadClient();

  // `relations.product` is a relationship to `products` and expects the product
  // ID, but callers pass a productSlug. Resolve slug → id (null when not found)
  // so a product-linked ticket does not fail validation.
  let productId: number | null = null;
  if (input.productSlug) {
    const found = await payload.find({
      collection: "products",
      where: { slug: { equals: input.productSlug } },
      limit: 1,
      depth: 0,
    });
    productId = (found.docs[0]?.id as number) ?? null;
  }

  // `relations.order` expects an order ID. Only forward a numeric-looking id.
  const orderId =
    input.orderId != null && /^\d+$/.test(String(input.orderId))
      ? Number(input.orderId)
      : null;

  const doc = await payload.create({
    collection: "tickets",
    data: {
      status: "open",
      priority: input.priority,
      inquiry: {
        subject: input.subject,
        message: input.message,
      },
      clientInfo: {
        customerAuthId: input.customerAuthId,
        customerEmail: input.customerEmail,
      },
      relations: {
        product: productId,
        order: orderId,
      },
    },
  });
  return mapPayloadTicket(doc as RawPayloadTicket);
}

/**
 * Phase 9B — Update ticket status in Payload (admin operation).
 */
async function _payloadUpdateTicketStatus(
  id: string,
  update: TicketUpdateInput
): Promise<Ticket | null> {
  const payload = await getPayloadClient();
  try {
    const doc = await payload.update({
      collection: "tickets",
      id,
      data: { status: update.status },
    });
    return mapPayloadTicket(doc as RawPayloadTicket);
  } catch {
    return null;
  }
}


// Re-export mapper so callers that receive raw Payload docs can convert them
export { mapPayloadTicket };
export type { RawPayloadTicket };
