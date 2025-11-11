// Obtiene pedidos activos (RECIBIDO/EN_CAMINO) y un contador para badgets.
// No requiere cambios en backend. Tolera respuestas { items } o array plano.

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import type { Order } from '../types/order';

type Options = {
  pollMs?: number;           // intervalo de actualización
  limit?: number;            // tope de elementos a traer (para no pedir todo)
};

function parseOrderList(data: any): Order[] {
  if (Array.isArray(data?.items)) return data.items as Order[];
  if (Array.isArray(data)) return data as Order[];
  return [];
}

/** Hook general: lista de pedidos activos (RECIBIDO/EN_CAMINO). */
export function useActiveOrders(opts?: Options) {
  const { pollMs = 15000, limit = 20 } = opts || {};
  const [items, setItems] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<NodeJS.Timeout | null>(null);

  const fetcher = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        status_in: 'RECIBIDO,EN_CAMINO',
        sort: '-createdAt',
        limit: String(limit),
      });
      const res = await api.get(`/orders?${qs.toString()}`);
      setItems(parseOrderList(res.data));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetcher();
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(fetcher, pollMs);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [fetcher, pollMs]);

  return { items, loading, refetch: fetcher };
}

/** Hook de conveniencia: solo el conteo de pedidos activos para badgets. */
export function useActiveOrdersCount(opts?: Options) {
  const { items, loading, refetch } = useActiveOrders(opts);
  return { count: items.length, loading, refetch };
}
