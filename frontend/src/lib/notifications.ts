// src/lib/notifications.ts
// ==============================
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export type PushSetupResult = {
  granted: boolean;
  status: Notifications.PermissionStatus;
  token?: string;
  reason?: string;
};

// Handler global: mostrar alerta en foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

function resolveProjectId(): string | undefined {
  // SDKs modernos requieren projectId para getExpoPushTokenAsync en algunas situaciones
  // Lee de app.json -> extra.eas.projectId o de EAS runtime
  // @ts-ignore - campos opcionales según entorno
  return (
    Constants?.expoConfig?.extra?.eas?.projectId ||
    // @ts-ignore
    Constants?.easConfig?.projectId ||
    undefined
  );
}

export async function configureAndroidChannels() {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync('orders', {
      name: 'Pedidos',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  } catch (e) {
    console.warn('[push] No se pudo crear el canal Android:', e);
  }
}

export async function requestPushPermissions(): Promise<PushSetupResult> {
  try {
    if (!Device.isDevice) {
      return { granted: false, status: Notifications.PermissionStatus.DENIED, reason: 'simulator' };
    }

    // 1) Permisos (iOS y Android 13+)
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.warn('[push] Permiso NO concedido');
      return { granted: false, status: finalStatus };
    }

    // 2) Canal Android
    await configureAndroidChannels();

    // 3) Token Expo (requiere projectId en algunos entornos)
    const projectId = resolveProjectId();
    if (!projectId) {
      console.warn('[push] projectId no definido en extra.eas.projectId; intento sin projectId…');
    }

    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const token = tokenData.data;
    if (!token) {
      console.warn('[push] No se obtuvo token de Expo');
      return { granted: true, status: finalStatus, token: undefined, reason: 'no_token' };
    }

    console.log('[push] Expo token:', token);
    return { granted: true, status: finalStatus, token };
  } catch (e: any) {
    console.error('[push] Error solicitando permisos/token:', e?.message ?? e);
    // Intentar retornar estado consistente
    const { status } = await Notifications.getPermissionsAsync();
    return { granted: status === 'granted', status, reason: 'exception' };
  }
}

export function addNotificationListeners(
  onReceive?: (n: Notifications.Notification) => void,
  onRespond?: (r: Notifications.NotificationResponse) => void
) {
  const sub1 = Notifications.addNotificationReceivedListener((n) => onReceive?.(n));
  const sub2 = Notifications.addNotificationResponseReceivedListener((r) => onRespond?.(r));
  return () => {
    sub1.remove();
    sub2.remove();
  };
}
