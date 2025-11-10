// frontend/src/screens/OrderSuccessScreen.tsx
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Linking,
  Alert,
  Platform,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

import { useNotifications } from '../context/NotificationsContext';
import { presentLocalNotification } from '../lib/notifications';
import { api } from '../lib/api';

type RouteParams = {
  orderId?: number;
  total?: number;
  shipping?: number;
  subtotal?: number;
  addressShort?: string;
  address?: { short?: string };
};

export default function OrderSuccessScreen() {
  const { params } = useRoute<any>();
  const navigation = useNavigation<any>();
  const { status, ensurePermission } = useNotifications();

  const p: RouteParams = params ?? {};
  const orderId: number | undefined = typeof p.orderId === 'number' ? p.orderId : undefined;

  // Totales
  const rawTotal = typeof p.total === 'number' ? p.total : 0;
  const rawShipping = typeof p.shipping === 'number' ? p.shipping : undefined;
  const rawSubtotal = typeof p.subtotal === 'number' ? p.subtotal : undefined;

  const subtotal: number =
    rawSubtotal ?? (rawShipping !== undefined ? Math.max(rawTotal - rawShipping, 0) : rawTotal);
  const shipping: number =
    rawShipping ?? (rawSubtotal !== undefined ? Math.max(rawTotal - rawSubtotal, 0) : 0);
  const total: number = rawTotal || subtotal + shipping;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value || 0);

  // Evitar doble inicio de Live Activity
  const startedLiveActivityRef = useRef(false);
  const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

  // ===== Helpers de entorno / guards =====
  const isExpoGo = Constants.executionEnvironment === 'storeClient';
  const isiOS = Platform.OS === 'ios';
  const isRealDevice = Device.isDevice === true;

  const getIOSVersion = (): number => {
    // Puede venir como "16.5.1" o número; tomamos major.minor
    const v = Platform.Version as string | number;
    if (typeof v === 'number') return v; // iOS 16 -> 16
    const [maj, min] = (v ?? '0').toString().split('.').map(n => parseInt(n, 10));
    return (maj || 0) + ((min || 0) / 10);
  };
  const iOSVersionOK = isiOS ? getIOSVersion() >= 16.2 : false;

  // ===== Soft-ask de notificaciones =====
  useEffect(() => {
    if (status === 'unknown' || status === 'denied') {
      Alert.alert(
        'Sigue tu pedido',
        'Activa notificaciones para saber cuando esté en preparación y en camino.',
        [
          { text: 'Luego' },
          { text: 'Activar', onPress: () => { void ensurePermission(); } },
        ],
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== Live Activities: guard + import dinámico =====
  useEffect(() => {
    if (!orderId) return;
    if (startedLiveActivityRef.current) return;
    startedLiveActivityRef.current = true;

    const ctxBase = {
      scope: 'LA',
      orderId,
      platform: Platform.OS,
      isDevice: isRealDevice,
      isExpoGo,
      rnVersion: (global as any).__fbBatchedBridge ? 'new-arch' : 'legacy',
    };

    (async () => {
      try {
        await api.post('/logs/client', { ...ctxBase, step: 'BEGIN' });
        console.log('[LA] BEGIN Live Activity attempt...');

        // Guard 1: solo iOS en dispositivo real
        if (!isiOS || !isRealDevice) {
          await api.post('/logs/client', { ...ctxBase, step: 'SKIP_NOT_IOS_OR_DEVICE' });
          console.log('[LA] SKIP: Not iOS or not a physical device');
          return;
        }

        // Guard 2: versión de iOS mínima
        if (!iOSVersionOK) {
          await api.post('/logs/client', { ...ctxBase, step: 'SKIP_IOS_VERSION', version: Platform.Version });
          console.log('[LA] SKIP: iOS version < 16.2');
          return;
        }

        // Guard 3: Expo Go no soporta ActivityKit
        if (isExpoGo) {
          await api.post('/logs/client', { ...ctxBase, step: 'SKIP_EXPO_GO' });
          console.log('[LA] SKIP: Expo Go environment');
          return;
        }

        // Import dinámico del bridge (Dev Client / TestFlight)
        const mod = await import('@kingstinct/react-native-activity-kit');
        const AK: any = (mod as any).default ?? mod;
        console.log('[LA] NITRO_EXPORTS imported.');

        const {
          startActivity,
          endActivity,
          areActivitiesEnabled,
          pushToken: activityPushToken,
        } = AK as {
          startActivity?: (attrs: any, state: any) => Promise<string>;
          endActivity?: (id: string) => Promise<void>;
          areActivitiesEnabled?: () => Promise<boolean>;
          pushToken?: () => Promise<string>;
        };

        await api.post('/logs/client', {
          ...ctxBase,
          step: 'NITRO_EXPORTS',
          hasStart: !!startActivity,
          hasEnd: !!endActivity,
          hasEnabled: !!areActivitiesEnabled,
          hasPushToken: !!activityPushToken,
        });

        if (!startActivity || !endActivity || !activityPushToken) {
          await api.post('/logs/client', { ...ctxBase, step: 'MISSING_NITRO_FUNCS' });
          console.error('[LA] ERROR: Missing Nitro functions (rebuild Dev Client with the plugin).');
          return;
        }

        // Comprobación de permisos del sistema para Live Activities
        let enabled = false;
        try {
          enabled = !!(await (areActivitiesEnabled?.() ?? Promise.resolve(false)));
        } catch (e: any) {
          await api.post('/logs/client', { ...ctxBase, step: 'CHECK_ENABLED_ERR', message: String(e?.message ?? e) });
        }
        await api.post('/logs/client', { ...ctxBase, step: 'CHECK_ENABLED', enabled });
        console.log(`[LA] CHECK_ENABLED: ${enabled}`);

        // Iniciar Live Activity
        const attributes = { kind: 'order-tracking' };
        const initialState = {
          orderId,
          status: 'CREATED',
          title: 'Pedido recibido',
          subtitle: 'Preparando tu pedido…',
          totalCOP: total,
        };

        let activityId: string;
        try {
          activityId = await startActivity(attributes, initialState);
        } catch (e: any) {
          await api.post('/logs/client', {
            ...ctxBase,
            step: 'START_ERR',
            message: String(e?.message ?? e),
            name: e?.name,
            code: e?.code,
          });
          console.error(`[LA] START_ERR: ${String(e?.message ?? e)}`);
          return;
        }
        await api.post('/logs/client', { ...ctxBase, step: 'START_OK', activityId });
        console.log(`[LA] START_OK id=${activityId}`);

        // Obtener APNs token de la actividad (3 reintentos breves)
        let apnsToken = '';
        for (let i = 0; i < 3 && !apnsToken; i++) {
          try { apnsToken = await activityPushToken(); } catch { /* noop */ }
          if (!apnsToken) await sleep(300);
        }
        await api.post('/logs/client', { ...ctxBase, step: 'PUSH_TOKEN', ok: !!apnsToken });
        console.log(`[LA] PUSH_TOKEN: ${apnsToken ? 'OK' : 'FAIL'}`);

        if (!apnsToken) {
          try { await endActivity(activityId); } catch { /* noop */ }
          await api.post('/logs/client', { ...ctxBase, step: 'ERR_NO_TOKEN' });
          console.error('[LA] ERR: No APNs Token, ending activity.');
          return;
        }

        const addressShort: string | undefined = p.addressShort || p.address?.short || undefined;

        // Registrar en backend para updates por APNs
        await api.post('/live-activities/register', {
          orderId,
          apnsToken,
          activityId,
          addressShort,
          totalCOP: total,
        });
        await api.post('/logs/client', { ...ctxBase, step: 'REGISTER_OK', activityId });
        console.log('[LA] REGISTER_OK. Tracking iniciado.');
      } catch (err: any) {
        await api.post('/logs/client', {
          ...ctxBase,
          step: 'ERR',
          message: String(err?.message ?? err),
          stack: String(err?.stack ?? ''),
        });
        console.error(`[LA] UNHANDLED_ERR: ${String(err?.message ?? err)}`);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, total]);

  const openWhatsApp = async () => {
    const message = encodeURIComponent(`Hola, consulto por mi pedido #${orderId ?? ''}.`);
    const waUrl = `whatsapp://send?text=${message}`;
    const waWeb = `https://wa.me/?text=${message}`;
    try {
      const canOpen = await Linking.canOpenURL('whatsapp://send');
      if (canOpen) await Linking.openURL(waUrl);
      else await Linking.openURL(waWeb);
    } catch {
      Alert.alert('No se pudo abrir WhatsApp', 'Revisa que tengas WhatsApp instalado o intenta de nuevo.');
    }
  };

  // --- UI ---
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Text style={{ fontSize: 20, fontWeight: '800', marginBottom: 8 }}>¡Pedido creado!</Text>
      <Text style={{ marginBottom: 16 }}>Orden #{orderId ?? '—'}</Text>
      <Text style={{ marginBottom: 24, color: '#6b7280', textAlign: 'center' }}>
        Te enviaremos actualizaciones del estado de tu pedido aquí en la app.
      </Text>

      <View
        style={{
          width: '100%',
          backgroundColor: '#fff',
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
          shadowColor: '#000',
          shadowOpacity: 0.05,
          shadowRadius: 8,
          elevation: 1,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={{ color: '#4b5563' }}>Subtotal</Text>
          <Text style={{ fontWeight: '600' }}>{formatCurrency(subtotal)}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={{ color: '#4b5563' }}>Envío</Text>
          <Text style={{ fontWeight: '600' }}>{formatCurrency(shipping)}</Text>
        </View>
        <View style={{ height: 1, backgroundColor: '#e5e7eb', marginVertical: 8 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontWeight: '700' }}>Total</Text>
          <Text style={{ fontWeight: '700' }}>{formatCurrency(total)}</Text>
        </View>
      </View>

      <Text style={{ marginBottom: 8, fontWeight: '600' }}>
        Total pagado: {formatCurrency(total)}
      </Text>

      <TouchableOpacity
        onPress={() => navigation.navigate('MyOrders')}
        style={{
          backgroundColor: '#111827',
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderRadius: 8,
          width: '100%',
          marginTop: 16,
        }}
      >
        <Text style={{ color: 'white', textAlign: 'center', fontWeight: '700' }}>
          Ver mis pedidos
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => ensurePermission()} style={{ marginTop: 12 }}>
        <Text>Forzar registro notificaciones</Text>
      </TouchableOpacity>

      {__DEV__ && (
        <TouchableOpacity
          // Evita el error 'Cannot cast nil' asegurando un objeto data
          onPress={() => presentLocalNotification('Expolicores', 'Prueba local OK', { data: { test: '1' } })}
          style={{ marginTop: 12 }}
        >
          <Text style={{ color: '#0a7' }}>Probar notificación local (DEV)</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        onPress={openWhatsApp}
        style={{
          backgroundColor: '#10b981',
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderRadius: 8,
          width: '100%',
          marginTop: 12,
        }}
      >
        <Text style={{ color: 'white', textAlign: 'center', fontWeight: '700' }}>
          Contactar por WhatsApp
        </Text>
      </TouchableOpacity>
    </View>
  );
}
