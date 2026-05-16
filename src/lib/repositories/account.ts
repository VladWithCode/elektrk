/**
 * Account repository — ElektrK
 *
 * Aggregates user profile + orders + ticket stats into one dashboard payload.
 * Consumed by /account (Server Component).
 *
 * Phase 10A: always returns mock data.
 * Phase 9B+: will merge Auth.js session + Payload tickets + orders.
 */

import type { AccountDashboardData, AccountUser } from "@/types/account";
import { MOCK_ACCOUNT_USER } from "@/data/mock-account";
import { MOCK_CUSTOMER_AUTH_ID } from "@/data/mock-orders";
import { getMockTickets } from "@/data/mock-tickets";
import { getRecentOrdersByCustomer, getOrdersByCustomer } from "@/lib/repositories/orders";
import { isAuthConfigured } from "@/lib/auth/helpers";

// ---------------------------------------------------------------------------
// getMockAccountDashboard
// ---------------------------------------------------------------------------

/**
 * Returns a fully-populated AccountDashboardData built entirely from mocks.
 * Safe to call from any Server Component regardless of DB/auth state.
 */
export async function getMockAccountDashboard(): Promise<AccountDashboardData> {
  const recentOrders = await getRecentOrdersByCustomer(MOCK_CUSTOMER_AUTH_ID, 3);
  const allOrders = await getOrdersByCustomer(MOCK_CUSTOMER_AUTH_ID);

  const openTickets = getMockTickets().filter(
    (t) => t.customerAuthId === MOCK_CUSTOMER_AUTH_ID && t.status === "open"
  ).length;

  const paidOrders = allOrders.filter(
    (o) => o.status === "paid" || o.status === "fulfilled"
  );
  const totalSpent = paidOrders.reduce((sum, o) => sum + o.total, 0);
  const lastOrderDate = recentOrders[0]?.createdAt ?? null;

  return {
    user: MOCK_ACCOUNT_USER,
    recentOrders,
    stats: {
      totalOrders: allOrders.length,
      openTickets,
      lastOrderDate,
      totalSpent,
    },
    isDemoMode: true,
  };
}

// ---------------------------------------------------------------------------
// getAccountDashboard
// ---------------------------------------------------------------------------

/**
 * Returns AccountDashboardData for a given Auth.js session.
 *
 * Strategy:
 *   - If no session / no auth configured → fall back to mock dashboard.
 *   - If session present but DATA_SOURCE="mock" → use session user + mock orders.
 *   - If session present and DATA_SOURCE="payload" → full Payload query (Phase 9B).
 *
 * @param sessionUser - Auth.js session.user or null
 */
export async function getAccountDashboard(
  sessionUser: { id?: string; name?: string | null; email?: string | null; image?: string | null } | null
): Promise<AccountDashboardData> {
  const authReady = isAuthConfigured();

  // No real auth configured → pure mock dashboard
  if (!authReady || !sessionUser) {
    return getMockAccountDashboard();
  }

  // Auth session present — build user from session
  const user: AccountUser = {
    id: sessionUser.id ?? "",
    name: sessionUser.name ?? null,
    email: sessionUser.email ?? null,
    image: sessionUser.image ?? null,
  };

  const customerId = user.id || MOCK_CUSTOMER_AUTH_ID;

  // Orders: from repository (mock or Payload depending on DATA_SOURCE)
  const recentOrders = await getRecentOrdersByCustomer(customerId, 3);
  const allOrders = await getOrdersByCustomer(customerId);

  // Tickets: currently always from mock in Phase 10A
  // TODO (Phase 9B): getTicketsByCustomer(customerId) from Payload
  const openTickets = getMockTickets().filter(
    (t) => t.customerAuthId === customerId && t.status === "open"
  ).length;

  const paidOrders = allOrders.filter(
    (o) => o.status === "paid" || o.status === "fulfilled"
  );
  const totalSpent = paidOrders.reduce((sum, o) => sum + o.total, 0);
  const lastOrderDate = recentOrders[0]?.createdAt ?? null;

  return {
    user,
    recentOrders,
    stats: { totalOrders: allOrders.length, openTickets, lastOrderDate, totalSpent },
    isDemoMode: false,
  };
}
