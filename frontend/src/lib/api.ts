// frontend/src/lib/api.ts
import axios from "axios";
import type { Product } from "../types/product";

// Expo expone variables EXPO_PUBLIC_* en process.env
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || "http://localhost:3000";
console.log("[API] baseURL =", API_BASE_URL);

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { Accept: "application/json" },
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

// -------------------- US06 (paginación real) -------------------- //
export type GetProductsParams = {
  q?: string;
  category?: string;
  page?: number; // 1-based
  limit?: number;
  sort?: "newest" | "price_asc" | "price_desc" | "name_asc" | "name_desc";
};

export type ProductList = { items: Product[]; total: number };

function parseTotal(headers: Record<string, any>): number {
  if (!headers) return 0;
  // Axios normaliza headers a minúscula, pero soportamos ambos por si acaso
  const raw = headers["x-total-count"] ?? headers["X-Total-Count"];
  const n = Number.parseInt(String(raw ?? "0"), 10);
  return Number.isFinite(n) ? n : 0;
}

type RequestOpts = { signal?: AbortSignal };

/** Devuelve items + total (leído de X-Total-Count). Úsalo para infinite scroll. */
export async function getProductsPaged(
  params: GetProductsParams = {},
  opts: RequestOpts = {}
): Promise<ProductList> {
  const {
    q,
    category,
    // Defaults explícitos: si el BE también tiene defaults no pasa nada
    page = 1,
    limit = 20,
    sort = "newest",
  } = params;

  const resp = await api.get<Product[]>("/products", {
    params: { q, category, page, limit, sort },
    signal: opts.signal,
  });

  return { items: resp.data ?? [], total: parseTotal(resp.headers as any) };
}

/**
 * Helper para useInfiniteQuery:
 * const getNextPageParam = getNextPageParamFactory(PAGE_SIZE);
 */
export function getNextPageParamFactory(pageSize = 20) {
  return (lastPage: ProductList, allPages: ProductList[], lastPageParam?: number) => {
    // Opción A (más precisa): calcular por conteo acumulado
    const loaded = allPages.reduce((acc, p) => acc + p.items.length, 0);
    if (loaded < lastPage.total) {
      const nextByCount = Math.floor(loaded / pageSize) + 1; // siguiente 1-based
      // Opción B (simple): incrementar el pageParam conocido
      const nextByParam = (lastPageParam ?? 1) + 1;
      return Math.max(nextByCount, nextByParam);
    }
    return undefined;
  };
}

// -------------------- Compat (array “plano”) -------------------- //
/** Compatibilidad: devuelve SOLO el array (ignora total). */
export async function getProducts(params?: GetProductsParams, opts?: RequestOpts): Promise<Product[]> {
  const { items } = await getProductsPaged(params ?? {}, opts);
  return items; // 200 y [] si vacío
}

export async function getCategories(opts: RequestOpts = {}): Promise<string[]> {
  try {
    const { data } = await api.get<string[]>("/products/categories", { signal: opts.signal });
    return Array.isArray(data) ? data : [];
  } catch (e: any) {
    if (e?.response?.status === 404) return [];
    throw e;
  }
}

export default api;
