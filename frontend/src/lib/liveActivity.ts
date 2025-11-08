// src/lib/liveActivities.ts
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { api } from './api';

// =======================
// Tipos públicos
// =======================
export type LiveActivityStatus = 'CREADO' | 'EN_CAMINO' | 'ENTREGADO' | 'CANCELADO';

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

// =======================
// Helpers internos
// =======================
function isNativeActivityKitRuntime(): boolean {
  // 'standalone' → TestFlight/App Store
  // 'guest'      → EAS Dev Client
  // 'expo'       → Expo Go (NO soporta módulos nativos custom)
  const owner = Constants.appOwnership;
  const isNativeContainer = owner === 'standalone' || owner === 'guest';
  return Platform.OS === 'ios' && isNativeContainer;
}

// Carga dinámica del módulo para evitar crash en Expo Go
async function loadActivityKit(): Promise<any | undefined> {
  if (!isNativeActivityKitRuntime()) return undefined;
  try {
    const mod = await import('@kingstinct/react-native-activity-kit');
    // Algunas versiones exponen { ActivityKit: {...} }, otras exportan directamente las funciones.
    const AK = (mod as any).ActivityKit ?? mod;
    return AK;
  } catch (e) {
    console.warn('[LiveActivity] ActivityKit no disponible:', e);
    return undefined;
  }
}

// Log remoto simple hacia el backend (no bloquea flujo)
async function remoteLog(event: string, data: Record<string, any> = {}) {
  try {
    await api.post('/debug/logs', {
      event,
      data,
      ts: Date.now(),
      platform: Platform.OS,
      model: Device.modelName,
      appOwnership: Constants.appOwnership,
      version: Constants.expoConfig?.version,
      buildNumber: Constants.expoConfig?.ios?.buildNumber,
    });
  } catch {
    // ignorar errores de logging
  }
}

// =======================
// API pública
// =======================

/**
 * Verifica si Live Activities está disponible (iOS nativo + permisos).
 * En Expo Go siempre devuelve false (evita crash).
 */
export async function isLiveActivityAvailable(): Promise<boolean> {
  const AK = await loadActivityKit();
  if (!AK) return false;

  try {
    const available = await AK.isAvailable?.();
    if (available === false) return false;

    // 2 = denied (evitamos importar el enum de la lib)
    const auth = await AK.getAuthorizationStatus?.();
    return auth !== 2;
  } catch (e) {
    console.warn('[LiveActivity] availability check error:', e);
    return false;
  }
}

/**
 * Inicia la Live Activity del pedido y registra el pushToken específico en backend.
 * En Expo Go hace noop y devuelve null.
 */
export async function startOrderActivity(params: {
  orderId: number;
  totalCOP?: number;
  addressShort?: string;
}): Promise<{ activityId: string } | null> {
  const AK = await loadActivityKit();
  if (!AK) {
    await remoteLog('LA_START_SKIPPED_EXPOGO', params);
    return null;
  }

  const available = await isLiveActivityAvailable();
  if (!available) {
    await remoteLog('LA_START_UNAVAILABLE', params);
    return null;
  }

  try {
    const attributes = { storeName: 'Expolicores' } as any;
    const initialState: LiveActivityState = {
      orderId: params.orderId,
      status: 'CREADO',
      totalCOP: params.totalCOP,
      addressShort: params.addressShort,
    };

    await remoteLog('LA_START_ATTEMPT', { orderId: params.orderId });

    // Soporta ambas firmas:
    // - startActivity({ attributes, contentState, pushType })
    // - startActivity(attributes, contentState)
    let started:
      | { activityId: string; pushToken?: string }
      | { id: string; token?: string }
      | undefined;

    if (typeof AK.startActivity === 'function' && AK.startActivity.length <= 1) {
      // Firma por objeto
      started = await AK.startActivity({
        attributes,
        contentState: initialState,
        pushType: 'liveactivity',
      });
    } else {
      // Firma por parámetros (attributes, contentState)
      started = await AK.startActivity(attributes, initialState);
    }

    const activityId = (started as any)?.activityId ?? (started as any)?.id;
    const pushToken = (started as any)?.pushToken ?? (started as any)?.token;

    currentActivityId = activityId ?? null;

    await remoteLog('LA_STARTED', { orderId: params.orderId, activityId });

    // Registrar en backend el pushToken único de la Live Activity (si lo hay)
    if (activityId && pushToken) {
      try {
        await api.post('/live-activities/register', {
          orderId: params.orderId,
          activityId,
          pushToken,
        });
        await remoteLog('LA_REGISTER_OK', { orderId: params.orderId, activityId });
      } catch (e) {
        await remoteLog('LA_REGISTER_ERROR', {
          orderId: params.orderId,
          activityId,
          error: (e as Error)?.message,
        });
      }
    } else {
      await remoteLog('LA_NO_TOKEN_OR_ID', { orderId: params.orderId });
    }

    return activityId ? { activityId } : null;
  } catch (e) {
    console.warn('[LiveActivity] start error', e);
    await remoteLog('LA_START_ERROR', {
      orderId: params.orderId,
      error: (e as Error)?.message,
    });
    return null;
  }
}

/**
 * Actualiza el estado local de la Live Activity (útil cuando la app está activa).
 * Las actualizaciones oficiales seguirán llegando por APNs desde el backend.
 */
export async function updateOrderActivity(patch: Partial<LiveActivityState>): Promise<void> {
  const AK = await loadActivityKit();
  if (!AK) {
    await remoteLog('LA_UPDATE_SKIPPED_EXPOGO', { patch });
    return;
  }
  if (!currentActivityId) return;

  try {
    // Soporta ambas firmas:
    if (typeof AK.updateActivity === 'function' && AK.updateActivity.length <= 1) {
      await AK.updateActivity({ activityId: currentActivityId, contentState: patch });
    } else {
      await AK.updateActivity(currentActivityId, patch);
    }
    await remoteLog('LA_UPDATED', { activityId: currentActivityId, patch });
  } catch (e) {
    console.warn('[LiveActivity] update error', e);
    await remoteLog('LA_UPDATE_ERROR', {
      activityId: currentActivityId,
      error: (e as Error)?.message,
    });
  }
}

/**
 * Termina la Live Activity (ej. al entregarse/cancelarse el pedido).
 */
export async function endOrderActivity(finalState?: Partial<LiveActivityState>): Promise<void> {
  const AK = await loadActivityKit();
  if (!AK) {
    await remoteLog('LA_END_SKIPPED_EXPOGO', { finalState });
    return;
  }
  if (!currentActivityId) return;

  try {
    // Soporta ambas firmas:
    if (typeof AK.endActivity === 'function' && AK.endActivity.length <= 1) {
      await AK.endActivity({ activityId: currentActivityId, contentState: finalState ?? {} });
    } else {
      await AK.endActivity(currentActivityId, finalState ?? {});
    }
    await remoteLog('LA_ENDED', { activityId: currentActivityId, finalState });
  } catch (e) {
    console.warn('[LiveActivity] end error', e);
    await remoteLog('LA_END_ERROR', {
      activityId: currentActivityId,
      error: (e as Error)?.message,
    });
  } finally {
    currentActivityId = null;
  }
}
