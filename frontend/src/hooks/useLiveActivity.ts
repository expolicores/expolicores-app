import { useRef } from 'react';
import { laStart, laUpdate, laStop, registerLAOnBackend } from '../lib/liveActivityProvider';

export function useLiveActivity(orderId: number, orderNumber?: string) {
  const activityIdRef = useRef<string | null>(null);

  return {
    async start(initialETA?: number) {
      const res = await laStart(orderId, {
        status: 'CREATED',
        etaMinutes: initialETA,
        orderNumber: orderNumber ?? String(orderId),
      });
      await registerLAOnBackend(orderId, res);
      activityIdRef.current = res?.activityId ?? null;
      return res;
    },
    async update(status: 'EN_CAMINO' | 'ENTREGADO' | 'CANCELADO', etaMinutes?: number) {
      if (!activityIdRef.current) return;
      await laUpdate(activityIdRef.current, { status, etaMinutes, orderNumber: orderNumber ?? String(orderId) });
    },
    async stop() {
      if (!activityIdRef.current) return;
      await laStop(activityIdRef.current);
      activityIdRef.current = null;
    },
  };
}
