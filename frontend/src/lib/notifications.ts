// frontend/src/lib/notifications.ts
// ==================================
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

/** Resultado estándar al pedir permisos / token de push */
export type PushSetupResult = {
  granted: boolean;
  status: Notifications.PermissionStatus;
  token?: string;
  reason?: string;
};

/* ------------------------------------------------------------------ */
/*  Handler global (foreground)                                        */
/*  - iOS modernos: shouldShowBanner / shouldShowList                  */
/*  - Evitamos la clave legacy shouldShowAlert (quita warning)         */
/* ------------------------------------------------------------------ */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/** Obtiene el projectId (necesario para getExpoPushTokenAsync en algunos entornos) */
function resolveProjectId(): string | undefined {
  // Expo SDK 49+ con EAS expone esto en runtime
  // @ts-ignore - campos opcionales según entorno
  return (
    Constants?.expoConfig?.extra?.eas?.projectId ||
    // @ts-ignore - para backwards compat
    Constants?.easConfig?.projectId ||
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
    undefined
  );
}

/** Crea/asegura canales en Android (necesario para mostrar notificaciones) */
export async function configureAndroidChannels() {
  if (Platform.OS !== 'android') return;

  try {
    // Canal por defecto (por si algo no especifica uno)
    await Notifications.setNotificationChannelAsync('default', {
      name: 'General',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
      vibrationPattern: [0, 150, 150, 150],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });

    // Canal de pedidos (alto)
    await Notifications.setNotificationChannelAsync('orders', {
      name: 'Pedidos',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  } catch (e) {
    console.warn('[push] No se pudo crear los canales de Android:', e);
  }
}

/** Solicita permisos de notificación y obtiene token Expo (si aplica) */
export async function requestPushPermissions(): Promise<PushSetupResult> {
  try {
    if (!Device.isDevice) {
      return {
        granted: false,
        status: Notifications.PermissionStatus.DENIED,
        reason: 'simulator',
      };
    }

    // 1) Permisos (iOS y Android 13+)
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowAnnouncements: false,
        },
      });
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.warn('[push] Permiso NO concedido');
      return { granted: false, status: finalStatus };
    }

    // 2) Canales Android
    await configureAndroidChannels();

    // 3) Token Expo
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
    const { status } = await Notifications.getPermissionsAsync();
    return { granted: status === 'granted', status, reason: 'exception' };
  }
}

/** Presenta una notificación local inmediata (para tests/UX) */
export async function presentLocalNotification(
  title: string,
  body: string,
  data?: Record<string, any>
) {
  try {
    // Para Android, si quieres asegurar el canal "orders", usa un trigger con seconds=1 y channelId.
    // En iOS, trigger=null la muestra inmediata.
    const trigger: Notifications.NotificationTriggerInput | null =
      Platform.OS === 'android'
        ? {
            channelId: 'orders',
            seconds: 1,
          }
        : null;

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        // ⚠️ Nunca null/undefined: esto causaba el crash "Cannot cast 'Optional(nil)' ..."
        data: data ?? {},
        sound: 'default',
      },
      trigger,
    });
  } catch (e) {
    console.warn('[local notif] Error enviando notificación local:', e);
  }
}

/** Suscriptores a eventos de notificación (foreground y acciones) */
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

/** Helper conveniente para flujos del front: asegura permiso y token en un paso */
export async function ensurePushPermissionAndToken(): Promise<PushSetupResult> {
  const res = await requestPushPermissions();
  if (!res.granted || !res.token) return res;
  // Aquí podrías registrar el token en tu backend si quieres.
  return res;
}
