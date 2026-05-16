/**
 * Mock orders — ElektrK
 *
 * Used when DATA_SOURCE="mock" (default).
 * Mirrors OrderSummary and OrderDetail from src/types/order.ts.
 *
 * When DATA_SOURCE="payload", the order repository fetches from
 * Payload CMS via the mapper instead of returning these mocks.
 */

import type { OrderDetail, OrderSummary } from "@/types/order";

export const MOCK_CUSTOMER_AUTH_ID = "mock-user-001";
export const MOCK_CUSTOMER_EMAIL   = "cliente@ejemplo.com";

// ---------------------------------------------------------------------------
// Full order details (used by /account/orders/[id])
// ---------------------------------------------------------------------------

export const MOCK_ORDER_DETAILS: OrderDetail[] = [
  {
    id: "ORD-001",
    createdAt: "2024-05-10T14:30:00.000Z",
    displayDate: "10 may. 2024",
    status: "fulfilled",
    total: 2220,
    subtotal: 2040,
    shipping: 180,
    itemCount: 2,
    customerEmail: MOCK_CUSTOMER_EMAIL,
    customerAuthId: MOCK_CUSTOMER_AUTH_ID,
    stripeCheckoutSessionId: null,
    stripePaymentIntentId: null,
    notes: null,
    shippingAddress: {
      name: "Juan Pérez",
      address: "Av. Insurgentes Sur 1234, Col. Del Valle",
      city: "Ciudad de México",
      state: "Ciudad de México",
      postalCode: "03100",
      phone: null,
    },
    items: [
      {
        id: "OI-001-1",
        productName: "Siemens 5SL6110-7 — 1P 10A Curva C",
        productSlug: "siemens-5sl6110-7-1p-10a-curva-c",
        variantLabel: "Pieza",
        variantSku: "SIE-5SL6110-7-PC",
        unitPrice: 350,
        quantity: 3,
        lineTotal: 1050,
        imageUrl: null,
      },
      {
        id: "OI-001-2",
        productName: "Siemens 5SL6216-7 — 2P 16A Curva C",
        productSlug: "siemens-5sl6216-7-2p-16a-curva-c",
        variantLabel: "Pieza",
        variantSku: "SIE-5SL6216-7-PC",
        unitPrice: 990,
        quantity: 1,
        lineTotal: 990,
        imageUrl: null,
      },
    ],
  },
  {
    id: "ORD-002",
    createdAt: "2024-06-01T09:15:00.000Z",
    displayDate: "1 jun. 2024",
    status: "paid",
    total: 985,
    subtotal: 805,
    shipping: 180,
    itemCount: 1,
    customerEmail: MOCK_CUSTOMER_EMAIL,
    customerAuthId: MOCK_CUSTOMER_AUTH_ID,
    stripeCheckoutSessionId: null,
    stripePaymentIntentId: null,
    notes: null,
    shippingAddress: {
      name: "Juan Pérez",
      address: "Av. Insurgentes Sur 1234, Col. Del Valle",
      city: "Ciudad de México",
      state: "Ciudad de México",
      postalCode: "03100",
      phone: null,
    },
    items: [
      {
        id: "OI-002-1",
        productName: "Schneider Electric iK60N — 3P 25A Curva C",
        productSlug: "schneider-ik60n-3p-25a-curva-c",
        variantLabel: "Pieza",
        variantSku: "SCH-IK60N-3P25-PC",
        unitPrice: 805,
        quantity: 1,
        lineTotal: 805,
        imageUrl: null,
      },
    ],
  },
  {
    id: "ORD-003",
    createdAt: "2024-04-20T16:00:00.000Z",
    displayDate: "20 abr. 2024",
    status: "cancelled",
    total: 530,
    subtotal: 350,
    shipping: 180,
    itemCount: 1,
    customerEmail: MOCK_CUSTOMER_EMAIL,
    customerAuthId: MOCK_CUSTOMER_AUTH_ID,
    stripeCheckoutSessionId: null,
    stripePaymentIntentId: null,
    notes: "Cancelado por el cliente antes del envío.",
    shippingAddress: null,
    items: [
      {
        id: "OI-003-1",
        productName: "Siemens 5SL6110-7 — 1P 10A Curva C",
        productSlug: "siemens-5sl6110-7-1p-10a-curva-c",
        variantLabel: "Pieza",
        variantSku: "SIE-5SL6110-7-PC",
        unitPrice: 350,
        quantity: 1,
        lineTotal: 350,
        imageUrl: null,
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Summaries (derived — avoids duplication)
// ---------------------------------------------------------------------------

export const MOCK_ORDER_SUMMARIES: OrderSummary[] = MOCK_ORDER_DETAILS.map(
  ({ id, createdAt, displayDate, status, total, itemCount, customerEmail }) => ({
    id,
    createdAt,
    displayDate,
    status,
    total,
    itemCount,
    customerEmail,
  })
);

// ---------------------------------------------------------------------------
// Accessor helpers
// ---------------------------------------------------------------------------

export function getMockOrderSummaries(): OrderSummary[] {
  return [...MOCK_ORDER_SUMMARIES];
}

export function getMockOrdersByCustomer(customerAuthId: string): OrderDetail[] {
  return MOCK_ORDER_DETAILS.filter((o) => o.customerAuthId === customerAuthId);
}

export function findMockOrderById(id: string): OrderDetail | null {
  return MOCK_ORDER_DETAILS.find((o) => o.id === id) ?? null;
}

export function getMockRecentOrders(
  customerAuthId: string,
  limit = 3
): OrderSummary[] {
  return getMockOrdersByCustomer(customerAuthId)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, limit)
    .map(({ id, createdAt, displayDate, status, total, itemCount, customerEmail }) => ({
      id,
      createdAt,
      displayDate,
      status,
      total,
      itemCount,
      customerEmail,
    }));
}
