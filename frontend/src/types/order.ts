export type CreateOrderItem = { productId: number; quantity: number };
export type CreateOrderDto = {
  addressId: number;
  items: CreateOrderItem[];
  notes?: string;
  paymentMethod?: 'COD';
};

export type OrderSuccess = {
  id: number;
  status: 'RECIBIDO' | 'EN_CAMINO' | 'ENTREGADO' | 'CANCELADO';
  subtotal: number;
  shipping: number;
  total: number;
};
