// src/lib/address.ts
import api from "./api";
import { Address } from "../types/address";

export async function fetchAddresses(): Promise<Address[]> {
  const { data } = await api.get<Address[]>("/addresses");
  return data;
}

export function pickDefaultAddress(addresses: Address[] | undefined) {
  if (!addresses?.length) return null;
  // El BE ya envía default primero; igual aseguramos:
  return addresses.find(a => a.isDefault) ?? addresses[0];
}
