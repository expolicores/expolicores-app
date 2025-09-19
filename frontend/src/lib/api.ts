import axios from 'axios';
import type { Product } from '../types/product';

// Expo expone variables EXPO_PUBLIC_* en process.env
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || 'http://localhost:3000';
console.log('[API] baseURL =', API_BASE_URL);

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { Accept: 'application/json' },
});

// -------- Auth header plumbing --------
let _setAuthHeader: (token: string | null) => void = (t) => {
  if (t) api.defaults.headers.common.Authorization = `Bearer ${t}`;
  else delete api.defaults.headers.common.Authorization;
};

/** Permite que el AuthProvider reemplace el setter si lo desea */
export function authHeaderSetter(fn?: (token: string | null) => void) {
  if (fn) _setAuthHeader = fn;
}

export function setAuthToken(token: string | null) {
  _setAuthHeader(token);
}

// -------------------- US06 (nuevo) -------------------- //
export type GetProductsParams = {
  q?: string;
  category?: string;
  page?: number;   // default BE: 1
  limit?: number;  // default BE: 20
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'name_asc' | 'name_desc';
};

export type ProductList = { items: Product[]; total: number };

function parseTotal(headers: Record<string, any>): number {
  const raw = headers?.['x-total-count'] ?? headers?.['X-Total-Count'];
  const n = Number.parseInt(String(raw ?? '0'), 10);
  return Number.isFinite(n) ? n : 0;
}

/** Devuelve items + total (leído de X-Total-Count). Úsalo para infinite scroll. */
export async function getProductsPaged(params: GetProductsParams = {}): Promise<ProductList> {
  const resp = await api.get<Product[]>('/products', { params });
  return { items: resp.data ?? [], total: parseTotal(resp.headers as any) };
}

// -------------------- US05 (legacy compatible) -------------------- //
/** Compatibilidad: devuelve SOLO el array (ignora total). */
export async function getProducts(params?: GetProductsParams): Promise<Product[]> {
  const { items } = await getProductsPaged(params ?? {});
  return items; // 200 y [] si vacío
}

export async function getCategories(): Promise<string[]> {
  try {
    const { data } = await api.get<string[]>('/products/categories');
    return Array.isArray(data) ? data : [];
  } catch (e: any) {
    // Si el endpoint aún no existe en Back, devolvemos [] y el FE puede derivarlas localmente
    if (e?.response?.status === 404) return [];
    throw e;
  }
}
