import { Platform } from 'react-native';
import { api } from './api';

export type LAStatus = 'CREATED' | 'EN_CAMINO' | 'ENTREGADO' | 'CANCELADO';
export type LAState = { status: LAStatus; etaMinutes?: number; orderNumber?: string };
export type LAStartRes = { activityId: string; pushToken?: string } | null;

const provider = process.env.EXPO_PUBLIC_LA_PROVIDER ?? 'expo';

function isiOS162Plus() {
  if (Platform.OS !== 'ios') return false;
  const v = typeof Platform.Version === 'string'
    ? parseFloat(Platform.Version)
    : (Platform.Version as number);
  return v >= 16.1; // start local 16.1; push updates desde 16.2
}

export async function laStart(orderId: number, state: LAState): Promise<LAStartRes> {
  if (!isiOS162Plus()) return null;
  try {
    if (provider === 'expo') {
      const mod = await import('expo-live-activity');
      const { startLiveActivity } = mod as any;
      if (!startLiveActivity) return null;
      const { activityId, pushToken } = await startLiveActivity({
        title: `Pedido #${state.orderNumber ?? orderId}`,
        subtitle: state.status,
        etaMinutes: state.etaMinutes,
      });
      await logClient('LA/START_OK', { provider, activityId });
      return { activityId, pushToken };
    }
    if (provider === 'kingstinct') {
      const AK = await import('@kingstinct/react-native-activity-kit');
      if (!AK?.startActivity) return null;
      const res = await AK.startActivity({
        attributes: { orderId, storeName: 'Expolicores' },
        contentState: {
          status: state.status,
          etaMinutes: state.etaMinutes,
          orderNumber: String(state.orderNumber ?? orderId),
        },
        pushType: 'token',
      });
      if (!res) return null;
      await logClient('LA/START_OK', { provider, activityId: res.activityId });
      return { activityId: res.activityId, pushToken: res.pushToken };
    }
    return null;
  } catch (e) {
    await logClient('LA/START_ERR', { provider, message: String(e) });
    return null;
  }
}

export async function laUpdate(activityId: string, state: LAState) {
  if (!isiOS162Plus()) return;
  try {
    if (provider === 'expo') {
      const { updateLiveActivity } = (await import('expo-live-activity')) as any;
      if (!updateLiveActivity) return;
      await updateLiveActivity(activityId, { subtitle: state.status, etaMinutes: state.etaMinutes });
      await logClient('LA/UPDATE_OK', { provider, activityId, status: state.status });
      return;
    }
    if (provider === 'kingstinct') {
      const AK = await import('@kingstinct/react-native-activity-kit');
      if (!AK?.updateActivity) return;
      await AK.updateActivity(activityId, {
        status: state.status,
        etaMinutes: state.etaMinutes,
        orderNumber: String(state.orderNumber ?? ''),
      });
      await logClient('LA/UPDATE_OK', { provider, activityId, status: state.status });
    }
  } catch (e) {
    await logClient('LA/UPDATE_ERR', { provider, activityId, message: String(e) });
  }
}

export async function laStop(activityId: string) {
  if (!isiOS162Plus()) return;
  try {
    if (provider === 'expo') {
      const { stopLiveActivity } = (await import('expo-live-activity')) as any;
      if (!stopLiveActivity) return;
      await stopLiveActivity(activityId);
      await logClient('LA/END_OK', { provider, activityId });
      return;
    }
    if (provider === 'kingstinct') {
      const AK = await import('@kingstinct/react-native-activity-kit');
      if (!AK?.endActivity) return;
      await AK.endActivity(activityId);
      await logClient('LA/END_OK', { provider, activityId });
    }
  } catch (e) {
    await logClient('LA/END_ERR', { provider, activityId, message: String(e) });
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
    await logClient('LA/REGISTER_OK', { orderId, activityId: res.activityId, hasPushToken: !!res.pushToken });
  } catch (e) {
    await logClient('LA/REGISTER_ERR', { orderId, message: String(e) });
  }
}

export async function logClient(event: string, payload: any = {}) {
  try { await api.post('/logs/client', { event, payload, ts: Date.now() }); } catch {}
}
