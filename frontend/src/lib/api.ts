// frontend/src/lib/api.ts
import axios, { AxiosError, type AxiosInstance, type AxiosRequestHeaders } from 'axios';
import { Platform } from 'react-native';

// Tipos existentes en tu repo
import type { Product, AdminProduct } from '../types/product';
import type { Address } from '../types/address';
import type { CreateOrderDto, OrderSuccess, Order, OrderStatus } from '../types/order';

/* ================= Base URL (Expo: EXPO_PUBLIC_* disponible en runtime) ================ */
export const API_BASE_URL =
  (process.env.EXPO_PUBLIC_API_BASE_URL || '').trim() ||
  (Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000');

console.log('[API] baseURL =', API_BASE_URL);

/* ============================== Axios instance ======================================== */
export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    accept: 'application/json',
    'content-type': 'application/json',
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
  const normalized = toLowercaseHeaders(config.headers);

  // Reforzamos anti-cache siempre
  normalized['cache-control'] = 'no-cache';
  normalized['pragma'] = 'no-cache';
  normalized['expires'] = '0';

  // Sonda anti 304 (solo GET)
  const method = (config.method || 'get').toLowerCase();
  if (method === 'get') {
    normalized['if-modified-since'] = 'Mon, 26 Jul 1997 05:00:00 GMT';
  }

  config.headers = normalized;
  if (__DEV__) console.log('[API] ->', method, config.url, 'auth:', !!normalized['authorization']);
  return config;
});

// Normalización de errores en una forma consistente
export type ApiErrorShape = {
  status: number;
  message: string;
  details?: any;
};

api.interceptors.response.use(
  (r) => r,
  (err: AxiosError) => {
    const status = err.response?.status ?? 0;
    const data: any = err.response?.data ?? {};
    const message =
      (Array.isArray(data?.message) ? data.message.join(', ') : data?.message) ||
      err.message ||
      'Error de red';
    const apiErr: ApiErrorShape = { status, message, details: data };
    if (__DEV__) console.warn('[API ERROR]', apiErr);
    return Promise.reject(apiErr);
  }
);

/* ============================ Auth header plumbing ==================================== */
let _token: string | null = null;

/** Setea o limpia el token JWT en el cliente HTTP (en minúscula). */
export function setAuthToken(token: string | null | undefined) {
  _token = token ?? null;
  if (_token) {
    api.defaults.headers.common['authorization'] = `Bearer ${_token}`;
  } else {
    delete (api.defaults.headers.common as any)['authorization'];
  }
}

/** Obtiene el token actual guardado por setAuthToken (útil para debug). */
export function getAuthToken() {
  return _token;
}

/** Útil para debug: leer el baseURL actual desde la app */
export function getApiBaseUrl() {
  return (api.defaults as any).baseURL as string;
}

/* =================================== AUTH ============================================ */
/** OTP-first */
export type RequestOtpBody =
  | { phone: string; channel?: 'sms' | 'whatsapp'; intent?: 'login' | 'register' }
  | { email: string; intent?: 'login' | 'register' };

export type RequestOtpResp = {
  ok: boolean;
  throttled?: boolean;
  phoneMasked?: string;
  devOtp?: string;
  // UX hints del backend
  cooldownSeconds?: number;   // p.ej. 60
  remainingSeconds?: number;  // si responde throttled
  expiresInSeconds?: number;  // p.ej. 600 (10 min)
};

export type VerifyOtpBody =
  | { phone: string; code: string; name?: string; emailEnroll?: string }
  | { email: string; code: string };

export type VerifyOtpResp = {
  access_token: string;
  user: {
    id: number;
    name: string | null;
    email: string | null;
    phone: string | null;
    role: 'USER' | 'ADMIN' | 'BUSINESS';
    isEmailVerified: boolean;
    isPhoneVerified: boolean;
  };
};

export async function requestOtp(body: RequestOtpBody): Promise<RequestOtpResp> {
  const { data } = await api.post<RequestOtpResp>('/auth/request-otp', body);
  return data;
}

/** Nombre explícito para usar desde AuthContext. */
export async function verifyOtpApi(body: VerifyOtpBody): Promise<VerifyOtpResp> {
  const { data } = await api.post<VerifyOtpResp>('/auth/verify-otp', body);
  return data;
}

/** Alias de compatibilidad si en alguna parte se importaba `verifyOtp`. */
export const verifyOtp = verifyOtpApi;

export async function verifyEmail(token: string) {
  const { data } = await api.post('/auth/verify-email', { token });
  return data as { ok: boolean };
}

/** Perfil actual (JWT requerido) */
export async function getMe(): Promise<VerifyOtpResp['user']> {
  const { data } = await api.get('/auth/me');
  return data;
}

/** Compat legado (hasta migrar todo a OTP-first) */
export async function loginWithPassword(email: string, password: string): Promise<{ access_token: string }> {
  const { data } = await api.post('/auth/login', { email, password });
  return data;
}
export async function registerWithPassword(payload: { name: string; email: string; password: string; phone?: string }) {
  const { data } = await api.post('/auth/register', payload);
  return data;
}

/* ============================ Name / Perfil ========================================== */
export async function updateMe(payload: { name?: string; email?: string }) {
  const { data } = await api.patch('/users/me', payload);
  return data;
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
    headers: { 'cache-control': 'no-cache', pragma: 'no-cache', expires: '0' },
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

/** Compat: devuelve SOLO el array (ignora total). */
export async function getProducts(params?: GetProductsParams, opts?: RequestOpts): Promise<Product[]> {
  const { items } = await getProductsPaged(params ?? {}, opts ?? {});
  return items;
}

export async function getCategories(opts: RequestOpts = {}): Promise<string[]> {
  const { data } = await api.get<string[]>('/products/categories', { signal: opts.signal });
  return data ?? [];
}

export async function getProductById(id: number, opts: RequestOpts = {}): Promise<Product> {
  const { data } = await api.get<Product>(`/products/${id}`, { signal: opts.signal });
  return data;
}

/* ================================== Favoritos ========================================= */
export async function fetchFavorites(opts: RequestOpts = {}): Promise<Product[]> {
  const { data } = await api.get<Product[]>('/favorites', { signal: opts.signal });
  return data ?? [];
}

export async function addFavorite(productId: number): Promise<Product> {
  const { data } = await api.post<Product>(`/favorites/${productId}`);
  return data;
}

export async function removeFavorite(productId: number): Promise<void> {
  await api.delete(`/favorites/${productId}`);
}

/* ================================== Direcciones ======================================= */
export async function getAddresses(opts: RequestOpts = {}): Promise<Address[]> {
  const { data } = await api.get<Address[]>('/users/addresses', { signal: opts.signal });
  return data ?? [];
}

export async function createAddress(payload: Omit<Address, 'id' | 'createdAt' | 'updatedAt'>): Promise<Address> {
  const { data } = await api.post<Address>('/users/addresses', payload);
  return data;
}

export async function updateAddress(
  id: number,
  payload: Partial<Omit<Address, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<Address> {
  const { data } = await api.put<Address>(`/users/addresses/${id}`, payload);
  return data;
}

export async function deleteAddress(id: number): Promise<{ ok: boolean }> {
  const { data } = await api.delete<{ ok: boolean }>(`/users/addresses/${id}`);
  return data;
}

/* ===================================== Órdenes ======================================== */
export async function createOrder(dto: CreateOrderDto): Promise<OrderSuccess> {
  const { data } = await api.post<OrderSuccess>('/orders', dto);
  return data;
}

export async function getMyOrders(opts: RequestOpts = {}): Promise<Order[]> {
  const { data } = await api.get<Order[]>('/orders/my', { signal: opts.signal });
  return data ?? [];
}

export async function getOrderById(orderId: number, opts: RequestOpts = {}): Promise<Order> {
  const { data } = await api.get<Order>(`/orders/${orderId}`, { signal: opts.signal });
  return data;
}

/** Admin/Bodega: cambiar estado (protegido por rol en el backend) */
export async function updateOrderStatus(orderId: number, status: OrderStatus): Promise<Order> {
  const { data } = await api.patch<Order>(`/orders/${orderId}/status`, { status });
  return data;
}

/* ================================== Admin Products ==================================== */
export async function adminCreateProduct(payload: Omit<AdminProduct, 'id' | 'createdAt' | 'updatedAt'>) {
  const { data } = await api.post('/products', payload);
  return data;
}
export async function adminUpdateProduct(id: number, payload: Partial<AdminProduct>) {
  const { data } = await api.put(`/products/${id}`, payload);
  return data;
}
export async function adminDeleteProduct(id: number) {
  const { data } = await api.delete(`/products/${id}`);
  return data;
}

export default api;
