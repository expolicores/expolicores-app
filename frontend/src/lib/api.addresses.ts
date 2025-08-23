import { api } from './api';
import { Address } from '../types/address';

export const listAddresses = async () =>
  (await api.get<Address[]>('/addresses')).data;

export const createAddress = async (body: Partial<Address>) =>
  (await api.post<Address>('/addresses', body)).data;

export const updateAddress = async (id: number, body: Partial<Address>) =>
  (await api.patch<Address>(`/addresses/${id}`, body)).data;

export const deleteAddress = async (id: number) =>
  (await api.delete<void>(`/addresses/${id}`)).data;
