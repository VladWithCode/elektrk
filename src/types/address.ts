/**
 * Address type — ElektrK
 *
 * Represents a saved shipping address in the storefront.
 * Maps 1:1 to the `addresses` Payload collection.
 */

export interface Address {
  id: string;
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
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AddressCreateInput {
  customerAuthId: string;
  customerEmail: string;
  label: string;
  fullName: string;
  phone?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  isDefault?: boolean;
}

export interface AddressUpdateInput {
  label?: string;
  fullName?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  isDefault?: boolean;
}
