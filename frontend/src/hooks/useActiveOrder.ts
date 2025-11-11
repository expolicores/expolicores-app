// =============================
// File: src/hooks/useActiveOrder.ts
// Desc: Obtiene el último pedido relevante del usuario usando /orders/my.
//       Prioriza ACTIVO (RECIBIDO/EN_CAMINO). Si no hay, muestra ENTREGADO
//       reciente dentro de una ventana configurable. Usa React Query con
//       polling adaptativo (más frecuente cuando hay activo).
// =============================
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Order, OrderStatus } from '../types/order';
import { ORDER_STATUS } from '../types/order';

type Options = {
  /** Minutos para seguir mostrando ENTREGADO después de completado. 0 para desactivar. */
  showDeliveredWindowMin?: number;
  /** Polling cuando hay pedido ACTIVO (ms) */
  activePollMs?: number;
  /** Polling cuando no hay activo (ms) */
  idlePollMs?: number;
};

type Mode = 'ACTIVE' | 'DELIVERED_RECENT' | 'NONE';

const isActive = (s: OrderStatus) =>
  s === ORDER_STATUS.RECIBIDO || s === ORDER_STATUS.EN_CAMINO;

function minutesSince(iso?: string) {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return (Date.now() - t) / 60000;
}

function parseOrders(raw: any): Order[] {
  if (Array.isArray(raw?.items)) return raw.items as Order[];
  if (Array.isArray(raw)) return raw as Order[];
  return [];
}

export function useActiveOrder(options?: Options) {
  const {
    showDeliveredWindowMin = 20,
    activePollMs = 8000,
    idlePollMs = 20000,
  } = options || {};

  const q = useQuery({
    queryKey: ['orders/my', 'active-latest', { showDeliveredWindowMin }],
    queryFn: async (): Promise<{ order: Order | null; mode: Mode }> => {
      // /orders/my → array plano [{ id, status, createdAt, updatedAt, ... }]
      const r = await api.get('/orders/my');
      const orders = parseOrders(r.data);

      // 1) Último ACTIVO (RECIBIDO/EN_CAMINO) por createdAt desc
      const active = orders
        .filter((o) => isActive(o.status))
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0];

      if (active) {
        return { order: active, mode: 'ACTIVE' as const };
      }

      // 2) (Opcional) ENTREGADO reciente por updatedAt/createdAt desc dentro de la ventana
      if (showDeliveredWindowMin > 0) {
        const lastDelivered = orders
          .filter((o) => o.status === ORDER_STATUS.ENTREGADO)
          .sort(
            (a, b) =>
              new Date(b.updatedAt ?? b.createdAt).getTime() -
              new Date(a.updatedAt ?? a.createdAt).getTime()
          )[0];

        if (lastDelivered) {
          const mins = minutesSince(lastDelivered.updatedAt ?? lastDelivered.createdAt);
          if (mins <= showDeliveredWindowMin) {
            return { order: lastDelivered, mode: 'DELIVERED_RECENT' as const };
          }
        }
      }

      return { order: null, mode: 'NONE' as const };
    },

    // Polling adaptativo según resultado
    refetchInterval: (query) => {
      const data = query.state.data as { order: Order | null; mode: Mode } | undefined;
      if (!data) return idlePollMs;
      if (data.mode === 'ACTIVE') return activePollMs;          // hay pedido activo → más frecuente
      if (data.mode === 'DELIVERED_RECENT') return idlePollMs;  // solo entregado reciente
      return idlePollMs;                                        // sin pedido relevante
    },

    refetchOnWindowFocus: true,
    // Mantén GC bajo para no rehidratar toda la lista con frecuencia
    gcTime: 60_000,
  });

  return {
    order: q.data?.order ?? null,
    mode: (q.data?.mode ?? 'NONE') as Mode,
    loading: q.isLoading || q.isFetching,
    refetch: q.refetch,
  };
}
