// src/lib/liveActivities.ts
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { api } from './api';

/**
 * ⚠️ No importes ActivityKit arriba.
 * En Expo Go no existe el módulo nativo y crashea.
 * Lo cargamos dinámicamente SOLO en runtime nativo (TestFlight / EAS Dev Client).
 */

type PromotionOnlyAny = any; // para tipar rápido sin traer types del paquete

// ===== Tipos expuestos =====
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

// ===== Helpers internos =====
function isNativeActivityKitRuntime(): boolean {
  // 'standalone' → TestFlight/App Store
  // 'guest'      → EAS Dev Build (dev client)
  // 'expo'       → Expo Go (NO soporta módulos nativos custom)
  const owner = Constants.appOwnership;
  const isNativeContainer = owner === 'standalone' || owner === 'guest';
  return Platform.OS === 'ios' && isNativeContainer;
}

async function getActivityKit(): Promise<PromotionOnlyAny | undefined> {
  if (!isNativeActivityKitRuntime()) return undefined;
  try {
    const mod = await import('@kingstinct/react-native-activity-kit');
    return mod;
  } catch (e) {
    console.warn('[LiveActivity] ActivityKit no disponible:', e);
    return undefined;
  }
}

// ===== API pública =====

/**
 * Verifica si Live Activities está disponible (iOS nativo + permisos).
 * En Expo Go siempre devuelve false (evita crash).
 */
export async function isLiveActivityAvailable(): Promise<boolean> {
  const ActivityKit = await getActivityKit();
  if (!ActivityKit) return false;

  try {
    const available = await ActivityKit.ActivityKit.isAvailable();
    if (!available) return false;

    const auth = await ActivityKit.ActivityKit.getAuthorizationStatus();
    // ActivityAuthorizationStatus.denied === 2 en lib actual; evitamos importar el enum
    return auth !== 2;
  } catch (e) {
    console.warn('[LiveActivity] isAvailable/getAuthorizationStatus error:', e);
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
  const ActivityKit = await getActivityKit();
  if (!ActivityKit) return null;
  if (!(await isLiveActivityAvailable())) return null;

  try {
    const attributes = { storeName: 'Expolicores' } as any;
    const initialState: LiveActivityState = {
      orderId: params.orderId,
      status: 'CREADO',
      totalCOP: params.totalCOP,
      addressShort: params.addressShort,
    };

    const { activityId, pushToken } = await ActivityKit.ActivityKit.startActivity(
      attributes,
      initialState
    );

    currentActivityId = activityId;

    // Registrar en backend el pushToken único de la Live Activity
    try {
      await api.post('/live-activities/register', {
        orderId: params.orderId,
        activityId,
        pushToken,
      });
    } catch (e) {
      console.warn('[LiveActivity] register token error (no bloquea):', e);
    }

    return { activityId };
  } catch (e) {
    console.warn('[LiveActivity] start error', e);
    return null;
  }
}

/**
 * Actualiza el estado local de la Live Activity (útil cuando la app está activa).
 * Las actualizaciones oficiales seguirán llegando por APNs desde el backend.
 */
export async function updateOrderActivity(
  patch: Partial<LiveActivityState>
): Promise<void> {
  const ActivityKit = await getActivityKit();
  if (!ActivityKit) return;
  if (!currentActivityId) return;

  try {
    await ActivityKit.ActivityKit.updateActivity(currentActivityId, patch);
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
  const ActivityKit = await getActivityKit();
  if (!ActivityKit) return;
  if (!currentActivityId) return;

  try {
    await ActivityKit.ActivityKit.endActivity(currentActivityId, finalState ?? {});
  } catch (e) {
    console.warn('[LiveActivity] end error', e);
  } finally {
    currentActivityId = null;
  }
}
