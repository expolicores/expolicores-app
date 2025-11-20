import type { Role } from './auth';

/**
 * Estados del pedido según backend.
 * - RECIBIDO: pedido creado/aceptado por la tienda (activo)
 * - EN_CAMINO: despachado, en ruta (activo)
 * - ENTREGADO: completado (no activo)
 * - CANCELADO: cancelado (no activo)
 */
export type OrderStatus = 'RECIBIDO' | 'EN_CAMINO' | 'ENTREGADO' | 'CANCELADO';

/**
 * Constantes en runtime para usar en componentes y hooks.
 * Ej.: if (order.status === ORDER_STATUS.EN_CAMINO) { ... }
 */
export const ORDER_STATUS = {
  RECIBIDO: 'RECIBIDO',
  EN_CAMINO: 'EN_CAMINO',
  ENTREGADO: 'ENTREGADO',
  CANCELADO: 'CANCELADO',
} as const;

/** Subconjunto de estados considerados “activos” para el banner/seguimiento en feed. */
export type ActiveOrderStatus = Extract<OrderStatus, 'RECIBIDO' | 'EN_CAMINO'>;

/** Orden natural del flujo para UI (usa constantes para evitar typos). */
export const ORDER_STATUS_FLOW = [
  ORDER_STATUS.RECIBIDO,
  ORDER_STATUS.EN_CAMINO,
  ORDER_STATUS.ENTREGADO,
  ORDER_STATUS.CANCELADO,
] as const;

/** Útil para filtros del hook (/orders?status_in=RECIBIDO,EN_CAMINO) */
export const ORDER_STATUS_ACTIVE = [
  ORDER_STATUS.RECIBIDO,
  ORDER_STATUS.EN_CAMINO,
] as const;

/** Etiquetas para UI (opcional, por si necesitas mostrar textos centralizados). */
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  RECIBIDO: 'Recibido',
  EN_CAMINO: 'En camino',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
};

/**
 * Métodos de pago soportados por el backend:
 * - CASH      → Efectivo
 * - TRANSFER  → Transferencia
 * - CARD      → Tarjeta
 * - CREDIT    → Crédito (solo negocios / B2B / ADMIN)
 */
export type PaymentMethod = 'CASH' | 'TRANSFER' | 'CARD' | 'CREDIT';

export interface CreateOrderItem {
  productId: number;
  quantity: number;
}

export interface CreateOrderDto {
  addressId: number;
  items: CreateOrderItem[];
  notes?: string;
  paymentMethod?: PaymentMethod;
}

/** Resumen de éxito después de crear un pedido (pantalla OrderSuccess). */
export interface OrderSuccess {
  id: number;
  status: OrderStatus;
  subtotal: number; // COP enteros
  shipping: number; // COP enteros
  total: number;    // COP enteros
}

export interface ProductMini {
  id: number;
  name: string;
  price: number;    // COP enteros (B2C)
  b2bPrice: number; // COP enteros (B2B)
  imageUrl?: string | null;
}

export interface OrderItem {
  id: number;
  productId: number;
  quantity: number;
  product?: ProductMini;
}

/** Resumen de usuario ligado a un pedido (para vistas Admin/OrderDetail). */
export interface OrderUserSummary {
  id: number;
  email: string;
  name?: string | null;
  phone?: string | null;
  role: Role;
}

/**
 * Modelo principal de Pedido en el frontend.
 * Nota: `total` es entero en COP; `updatedAt` puede venir undefined si el backend no lo envía.
 */
export interface Order {
  id: number;
  total: number;          // COP enteros
  status: OrderStatus;
  createdAt: string;      // ISO
  updatedAt?: string;     // ISO | undefined
  items: OrderItem[];
  user?: OrderUserSummary | null;
}

export type OrderListItem = Order;
export type OrderDetail = Order;
export type OrderWithUser = Order & { user: OrderUserSummary | null };
