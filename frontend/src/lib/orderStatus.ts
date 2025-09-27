import { OrderStatus } from '../types/order';

export const isFinal = (s: OrderStatus) => s === 'ENTREGADO' || s === 'CANCELADO';

export const statusColor: Record<OrderStatus, string> = {
  RECIBIDO:   '#2563eb', // azul
  EN_CAMINO:  '#f59e0b', // ámbar
  ENTREGADO:  '#16a34a', // verde
  CANCELADO:  '#ef4444', // rojo
};

export const statusLabel: Record<OrderStatus, string> = {
  RECIBIDO:  'Recibido',
  EN_CAMINO: 'En camino',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
};
