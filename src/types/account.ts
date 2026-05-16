/**
 * Account domain types — ElektrK
 *
 * Types for the customer account dashboard.
 * Consumed by /account, /account/orders, and the account repository.
 */

import type { OrderSummary } from "@/types/order";

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

/**
 * Storefront-facing customer profile.
 * Populated from Auth.js session when available, or mock data otherwise.
 */
export interface AccountUser {
  /** Auth.js session.user.id — empty string in demo/mock mode. */
  id: string;
  name: string | null;
  email: string | null;
  /** Avatar image URL (from OAuth provider or Payload). */
  image: string | null;
}

// ---------------------------------------------------------------------------
// Dashboard aggregate
// ---------------------------------------------------------------------------

/**
 * All data needed to render the /account dashboard in one object.
 * Returned by getAccountDashboard() / getMockAccountDashboard().
 */
export interface AccountDashboardData {
  user: AccountUser;
  /** Up to 3 most recent orders for the dashboard preview. */
  recentOrders: OrderSummary[];
  stats: AccountStats;
  /** True when DATA_SOURCE="mock" or DATABASE_URL is absent. */
  isDemoMode: boolean;
}

export interface AccountStats {
  /** Total number of orders (all statuses). */
  totalOrders: number;
  /** Number of currently open support tickets. */
  openTickets: number;
  /** ISO 8601 string of the most recent order, or null if none. */
  lastOrderDate: string | null;
  /** Sum of all paid order totals in MXN. */
  totalSpent: number;
}
