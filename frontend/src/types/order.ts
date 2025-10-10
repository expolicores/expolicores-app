import type { Role } from './auth';

export type OrderStatus = 'RECIBIDO' | 'EN_CAMINO' | 'ENTREGADO' | 'CANCELADO';
export type PaymentMethod = 'COD';

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

export interface OrderSuccess {
  id: number;
  status: OrderStatus;
  subtotal: number;
  shipping: number;
  total: number;
}

export interface ProductMini {
  id: number;
  name: string;
  price: number;
  b2bPrice: number;
  imageUrl?: string | null;
}

export interface OrderItem {
  id: number;
  productId: number;
  quantity: number;
  product?: ProductMini;
}

export interface OrderUserSummary {
  id: number;
  email: string;
  name?: string | null;
  phone?: string | null;
  role: Role;
}

export interface Order {
  id: number;
  total: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt?: string;
  items: OrderItem[];
  user?: OrderUserSummary | null;
}

export type OrderListItem = Order;
export type OrderDetail = Order;
export type OrderWithUser = Order & { user: OrderUserSummary | null };
