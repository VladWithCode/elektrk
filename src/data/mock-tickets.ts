/**
 * Mock tickets — ElektrK
 *
 * Used when DATA_SOURCE="mock" (default).
 * Mirrors the shape of Ticket from src/types/ticket.ts so the UI,
 * repository, and mapper all consume the same structure.
 *
 * When DATA_SOURCE="payload", the ticket repository fetches from
 * Payload CMS via the mapper instead of returning these mocks.
 */

import type { Ticket } from "@/types/ticket";

/** Placeholder customer ID for mock data — never a real UUID. */
export const MOCK_CUSTOMER_AUTH_ID = "mock-user-001";
export const MOCK_CUSTOMER_EMAIL = "cliente@ejemplo.com";

export const MOCK_TICKETS: Ticket[] = [
  {
    id: "TKT-001",
    customerAuthId: MOCK_CUSTOMER_AUTH_ID,
    customerEmail: MOCK_CUSTOMER_EMAIL,
    subject: "Producto recibido con daño en empaque",
    message:
      "El interruptor Siemens 5SL6110-7 llegó con la caja golpeada. El producto parece " +
      "funcionar correctamente, pero quisiera saber si pueden enviar empaque de reemplazo " +
      "o si debo hacer una reclamación formal.",
    status: "in_progress",
    priority: "medium",
    productSlug: "siemens-5sl6110-7-1p-10a-curva-c",
    productName: "Siemens 5SL6110-7 — 1P 10A Curva C",
    orderId: null,
    createdAt: "2024-06-01T10:00:00.000Z",
    updatedAt: "2024-06-02T09:30:00.000Z",
  },
  {
    id: "TKT-002",
    customerAuthId: MOCK_CUSTOMER_AUTH_ID,
    customerEmail: MOCK_CUSTOMER_EMAIL,
    subject: "Solicitud de factura para la orden ORD-001",
    message:
      "Necesito la factura a nombre de mi empresa (RFC: EMP123456ABC) para efectos fiscales. " +
      "El pedido fue realizado el 15 de mayo. ¿Pueden enviármela al correo registrado?",
    status: "resolved",
    priority: "low",
    productSlug: null,
    productName: null,
    orderId: "ORD-001",
    createdAt: "2024-05-15T14:00:00.000Z",
    updatedAt: "2024-05-16T11:00:00.000Z",
  },
  {
    id: "TKT-003",
    customerAuthId: MOCK_CUSTOMER_AUTH_ID,
    customerEmail: MOCK_CUSTOMER_EMAIL,
    subject: "Duda técnica sobre capacidad de ruptura",
    message:
      "Estoy instalando un tablero trifásico y necesito confirmar si el Schneider " +
      "iK60N 3P 25A Curva C soporta la corriente de cortocircuito de mi instalación " +
      "(aproximadamente 5 kA). ¿Tienen la hoja de datos completa?",
    status: "open",
    priority: "high",
    productSlug: "schneider-ik60n-3p-25a-curva-c",
    productName: "Schneider Electric iK60N — 3P 25A Curva C",
    orderId: null,
    createdAt: "2024-06-10T08:15:00.000Z",
    updatedAt: "2024-06-10T08:15:00.000Z",
  },
];

// ---------------------------------------------------------------------------
// In-memory store for new tickets created via the UI in mock mode.
// Reset on page refresh — no persistence without DB.
// ---------------------------------------------------------------------------

let _mutableTickets: Ticket[] = [...MOCK_TICKETS];

/** Returns a shallow copy of the current in-memory ticket list. */
export function getMockTickets(): Ticket[] {
  return [..._mutableTickets];
}

/** Finds a single ticket by ID from the in-memory store. */
export function findMockTicketById(id: string): Ticket | null {
  return _mutableTickets.find((t) => t.id === id) ?? null;
}

/**
 * Adds a new ticket to the in-memory store.
 * Generates a sequential TKT-NNN id.
 */
export function addMockTicket(ticket: Ticket): void {
  _mutableTickets = [ticket, ..._mutableTickets];
}

/**
 * Updates the status of a ticket in the in-memory store.
 * Returns true if the ticket was found and updated.
 */
export function updateMockTicketStatus(
  id: string,
  status: Ticket["status"]
): boolean {
  const idx = _mutableTickets.findIndex((t) => t.id === id);
  if (idx === -1) return false;
  _mutableTickets = _mutableTickets.map((t, i) =>
    i === idx ? { ...t, status, updatedAt: new Date().toISOString() } : t
  );
  return true;
}

/** Generates the next sequential mock ticket ID. */
export function nextMockTicketId(): string {
  const max = _mutableTickets.reduce((acc, t) => {
    const n = parseInt(t.id.replace("TKT-", ""), 10);
    return isNaN(n) ? acc : Math.max(acc, n);
  }, 0);
  return `TKT-${String(max + 1).padStart(3, "0")}`;
}
