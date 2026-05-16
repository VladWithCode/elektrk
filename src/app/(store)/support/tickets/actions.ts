"use server";

/**
 * Ticket Server Actions — /support/tickets
 *
 * createTicket: validates and creates a new ticket via the repository.
 * Works with both mock and Payload data sources.
 */

import { createTicket as createTicketRepo } from "@/lib/repositories/tickets";
import type { TicketCreateInput, Ticket } from "@/types/ticket";

export interface CreateTicketResult {
  error?: string;
  ticket?: Ticket;
}

export async function createTicket(
  input: TicketCreateInput
): Promise<Ticket> {
  try {
    const ticket = await createTicketRepo(input);
    return ticket;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(message);
  }
}
