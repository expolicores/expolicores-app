// frontend/src/lib/api.ts
import axios, { type AxiosRequestHeaders } from 'axios';
import { Platform } from 'react-native';
import type { Product, AdminProduct } from '../types/product';
import type { Address } from '../types/address';
import type { CreateOrderDto, OrderSuccess, Order, OrderStatus } from '../types/order';

/* ================= Base URL (Expo: EXPO_PUBLIC_* disponible en runtime) ================ */
const API_BASE_URL =
  (process.env.EXPO_PUBLIC_API_BASE_URL || '').trim() ||
  // Fallbacks útiles en dev según simulador/emulador
  (Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000');

console.log('[API] baseURL =', API_BASE_URL);

/* ============================== Axios instance ======================================== */
export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    // Claves en minúsculas para Axios v1
    accept: 'application/json',
    // Evita respuestas 304 del intermediario y fuerza respuesta fresca
    'cache-control': 'no-cache',
    pragma: 'no-cache',
    expires: '0',
  },
});

/* ============ Normalización de headers (minúscula) + anti-cache por request =========== */
function toLowercaseHeaders(h?: any): AxiosRequestHeaders {
  const out: AxiosRequestHeaders = {};
  if (h && typeof h === 'object') {
    for (const [k, v] of Object.entries(h)) {
      out[String(k).toLowerCase()] = v as any;
    }
  }
  return out;
}

api.interceptors.request.use((config) => {
  // Normaliza cualquier header preexistente (incluyendo de llamadas locales)
  const normalized = toLowercaseHeaders(config.headers);
  // Reforzamos anti-cache siempre
  normalized['cache-control'] = 'no-cache';
  normalized['pragma'] = 'no-cache';
  normalized['expires'] = '0';

  // Sonda para algunos proxies tercos (solo GET)
  const method = (config.method || 'get').toLowerCase();
  if (method === 'get') {
    normalized['if-modified-since'] = 'Mon, 26 Jul 1997 05:00:00 GMT';
  }

  config.headers = normalized;
  if (__DEV__) console.log('[API] ->', method, config.url, 'auth:', !!normalized['authorization']);
  return config;
});

/* ============================ Auth header plumbing ==================================== */
/** Setea o limpia el token JWT en el cliente HTTP (en minúscula). */
export function setAuthToken(token: string | null | undefined) {
  if (token) {
    api.defaults.headers.common['authorization'] = `Bearer ${token}`;
  } else {
    delete (api.defaults.headers.common as any)['authorization'];
  }
}

/** Útil para debug: leer el baseURL actual desde la app */
export function getApiBaseUrl() {
  return (api.defaults as any).baseURL as string;
}

/* =============================== Productos (paginación) =============================== */
export type GetProductsParams = {
  q?: string;
  category?: string;
  page?: number; // 1-based
  limit?: number;
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'name_asc' | 'name_desc';
};

export type ProductList = { items: Product[]; total: number };

function parseTotal(headers: Record<string, any>): number {
  if (!headers) return 0;
  const raw = headers['x-total-count'] ?? headers['X-Total-Count'];
  const n = Number.parseInt(String(raw ?? '0'), 10);
  return Number.isFinite(n) ? n : 0;
}

type RequestOpts = { signal?: AbortSignal };

/** Devuelve items + total (leído de X-Total-Count). Úsalo para infinite scroll. */
export async function getProductsPaged(
  params: GetProductsParams = {},
  opts: RequestOpts = {}
): Promise<ProductList> {
  const { q, category, page = 1, limit = 20, sort = 'newest' } = params;

  const resp = await api.get<Product[]>('/products', {
    params: { q, category, page, limit, sort },
    signal: opts.signal,
    headers: {
      // refuerzo no-cache por si hay CDNs intermedios (minúsculas)
      'cache-control': 'no-cache',
      pragma: 'no-cache',
      expires: '0',
    },
  });

  return { items: resp.data ?? [], total: parseTotal(resp.headers as any) };
}

/** Helper para useInfiniteQuery: next page param calculado por conteo */
export function getNextPageParamFactory(pageSize = 20) {
  return (
    lastPage: ProductList,
    allPages: ProductList[],
    lastPageParam?: number
  ) => {
    const loaded = allPages.reduce((acc, p) => acc + p.items.length, 0);
    if (loaded < lastPage.total) {
      const nextByCount = Math.floor(loaded / pageSize) + 1;
      const nextByParam = (lastPageParam ?? 1) + 1;
      return Math.max(nextByCount, nextByParam);
    }
    return undefined;
  };
}

/** Compatibilidad: devuelve SOLO el array (ignora total). */
export async function getProducts(
  params?: GetProductsParams,
  opts?: RequestOpts
): Promise<Product[]> {
  const { items } = await getProductsPaged(params ?? {}, opts ?? {});
  return items;
}

export async function getCategories(opts: RequestOpts = {}): Promise<string[]> {
  try {
    const { data } = await api.get<string[]>('/products/categories', {
      signal: opts.signal,
    });
    return Array.isArray(data) ? data : [];
  } catch (e: any) {
    if (e?.response?.status === 404) return [];
    throw e;
  }
}

/* ============================ Productos (Admin) ======================================= */
export async function fetchAdminProducts(opts: RequestOpts = {}): Promise<AdminProduct[]> {
  const { data } = await api.get<AdminProduct[]>('/products/admin', {
    signal: opts.signal,
  });
  return Array.isArray(data) ? data : [];
}

export type ProductPricePatch = Partial<Pick<AdminProduct, 'price' | 'b2bPrice'>>;

export async function updateProductPricing(
  productId: number,
  payload: ProductPricePatch
): Promise<AdminProduct> {
  const { data } = await api.patch<AdminProduct>(`/products/${productId}`, payload);
  return data;
}

// ============================ Favoritos =============================================
export async function fetchFavorites(opts: RequestOpts = {}): Promise<Product[]> {
  const { data } = await api.get<Product[]>('/favorites', {
    signal: opts.signal,
  });
  return Array.isArray(data) ? data : [];
}

export async function addFavorite(productId: number): Promise<Product> {
  const { data } = await api.post<Product>(`/favorites/${productId}`);
  return data;
}

export async function removeFavorite(productId: number): Promise<void> {
  await api.delete(`/favorites/${productId}`);
}

/* ============================ Orders (Admin / MyOrders) =============================== */
export type GetOrdersParams = {
  status?: 'RECIBIDO' | 'EN_CAMINO' | 'ENTREGADO' | 'CANCELADO';
  page?: number;   // 1-based
  limit?: number;  // default 20
  q?: string;      // id/teléfono si el BE lo soporta
};

/** Lista de órdenes (resumen) — tipa con tu `Order` si ya lo tienes definido */
export async function fetchAllOrders(
  params: GetOrdersParams = {},
  opts: { signal?: AbortSignal } = {}
): Promise<Order[]> {
  const { data } = await api.get<Order[]>('/orders', {
    params,
    signal: opts.signal,
  });
  return data ?? [];
}

// Actualizar estado de una orden (Admin)
export async function updateOrderStatus(orderId: number, status: OrderStatus): Promise<Order> {
  // Ajusta la ruta si tu backend usa otra (p. ej. '/orders/:id' con body parcial)
  const { data } = await api.patch<Order>(`/orders/${orderId}/status`, { status });
  return data;
}

/* ============================ US09 — Checkout helpers ================================ */
/** Direcciones del usuario autenticado (el BE ya filtra por user) */
export async function fetchAddresses(
  opts: RequestOpts = {}
): Promise<Address[]> {
  const { data } = await api.get<Address[]>('/addresses', {
    signal: opts.signal,
  });
  return data ?? [];
}

/** Crear la orden en el backend (usa JWT ya configurado en `api`) */
export async function createOrder(
  payload: CreateOrderDto
): Promise<OrderSuccess & { address?: Partial<Address> }> {
  const { data } = await api.post('/orders', payload);
  return data;
}

export default api;
