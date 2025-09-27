// src/types/order.ts

// --- Enums/Unions de dominio ---
export type OrderStatus = 'RECIBIDO' | 'EN_CAMINO' | 'ENTREGADO' | 'CANCELADO';
export type PaymentMethod = 'COD';

// --- DTO de creación (checkout) ---
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

// --- Respuesta de éxito al crear la orden (se mantiene) ---
export interface OrderSuccess {
  id: number;
  status: OrderStatus;
  subtotal: number;
  shipping: number;
  total: number;
}

// --- Tipos para listar y ver detalle (US11) ---
export interface ProductMini {
  id: number;
  name: string;
  price: number;
  imageUrl?: string | null;
}

export interface OrderItem {
  id: number;
  productId: number;
  quantity: number;
  product?: ProductMini; // opcional: depende del include del BE
}

export interface Order {
  id: number;
  total: number;
  status: OrderStatus;
  createdAt: string;     // ISO string
  updatedAt?: string;    // ISO string (si agregas @updatedAt en Prisma)
  items: OrderItem[];
}

// Alias útiles para endpoints
export type OrderListItem = Order;        // GET /orders/my
export type OrderDetail = Order;          // GET /orders/:id (owner o admin)
