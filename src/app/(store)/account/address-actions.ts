"use server";

/**
 * Address Server Actions — /account
 *
 * CRUD for saved addresses. All actions verify the session and scope
 * operations to the authenticated customer's addresses only.
 */

import { getSessionSafe } from "@/lib/auth/helpers";
import {
  getAddressesByCustomer,
  createAddress,
  deleteAddress,
  setDefaultAddress,
} from "@/lib/repositories/addresses";
import type { Address } from "@/types/address";

// ---------------------------------------------------------------------------
// getMyAddresses — used by server components
// ---------------------------------------------------------------------------

export async function getMyAddresses(): Promise<Address[]> {
  const session = await getSessionSafe();
  if (!session?.user?.id) return [];
  return getAddressesByCustomer(session.user.id);
}

// ---------------------------------------------------------------------------
// createAddressAction
// ---------------------------------------------------------------------------

export interface AddressFormState {
  error?: string;
  success?: boolean;
}

export async function createAddressAction(
  _prevState: AddressFormState,
  formData: FormData
): Promise<AddressFormState> {
  const session = await getSessionSafe();
  if (!session?.user?.id || !session.user.email) {
    return { error: "Sesión no encontrada. Inicia sesión nuevamente." };
  }

  const label = (formData.get("label") as string | null)?.trim() ?? "";
  const fullName = (formData.get("fullName") as string | null)?.trim() ?? "";
  const addressLine1 = (formData.get("addressLine1") as string | null)?.trim() ?? "";
  const city = (formData.get("city") as string | null)?.trim() ?? "";
  const state = (formData.get("state") as string | null)?.trim() ?? "";
  const postalCode = (formData.get("postalCode") as string | null)?.trim() ?? "";
  const phone = (formData.get("phone") as string | null)?.trim() || undefined;
  const addressLine2 = (formData.get("addressLine2") as string | null)?.trim() || undefined;
  const isDefault = formData.get("isDefault") === "on";

  if (!label) return { error: "La etiqueta es requerida (Ej: Casa, Oficina)." };
  if (!fullName) return { error: "El nombre del destinatario es requerido." };
  if (!addressLine1) return { error: "La dirección es requerida." };
  if (!city) return { error: "La ciudad es requerida." };
  if (!state) return { error: "El estado es requerido." };
  if (!postalCode) return { error: "El código postal es requerido." };
  if (!/^\d{5}$/.test(postalCode)) return { error: "El código postal debe tener 5 dígitos." };

  try {
    await createAddress({
      customerAuthId: session.user.id,
      customerEmail: session.user.email,
      label,
      fullName,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      isDefault,
    });
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("DATA_SOURCE")) {
      return { error: "Los domicilios requieren base de datos configurada." };
    }
    return { error: "Error al guardar el domicilio. Inténtalo de nuevo." };
  }
}

// ---------------------------------------------------------------------------
// deleteAddressAction
// ---------------------------------------------------------------------------

export async function deleteAddressAction(id: string): Promise<AddressFormState> {
  const session = await getSessionSafe();
  if (!session?.user?.id) return { error: "Sesión no encontrada." };

  const ok = await deleteAddress(id);
  if (!ok) return { error: "No se pudo eliminar el domicilio." };
  return { success: true };
}

// ---------------------------------------------------------------------------
// setDefaultAddressAction
// ---------------------------------------------------------------------------

export async function setDefaultAddressAction(id: string): Promise<AddressFormState> {
  const session = await getSessionSafe();
  if (!session?.user?.id) return { error: "Sesión no encontrada." };

  const result = await setDefaultAddress(id, session.user.id);
  if (!result) return { error: "No se pudo actualizar el domicilio predeterminado." };
  return { success: true };
}
