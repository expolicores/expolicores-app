import { useQuery } from '@tanstack/react-query';
import { AppState } from 'react-native';
import { api } from '../lib/api';

export type OrderStatus = 'RECIBIDO' | 'EN_CAMINO' | 'ENTREGADO' | 'CANCELADO';

const isActive = (s: OrderStatus) => s === 'RECIBIDO' || s === 'EN_CAMINO';

export function useActiveOrdersCount() {
  return useQuery({
    queryKey: ['myOrders', 'activeCount'],
    queryFn: async () => {
      const r = await api.get('/orders/my'); // [{ id, status, ... }]
      const active = (r.data as any[]).filter(o => isActive(o.status)).length;
      return active;
    },
    // auto-refresh “inteligente”
    refetchInterval: (q) => {
      const count = q.state.data as number | undefined;
      // si hay activas, refresca cada 8s; si no, cada 20s
      return count && count > 0 ? 8000 : 20000;
    },
    refetchOnWindowFocus: true,
    enabled: true,
    // pausa si la app está en background (Hermes + RN moderno ya lo maneja,
    // pero lo dejamos explícito por si acaso)
    gcTime: 60_000,
  });
}
