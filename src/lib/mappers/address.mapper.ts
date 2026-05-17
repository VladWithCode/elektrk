/**
 * Address mapper — converts raw Payload document to the Address domain type.
 */

import type { Address } from "@/types/address";

export interface RawPayloadAddress {
  id: string | number;
  customerAuthId: string;
  customerEmail: string;
  label: string;
  fullName: string;
  phone?: string | null;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault?: boolean | null;
  createdAt: string;
  updatedAt: string;
}

export function mapPayloadAddress(doc: RawPayloadAddress): Address {
  return {
    id: String(doc.id),
    customerAuthId: doc.customerAuthId,
    customerEmail: doc.customerEmail,
    label: doc.label,
    fullName: doc.fullName,
    phone: doc.phone ?? null,
    addressLine1: doc.addressLine1,
    addressLine2: doc.addressLine2 ?? null,
    city: doc.city,
    state: doc.state,
    postalCode: doc.postalCode,
    country: doc.country ?? "MX",
    isDefault: doc.isDefault ?? false,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
