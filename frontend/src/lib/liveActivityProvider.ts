// frontend/src/lib/liveActivityProvider.ts
import { Platform } from 'react-native';
import { api } from './api';

export type LAStatus = 'CREATED' | 'EN_CAMINO' | 'ENTREGADO' | 'CANCELADO';
export type LAState = { status: LAStatus; etaMinutes?: number; orderNumber?: string };
export type LAStartRes = { activityId: string; pushToken?: string } | null;

// Normaliza provider desde ENV
type Provider = 'expo' | 'kingstinct' | 'none';
const rawProvider = (process.env.EXPO_PUBLIC_LA_PROVIDER ?? 'expo').trim().toLowerCase();
const provider: Provider = (['expo', 'kingstinct', 'none'] as const).includes(rawProvider as Provider)
  ? (rawProvider as Provider)
  : 'none';

// Helpers de versión iOS
function iosVersion(): number {
  if (Platform.OS !== 'ios') return 0;
  const v =
    typeof Platform.Version === 'string'
      ? parseFloat(Platform.Version)
      : (Platform.Version as number);
  return Number.isNaN(v) ? 0 : v;
}
function supportsStart(): boolean {
  // ActivityKit: start local desde iOS 16.1
  return Platform.OS === 'ios' && iosVersion() >= 16.1;
}
function supportsPushUpdates(): boolean {
  // APNs live-activity updates desde iOS 16.2
  return Platform.OS === 'ios' && iosVersion() >= 16.2;
}

export async function laStart(orderId: number, state: LAState): Promise<LAStartRes> {
  if (!supportsStart()) {
    await logClient('LA/UNAVAILABLE', {
      reason: 'ios-version',
      iosVersion: iosVersion(),
      provider,
    });
    return null;
  }

  // 👇 Añadido: log de BEGIN antes de tocar el módulo
  await logClient('LA/BEGIN', {
    orderId,
    provider,
    iosVersion: iosVersion(),
  });

  try {
    if (provider === 'expo') {
      // 👇 Añadido: probe temporal para verificar funciones expuestas por el módulo
      const mod: any = await import('expo-live-activity');
      // Probes útiles para QA (deja comentados si prefieres)
      // console.log('[LA][probe expo-live-activity] keys=', Object.keys(mod));
      // console.log('[LA][probe expo-live-activity] fns=', {
      //   startLiveActivity: typeof mod.startLiveActivity,
      //   updateLiveActivity: typeof mod.updateLiveActivity,
      //   stopLiveActivity: typeof mod.stopLiveActivity,
      // });

      const { startLiveActivity } = mod;
      if (!startLiveActivity) {
        await logClient('LA/START_ERR', { provider, reason: 'no-startLiveActivity' });
        return null;
      }

      const { activityId, pushToken } = await startLiveActivity({
        title: `Pedido #${state.orderNumber ?? orderId}`,
        subtitle: state.status,
        etaMinutes: state.etaMinutes,
      });

      await logClient('LA/START_OK', {
        provider,
        activityId,
        hasPushToken: !!pushToken,
        supportsPushUpdates: supportsPushUpdates(),
      });

      return { activityId, pushToken };
    }

    if (provider === 'kingstinct') {
      const AK: any = await import('@kingstinct/react-native-activity-kit');
      if (!AK?.startActivity) {
        await logClient('LA/START_ERR', { provider, reason: 'no-startActivity' });
        return null;
      }

      const res = await AK.startActivity({
        attributes: { orderId, storeName: 'Expolicores' },
        contentState: {
          status: state.status,
          etaMinutes: state.etaMinutes,
          orderNumber: String(state.orderNumber ?? orderId),
        },
        pushType: 'token',
      });

      if (!res) {
        await logClient('LA/START_ERR', { provider, reason: 'startActivity-null' });
        return null;
      }

      await logClient('LA/START_OK', {
        provider,
        activityId: res.activityId,
        hasPushToken: !!res.pushToken,
        supportsPushUpdates: supportsPushUpdates(),
      });

      return { activityId: res.activityId, pushToken: res.pushToken };
    }

    // provider === 'none'
    await logClient('LA/UNAVAILABLE', { reason: 'provider-none' });
    return null;
  } catch (e) {
    await logClient('LA/START_ERR', {
      provider,
      message: String((e as Error)?.message ?? e),
    });
    return null;
  }
}

export async function laUpdate(activityId: string, state: LAState) {
  if (!supportsStart()) return;
  try {
    if (provider === 'expo') {
      const { updateLiveActivity }: any = await import('expo-live-activity');
      if (!updateLiveActivity) {
        await logClient('LA/UPDATE_ERR', { provider, activityId, reason: 'no-updateLiveActivity' });
        return;
      }
      await updateLiveActivity(activityId, {
        subtitle: state.status,
        etaMinutes: state.etaMinutes,
      });
      await logClient('LA/UPDATE_OK', { provider, activityId, status: state.status });
      return;
    }
    if (provider === 'kingstinct') {
      const AK: any = await import('@kingstinct/react-native-activity-kit');
      if (!AK?.updateActivity) {
        await logClient('LA/UPDATE_ERR', { provider, activityId, reason: 'no-updateActivity' });
        return;
      }
      await AK.updateActivity(activityId, {
        status: state.status,
        etaMinutes: state.etaMinutes,
        orderNumber: String(state.orderNumber ?? ''),
      });
      await logClient('LA/UPDATE_OK', { provider, activityId, status: state.status });
    }
  } catch (e) {
    await logClient('LA/UPDATE_ERR', {
      provider,
      activityId,
      message: String((e as Error)?.message ?? e),
    });
  }
}

export async function laStop(activityId: string) {
  if (!supportsStart()) return;
  try {
    if (provider === 'expo') {
      const { stopLiveActivity }: any = await import('expo-live-activity');
      if (!stopLiveActivity) {
        await logClient('LA/END_ERR', { provider, activityId, reason: 'no-stopLiveActivity' });
        return;
      }
      await stopLiveActivity(activityId);
      await logClient('LA/END_OK', { provider, activityId });
      return;
    }
    if (provider === 'kingstinct') {
      const AK: any = await import('@kingstinct/react-native-activity-kit');
      if (!AK?.endActivity) {
        await logClient('LA/END_ERR', { provider, activityId, reason: 'no-endActivity' });
        return;
      }
      await AK.endActivity(activityId);
      await logClient('LA/END_OK', { provider, activityId });
    }
  } catch (e) {
    await logClient('LA/END_ERR', {
      provider,
      activityId,
      message: String((e as Error)?.message ?? e),
    });
  }
}

export async function registerLAOnBackend(orderId: number, res: LAStartRes) {
  if (!res?.activityId) return;
  try {
    await api.post('/live-activities/register', {
      orderId,
      activityId: res.activityId,
      apnsToken: res.pushToken,
    });
    await logClient('LA/REGISTER_OK', {
      orderId,
      activityId: res.activityId,
      hasPushToken: !!res.pushToken,
    });
  } catch (e) {
    await logClient('LA/REGISTER_ERR', {
      orderId,
      message: String((e as Error)?.message ?? e),
    });
  }
}

export async function logClient(event: string, payload: any = {}) {
  try {
    await api.post('/logs/client', { event, payload, ts: Date.now() });
  } catch {
    // no-op
  }
}
