/**
 * Mock account — ElektrK
 *
 * Mock customer profile used when DATA_SOURCE="mock" or when there
 * is no active Auth.js session (demo mode).
 */

import type { AccountUser } from "@/types/account";
import { MOCK_CUSTOMER_AUTH_ID, MOCK_CUSTOMER_EMAIL } from "@/data/mock-orders";

export const MOCK_ACCOUNT_USER: AccountUser = {
  id: MOCK_CUSTOMER_AUTH_ID,
  name: "Juan Pérez",
  email: MOCK_CUSTOMER_EMAIL,
  image: null,
};
