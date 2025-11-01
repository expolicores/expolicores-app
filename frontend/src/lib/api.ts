// frontend/src/lib/api.ts
import axios, {
  AxiosError,
  type AxiosInstance,
} from 'axios';
import { Platform } from 'react-native';
import { ENV } from '../config/env';

import type { Product, AdminProduct } from '../types/product';
import type { Address } from '../types/address';
import type {
  CreateOrderDto,
  OrderSuccess,
  Order,
  OrderStatus,
  OrderWithUser,
} from '../types/order';

/* ================= Base URL ================= */

function isAbsoluteHttpUrl(v?: string | null) {
  if (!v) return false;
  return /^https?:\/\//i.test(v.trim());
}
function normalizeBaseUrl(input?: string | null): string | undefined {
  if (!input) return undefined;
  let v = input.trim();
  if (!v) return undefined;
  if (!isAbsoluteHttpUrl(v)) v = `https://${v}`;
  return v.replace(/\/+$/, '');
}

const RAW_API_BASE_URL =
  (ENV.API_URL as string | undefined)?.trim() ||
  (ENV.API_BASE_URL as string | undefined)?.trim() ||
  (process.env.EXPO_PUBLIC_API_BASE_URL as string | undefined)?.trim() ||
  (process.env.EXPO_PUBLIC_API_URL as string | undefined)?.trim();

const API_BASE_URL =
  normalizeBaseUrl(RAW_API_BASE_URL) ||
  (Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000');

const API_TIMEOUT_MS = Number(ENV.API_TIMEOUT_MS ?? 15000);

console.log('[API] BASE_URL =>', API_BASE_URL, '| timeout =', API_TIMEOUT_MS, 'ms');

/* ================= Axios instance ================= */

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT_MS,
  headers: {
    Accept: 'application/json',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    Expires: '0',
  },
});

/* ================= Request interceptor (no sobreescribir headers) ================= */

const DEBUG_HTTP =
  (ENV as any).DEBUG_HTTP ??
  ((process.env.EXPO_PUBLIC_DEBUG_HTTP ?? 'false') === 'true');
const DEBUG_HTTP_VERBOSITY =
  (ENV as any).DEBUG_HTTP_VERBOSITY ??
  String(process.env.EXPO_PUBLIC_DEBUG_HTTP_LEVEL ?? 'normal'); // "normal" | "verbose"

const lastLogAt: Record<string, number> = {};
const DEDUPE_MS = 800;
const NOISY_PATHS = [/^\/auth\/me$/, /^\/orders\/my$/];

api.interceptors.request.use((config) => {
  const method = (config.method || 'get').toLowerCase();

  // Garantiza encabezados sin perder los existentes (AxiosHeaders-aware)
  const H: any = config.headers ?? {};
  const set = (k: string, v: string) => {
    if (typeof (H as any).set === 'function') H.set(k, v);
    else (config.headers as any) = { ...(config.headers || {}), [k]: v };
  };
  const has = (k: string) =>
    typeof (H as any).has === 'function'
      ? H.has(k)
      : !!(config.headers as any)?.[k] || !!(config.headers as any)?.[k.toLowerCase()];

  // Anti-cache siempre
  set('Cache-Control', 'no-cache');
  set('Pragma', 'no-cache');
  set('Expires', '0');
  if (method === 'get') set('If-Modified-Since', 'Mon, 26 Jul 1997 05:00:00 GMT');

  // Si hay body y NO es FormData, aseguramos JSON y serializamos si hace falta
  const isFormData =
    typeof FormData !== 'undefined' && config.data instanceof FormData;

  if (config.data != null && !isFormData) {
    if (!has('Content-Type')) set('Content-Type', 'application/json');
    // Axios serializa solo si le pasas objeto + content-type json; para blindarnos:
    if (typeof config.data !== 'string') {
      try {
        config.data = JSON.stringify(config.data);
      } catch {
        // deja como está si no serializa
      }
    }
  }

  // Logging controlado
  if (DEBUG_HTTP) {
    const path = (config.url || '').split('?')[0];
    const isNoisy = NOISY_PATHS.some((re) => re.test(path));
    const now = Date.now();
    const key = `${method} ${path}`;
    const tooSoon = now - (lastLogAt[key] || 0) < DEDUPE_MS;
    if (!isNoisy || DEBUG_HTTP_VERBOSITY === 'verbose') {
      if (!tooSoon) {
        const authHdr =
          (typeof (H as any).get === 'function' && (H as any).get('Authorization')) ||
          (config.headers as any)?.Authorization ||
          (config.headers as any)?.authorization;
        console.log('[API] ->', method, config.url, 'auth:', !!authHdr);
        lastLogAt[key] = now;
      }
    }
  }

  return config;
});

/* ================= Response interceptor (normaliza error) ================= */

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
  },
);

/* ================= Auth header helpers ================= */

let _token: string | null = null;
export function setAuthToken(token: string | null | undefined) {
  _token = token ?? null;
  const val = _token ? `Bearer ${_token}` : undefined;
  if (val) {
    // set en ambos por compatibilidad de mayúsculas
    (api.defaults.headers.common as any)['Authorization'] = val;
    (api.defaults.headers.common as any)['authorization'] = val;
  } else {
    delete (api.defaults.headers.common as any)['Authorization'];
    delete (api.defaults.headers.common as any)['authorization'];
  }
}
export function getAuthToken() {
  return _token;
}
export function getApiBaseUrl() {
  return (api.defaults as any).baseURL as string;
}

/* =================== AUTH (OTP-first) =================== */

export type RequestOtpBody =
  | { phone: string; channel?: 'sms' | 'whatsapp'; intent?: 'login' | 'register' }
  | { email: string; intent?: 'login' | 'register' };

export type RequestOtpResp = {
  ok: boolean;
  throttled?: boolean;
  phoneMasked?: string;
  devOtp?: string;
  cooldownSeconds?: number;
  remainingSeconds?: number;
  expiresInSeconds?: number;
};

export type Role = 'ADMIN' | 'B2C' | 'B2B';
export type BusinessVerificationStatus = 'NONE' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
export type AdminProcessStatus = 'PENDING' | 'IN_PROGRESS' | 'ATTENDED';

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
    role: Role;
    isEmailVerified: boolean;
    isPhoneVerified: boolean;
    businessVerificationStatus: BusinessVerificationStatus;
    adminProcessStatus: AdminProcessStatus;
  };
};

export async function requestOtp(body: RequestOtpBody): Promise<RequestOtpResp> {
  const { data } = await api.post<RequestOtpResp>('/auth/request-otp', body);
  return data;
}
export async function verifyOtpApi(body: VerifyOtpBody): Promise<VerifyOtpResp> {
  const { data } = await api.post<VerifyOtpResp>('/auth/verify-otp', body);
  return data;
}
export const verifyOtp = verifyOtpApi;

export async function verifyEmail(token: string) {
  const { data } = await api.post('/auth/verify-email', { token });
  return data as { ok: boolean };
}
export async function getMe(): Promise<VerifyOtpResp['user']> {
  const { data } = await api.get('/auth/me');
  return data;
}
export async function loginWithPassword(email: string, password: string) {
  const { data } = await api.post('/auth/login', { email, password });
  return data as { access_token: string };
}
export async function registerWithPassword(payload: {
  name: string;
  email: string;
  password: string;
  phone?: string;
}) {
  const { data } = await api.post('/auth/register', payload);
  return data;
}

/* ================= Profile ================= */

export async function updateMe(payload: { name?: string; email?: string }) {
  const { data } = await api.patch('/users/me', payload);
  return data;
}

/* ================= Products ================= */

export type GetProductsParams = {
  q?: string;
  category?: string;
  page?: number;
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

export async function getProductsPaged(
  params: GetProductsParams = {},
  opts: RequestOpts = {},
): Promise<ProductList> {
  const { q, category, page = 1, limit = 20, sort = 'newest' } = params;
  const resp = await api.get<Product[]>('/products', {
    params: { q, category, page, limit, sort },
    signal: opts.signal,
    headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache', Expires: '0' },
  });
  return { items: resp.data ?? [], total: parseTotal(resp.headers as any) };
}
export function getNextPageParamFactory(pageSize = 20) {
  return (lastPage: ProductList, allPages: ProductList[], lastPageParam?: number) => {
    const loaded = allPages.reduce((acc, p) => acc + p.items.length, 0);
    if (loaded < lastPage.total) {
      const nextByCount = Math.floor(loaded / pageSize) + 1;
      const nextByParam = (lastPageParam ?? 1) + 1;
      return Math.max(nextByCount, nextByParam);
    }
    return undefined;
  };
}
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

export async function fetchProductByCodeOrId(productId: string | number, opts: RequestOpts = {}): Promise<Product> {
  const num = typeof productId === 'number' ? productId : Number(productId);
  if (!Number.isFinite(num) || num <= 0) {
    throw new Error('Producto inválido');
  }
  return getProductById(num, opts);
}

/* ================= Favorites ================= */

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

/* ================= Addresses ================= */

export async function getAddresses(opts: RequestOpts = {}): Promise<Address[]> {
  const { data } = await api.get<Address[]>('/users/addresses', { signal: opts.signal });
  return data ?? [];
}
export async function createAddress(payload: Omit<Address, 'id' | 'createdAt' | 'updatedAt'>): Promise<Address> {
  const { data } = await api.post<Address>('/users/addresses', payload);
  return data;
}
export async function updateAddress(id: number, payload: Partial<Omit<Address, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Address> {
  const { data } = await api.put<Address>(`/users/addresses/${id}`, payload);
  return data;
}
export async function deleteAddress(id: number): Promise<{ ok: boolean }> {
  const { data } = await api.delete<{ ok: boolean }>(`/users/addresses/${id}`);
  return data;
}

/* ================= Orders ================= */

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
export async function updateOrderStatus(orderId: number, status: OrderStatus): Promise<Order> {
  const { data } = await api.patch<Order>(`/orders/${orderId}/status`, { status });
  return data;
}
export async function fetchAllOrders(params: Record<string, unknown> = {}, opts: RequestOpts = {}): Promise<OrderWithUser[]> {
  const { data } = await api.get<OrderWithUser[]>('/orders', { params, signal: opts.signal });
  return data ?? [];
}

/* ================= Admin Promotions ================= */

export interface AdminPromotionProduct {
  productId: string;
}

export interface AdminPromotion {
  id: string;
  name?: string;
  type?: string;
  audience?: string;
  priority?: number;
  published?: boolean;
  products?: AdminPromotionProduct[];
  benefits?: Record<string, unknown>;
  startsAt?: string;
  endsAt?: string;
  conditions?: Record<string, unknown>;
}

export async function fetchAdminPromotions(headers?: Record<string, string>): Promise<AdminPromotion[]> {
  const { data } = await api.get<AdminPromotion[]>('/admin/promotions', { headers });
  return Array.isArray(data) ? data : [];
}

/* ================= Admin Products ================= */

export type ProductPricePatch = { price?: number; b2bPrice?: number };
export async function fetchAdminProducts(opts: RequestOpts = {}): Promise<AdminProduct[]> {
  const { data } = await api.get<AdminProduct[]>('/products/admin', { signal: opts.signal });
  return data ?? [];
}
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
export async function updateProductPricing(productId: number, payload: ProductPricePatch): Promise<AdminProduct> {
  const { data } = await api.patch<AdminProduct>(`/products/${productId}`, payload);
  return data;
}

/* ================= B2B ================= */

export async function businessApply(): Promise<{ ok: boolean }> {
  const { data } = await api.post<{ ok: boolean }>('/business/apply', {});
  return data;
}
export type MeB2B = VerifyOtpResp['user'];
export async function businessMe(): Promise<MeB2B> {
  const { data } = await api.get<MeB2B>('/business/me');
  return data;
}
export async function adminListB2BApplications(status?: string) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  const { data } = await api.get('/admin/business/applications' + qs);
  return data as Array<{
    id: number;
    name?: string | null;
    phone: string;
    email?: string | null;
    role: Role;
    businessVerificationStatus: BusinessVerificationStatus;
    adminProcessStatus: AdminProcessStatus;
    createdAt?: string;
    updatedAt?: string;
  }>;
}
export async function adminSetB2BVerification(userId: number, status: 'APPROVED' | 'REJECTED') {
  const { data } = await api.patch(`/admin/business/${userId}/verification`, { status });
  return data;
}
export async function adminSetB2BAdminProcess(userId: number, status: 'PENDING' | 'IN_PROGRESS' | 'ATTENDED') {
  const { data } = await api.patch(`/admin/business/${userId}/admin-process`, { status });
  return data;
}

/* ================= FEED ================= */

export type PricingView = 'B2C_ONLY' | 'B2B_DEFAULT' | 'COMPARATIVE' | 'PUBLIC_REFERENCE';
export type SlotType = 'hero' | 'collection' | 'nav' | 'chips' | 'editorial';

export interface FeedItem {
  productId?: string;
  title?: string;
  subtitle?: string;
  image?: string;
  badges?: string[];
  priceB2C?: number;
  priceB2B?: number;
}
export interface FeedSlot {
  id: string;
  type: SlotType;
  title?: string;
  subtitle?: string;
  image?: string;
  layout?: 'grid' | 'carousel';
  pricingView: PricingView;
  items?: FeedItem[];
  cta?: { label: string; deeplink?: string };
}
export interface FeedResponse {
  version: string;
  updatedAt?: string;
  timezone?: string;
  slots: FeedSlot[];
}

export const FEATURE_FEED_JSON =
  (ENV as any).FEATURE_FEED_JSON ??
  (process.env.EXPO_PUBLIC_FEATURE_FEED_JSON ?? 'true') === 'true';

export async function fetchFeed(opts?: {
  previewUrl?: string;
  adminToken?: string;
  signal?: AbortSignal;
}): Promise<FeedResponse> {
  const headers: Record<string, string> = {};
  if (opts?.adminToken) headers['x-admin-token'] = opts.adminToken;

  const params: Record<string, string> = {};
  if (opts?.previewUrl) params.previewUrl = opts.previewUrl;

  const { data } = await api.get<FeedResponse>('/feed', {
    params,
    headers,
    signal: opts?.signal,
  });
  return data;
}

export default api;
