// frontend/src/lib/liveActivity.ts
import { Platform } from 'react-native';
import {
  ActivityKit,
  ActivityAuthorizationStatus,
} from '@kingstinct/react-native-activity-kit';
import { api } from './api';

export type LiveActivityStatus =
  | 'CREADO'
  | 'EN_CAMINO'
  | 'ENTREGADO'
  | 'CANCELADO';

export type LiveActivityState = {
  orderId: number;
  status: LiveActivityStatus;
  etaMinutes?: number;
  driverName?: string;
  totalCOP?: number;
  addressShort?: string;
};

// Guardamos en memoria el último activityId iniciado en esta sesión
let currentActivityId: string | null = null;

/**
 * Verifica si Live Activities está disponible (iOS 16.2+, permisos habilitados).
 */
export async function isLiveActivityAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    const available = await ActivityKit.isAvailable();
    if (!available) return false;
    const auth = await ActivityKit.getAuthorizationStatus();
    return auth !== ActivityAuthorizationStatus.denied;
  } catch {
    return false;
  }
}

/**
 * Inicia la Live Activity del pedido y registra el pushToken específico en backend.
 */
export async function startOrderActivity(params: {
  orderId: number;
  totalCOP?: number;
  addressShort?: string;
}): Promise<{ activityId: string } | null> {
  if (!(await isLiveActivityAvailable())) return null;

  try {
    const attributes = { storeName: 'Expolicores' } as any;
    const initialState: LiveActivityState = {
      orderId: params.orderId,
      status: 'CREADO',
      totalCOP: params.totalCOP,
      addressShort: params.addressShort,
    };

    const { activityId, pushToken } = await ActivityKit.startActivity(
      attributes,
      initialState
    );

    currentActivityId = activityId;

    // Registrar en backend el pushToken único de la Live Activity
    await api.post('/live-activities/register', {
      orderId: params.orderId,
      activityId,
      pushToken,
    });

    return { activityId };
  } catch (e) {
    console.warn('[LiveActivity] start error', e);
    return null;
  }
}

/**
 * Actualiza el estado local de la Live Activity (útil cuando la app está activa).
 * Las actualizaciones de backend llegarán por APNs (liveactivity).
 */
export async function updateOrderActivity(
  patch: Partial<LiveActivityState>
): Promise<void> {
  if (!(await isLiveActivityAvailable())) return;
  if (!currentActivityId) return;

  try {
    await ActivityKit.updateActivity(currentActivityId, patch);
  } catch (e) {
    console.warn('[LiveActivity] update error', e);
  }
}

/**
 * Termina la Live Activity (ej. al entregarse/cancelarse el pedido).
 */
export async function endOrderActivity(
  finalState?: Partial<LiveActivityState>
): Promise<void> {
  if (!(await isLiveActivityAvailable())) return;
  if (!currentActivityId) return;

  try {
    await ActivityKit.endActivity(currentActivityId, finalState ?? {});
  } catch (e) {
    console.warn('[LiveActivity] end error', e);
  } finally {
    currentActivityId = null;
  }
}
