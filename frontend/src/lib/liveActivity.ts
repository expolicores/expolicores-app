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
  // executionEnvironment:
  //  - 'storeClient' => Expo Go (NO soporta módulos nativos custom)
  //  - 'bare'        => Dev Client / Standalone (sí soporta)
  const isExpoGo = Constants.executionEnvironment === 'storeClient';
  return Platform.OS === 'ios' && Device.isDevice && !isExpoGo;
}

// Carga dinámica del módulo para evitar crash en Expo Go
async function loadActivityKit(): Promise<any | undefined> {
  if (!isNativeActivityKitRuntime()) return undefined;
  try {
    const mod = await import('@kingstinct/react-native-activity-kit');
    // La API puede venir como export por defecto o nombrado
    const AK = (mod as any).default ?? mod;
    return AK;
  } catch (e) {
    console.warn('[LiveActivity] ActivityKit no disponible:', e);
    return undefined;
  }
}

// Log remoto simple hacia el backend (no bloquea flujo)
async function remoteLog(step: string, data: Record<string, any> = {}) {
  try {
    await api.post('/logs/client', {
      scope: 'LA',
      step,
      ...data,
      ts: Date.now(),
      platform: Platform.OS,
      model: Device.modelName,
      appOwnership: Constants.appOwnership,
      execEnv: Constants.executionEnvironment,
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
 * Nota: si el check falla o no existe en la lib, no confíes en él; se intenta startActivity igualmente.
 */
export async function isLiveActivityAvailable(): Promise<boolean> {
  const AK = await loadActivityKit();
  if (!AK) return false;

  try {
    // Algunas versiones exponen areActivitiesEnabled(), otras usan isAvailable() + getAuthorizationStatus()
    if (typeof AK.areActivitiesEnabled === 'function') {
      return !!(await AK.areActivitiesEnabled());
    }
    if (typeof AK.isAvailable === 'function') {
      const available = await AK.isAvailable();
      if (available === false) return false;
    }
    if (typeof AK.getAuthorizationStatus === 'function') {
      // usualmente 2 = denied
      const auth = await AK.getAuthorizationStatus();
      return auth !== 2;
    }
    // Si no hay checks, asumir disponible y que el startActivity sea la fuente de verdad
    return true;
  } catch (e) {
    console.warn('[LiveActivity] availability check error:', e);
    return true; // dejar que startActivity sea el juez real
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
    await remoteLog('START_SKIPPED_NOT_NATIVE', params);
    return null;
  }

  // Diagnóstico de exports (para detectar builds sin nueva arquitectura)
  await remoteLog('NITRO_EXPORTS', {
    hasStart: typeof AK.startActivity === 'function',
    hasEnabled: typeof AK.areActivitiesEnabled === 'function' || typeof AK.isAvailable === 'function',
    hasPushTokenFn: typeof AK.pushToken === 'function',
    hasUpdate: typeof AK.updateActivity === 'function',
    hasEnd: typeof AK.endActivity === 'function',
  });

  // Check suave (no cortar si da false)
  try {
    const available = await isLiveActivityAvailable();
    await remoteLog('CHECK_AVAILABLE', { available });
  } catch {
    // ignorar
  }

  try {
    const attributes = { kind: 'order-tracking', storeName: 'Expolicores' } as any;
    const initialState: LiveActivityState = {
      orderId: params.orderId,
      status: 'CREADO',
      totalCOP: params.totalCOP,
      addressShort: params.addressShort,
    };

    await remoteLog('START_ATTEMPT', { orderId: params.orderId });

    // Soporta ambas firmas:
    // - startActivity({ attributes, contentState, pushType })
    // - startActivity(attributes, contentState)
    let started:
      | { activityId?: string; id?: string; pushToken?: string; token?: string }
      | undefined;

    if (typeof AK.startActivity === 'function' && AK.startActivity.length <= 1) {
      // Firma por objeto
      started = await AK.startActivity({
        attributes,
        contentState: initialState,
        pushType: 'liveactivity',
      });
    } else if (typeof AK.startActivity === 'function') {
      // Firma por parámetros (attributes, contentState)
      started = await AK.startActivity(attributes, initialState);
    } else {
      await remoteLog('START_ERR', { message: 'startActivity undefined' });
      return null;
    }

    const activityId = started?.activityId ?? started?.id ?? null;
    let pushToken = started?.pushToken ?? started?.token ?? '';

    // Si no vino token en start, intentar por función separada
    if (!pushToken && typeof AK.pushToken === 'function') {
      try {
        // pequeños reintentos cortos
        for (let i = 0; i < 3 && !pushToken; i++) {
          pushToken = await AK.pushToken();
          if (!pushToken) await new Promise(r => setTimeout(r, 300));
        }
      } catch {
        // ignorar
      }
    }

    currentActivityId = activityId;

    await remoteLog('START_OK', { orderId: params.orderId, activityId, hasToken: !!pushToken });

    // Registrar en backend el pushToken único de la Live Activity (si lo hay)
    if (activityId && pushToken) {
      try {
        await api.post('/live-activities/register', {
          orderId: params.orderId,
          activityId,
          apnsToken: pushToken,
          addressShort: params.addressShort,
          totalCOP: params.totalCOP,
        });
        await remoteLog('REGISTER_OK', { orderId: params.orderId, activityId });
      } catch (e) {
        await remoteLog('REGISTER_ERROR', {
          orderId: params.orderId,
          activityId,
          error: (e as Error)?.message,
        });
      }
    } else {
      await remoteLog('NO_TOKEN_OR_ID', { orderId: params.orderId, hasId: !!activityId, hasToken: !!pushToken });
    }

    return activityId ? { activityId } : null;
  } catch (e) {
    console.warn('[LiveActivity] start error', e);
    await remoteLog('START_ERROR', {
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
    await remoteLog('UPDATE_SKIPPED_NOT_NATIVE', { patch });
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
    await remoteLog('UPDATED', { activityId: currentActivityId, patch });
  } catch (e) {
    console.warn('[LiveActivity] update error', e);
    await remoteLog('UPDATE_ERROR', {
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
    await remoteLog('END_SKIPPED_NOT_NATIVE', { finalState });
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
    await remoteLog('ENDED', { activityId: currentActivityId, finalState });
  } catch (e) {
    console.warn('[LiveActivity] end error', e);
    await remoteLog('END_ERROR', {
      activityId: currentActivityId,
      error: (e as Error)?.message,
    });
  } finally {
    currentActivityId = null;
  }
}
