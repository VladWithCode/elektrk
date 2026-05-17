/**
 * Address repository — ElektrK
 *
 * All address operations against the `addresses` Payload collection.
 * Requires DATA_SOURCE="payload" and a connected Neon database.
 *
 * When DATA_SOURCE="mock" every function returns empty results so the
 * storefront remains functional without a live database.
 */

import type { Address, AddressCreateInput, AddressUpdateInput } from "@/types/address";
import { mapPayloadAddress, type RawPayloadAddress } from "@/lib/mappers/address.mapper";

// ---------------------------------------------------------------------------
// Lazy Payload client
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

function dataSource(): "mock" | "payload" {
  return (process.env.DATA_SOURCE ?? "mock") === "payload" ? "payload" : "mock";
}

// ---------------------------------------------------------------------------
// getAddressesByCustomer
// ---------------------------------------------------------------------------

export async function getAddressesByCustomer(customerAuthId: string): Promise<Address[]> {
  if (dataSource() !== "payload") return [];

  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: "addresses",
    where: { customerAuthId: { equals: customerAuthId } },
    sort: "-isDefault",
    limit: 20,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result.docs.map((doc: any) => mapPayloadAddress(doc as RawPayloadAddress));
}

// ---------------------------------------------------------------------------
// getDefaultAddressByCustomer
// ---------------------------------------------------------------------------

export async function getDefaultAddressByCustomer(customerAuthId: string): Promise<Address | null> {
  if (dataSource() !== "payload") return null;

  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: "addresses",
    where: {
      and: [
        { customerAuthId: { equals: customerAuthId } },
        { isDefault: { equals: true } },
      ],
    },
    limit: 1,
  });
  if (!result.docs.length) return null;
  return mapPayloadAddress(result.docs[0] as RawPayloadAddress);
}

// ---------------------------------------------------------------------------
// createAddress
// ---------------------------------------------------------------------------

export async function createAddress(input: AddressCreateInput): Promise<Address> {
  if (dataSource() !== "payload") {
    throw new Error("Addresses require DATA_SOURCE=payload");
  }

  const payload = await getPayloadClient();

  // If this is the first address or isDefault is true, clear other defaults first
  if (input.isDefault) {
    await _clearDefaultAddresses(payload, input.customerAuthId);
  }

  const doc = await payload.create({
    collection: "addresses",
    data: {
      customerAuthId: input.customerAuthId,
      customerEmail: input.customerEmail,
      label: input.label,
      fullName: input.fullName,
      phone: input.phone ?? null,
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2 ?? null,
      city: input.city,
      state: input.state,
      postalCode: input.postalCode,
      country: input.country ?? "MX",
      isDefault: input.isDefault ?? false,
    },
  });
  return mapPayloadAddress(doc as RawPayloadAddress);
}

// ---------------------------------------------------------------------------
// updateAddress
// ---------------------------------------------------------------------------

export async function updateAddress(id: string, data: AddressUpdateInput): Promise<Address | null> {
  if (dataSource() !== "payload") return null;

  const payload = await getPayloadClient();
  try {
    // If setting as default, clear other defaults first
    if (data.isDefault) {
      const existing = await payload.findByID({ collection: "addresses", id });
      if (existing) {
        await _clearDefaultAddresses(payload, existing.customerAuthId);
      }
    }
    const doc = await payload.update({ collection: "addresses", id, data });
    return mapPayloadAddress(doc as RawPayloadAddress);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// deleteAddress
// ---------------------------------------------------------------------------

export async function deleteAddress(id: string): Promise<boolean> {
  if (dataSource() !== "payload") return false;

  const payload = await getPayloadClient();
  try {
    await payload.delete({ collection: "addresses", id });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// setDefaultAddress
// ---------------------------------------------------------------------------

export async function setDefaultAddress(id: string, customerAuthId: string): Promise<Address | null> {
  if (dataSource() !== "payload") return null;

  const payload = await getPayloadClient();
  await _clearDefaultAddresses(payload, customerAuthId);
  const doc = await payload.update({
    collection: "addresses",
    id,
    data: { isDefault: true },
  });
  return mapPayloadAddress(doc as RawPayloadAddress);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function _clearDefaultAddresses(payload: any, customerAuthId: string): Promise<void> {
  await payload.update({
    collection: "addresses",
    where: {
      and: [
        { customerAuthId: { equals: customerAuthId } },
        { isDefault: { equals: true } },
      ],
    },
    data: { isDefault: false },
  });
}
