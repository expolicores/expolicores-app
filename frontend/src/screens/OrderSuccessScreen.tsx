// frontend/src/screens/OrderSuccessScreen.tsx
import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Linking, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';

import { useNotifications } from '../context/NotificationsContext';
import { presentLocalNotification } from '../lib/notifications';
import { api } from '../lib/api';

// Live Activities (pausadas): mantenemos la fachada pero la gateamos por flag
import { useLiveActivity } from '../hooks/useLiveActivity';
import { logClient } from '../lib/liveActivityProvider';

// Banner in-app (reemplazo de Live Activities)
import { OrderStatusBanner } from '../components/OrderStatusBanner';

type RouteParams = {
  orderId?: number;
  total?: number;
  shipping?: number;
  subtotal?: number;
  addressShort?: string;
  address?: { short?: string };
};

// Feature flags
const FEATURE_INAPP_ORDER_BANNER =
  process.env.EXPO_PUBLIC_FEATURE_INAPP_ORDER_BANNER !== 'false';
const FEATURE_LIVE_ACTIVITIES =
  process.env.EXPO_PUBLIC_FEATURE_LIVE_ACTIVITIES === 'true';

export default function OrderSuccessScreen() {
  const { params } = useRoute<any>();
  const navigation = useNavigation<any>();
  const { status, ensurePermission } = useNotifications();

  const p: RouteParams = params ?? {};
  const orderId: number | undefined =
    typeof p.orderId === 'number' ? p.orderId : undefined;

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
  const startedRef = useRef(false);

  // useLiveActivity (fachada) — solo se iniciará si el flag lo permite
  const la = useLiveActivity(orderId ?? 0, orderId ? String(orderId) : undefined);

  // ===== Monteo de pantalla (debug visible) =====
  useEffect(() => {
    const providerRaw = process.env.EXPO_PUBLIC_LA_PROVIDER ?? 'none';
    const providerNorm = providerRaw.trim().toLowerCase();
    console.log('[LA][ORDER_SUCCESS] mounted', {
      providerRaw,
      providerNorm,
      orderId,
      FEATURE_LIVE_ACTIVITIES,
    });
  }, [orderId]);

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

  // ===== Live Activities (PAUSADAS): gate por flag; si está OFF, no hace nada =====
  useEffect(() => {
    if (!FEATURE_LIVE_ACTIVITIES) return;         // <-- pausado por decisión de producto
    if (!orderId) return;
    if (startedRef.current) return;
    startedRef.current = true;

    (async () => {
      try {
        const providerRaw = process.env.EXPO_PUBLIC_LA_PROVIDER ?? 'none';
        const providerNorm = providerRaw.trim().toLowerCase();
        await logClient('LA/BEGIN', { orderId, provider: providerNorm });

        // Iniciar Live Activity (ETA inicial opcional)
        const res = await la.start(45);

        if (!res) {
          await logClient('LA/UNAVAILABLE', { reason: 'no-provider-or-ios-version-or-devclient' });
          // Fallback local como feedback inmediato (se mantiene aunque el feature esté pausado)
          await presentLocalNotification(
            'Seguimiento de pedido',
            `Tu pedido #${orderId} está en preparación`,
            { data: { orderId } }
          );
          return;
        }

        // Registrar en backend para updates por APNs (si pushToken existe)
        await api.post('/live-activities/register', {
          orderId,
          activityId: res.activityId,
          apnsToken: res.pushToken,
          addressShort: p.addressShort || p.address?.short || undefined,
          totalCOP: total,
        });
        await logClient('LA/REGISTER_OK', {
          orderId,
          activityId: res.activityId,
          hasPushToken: !!res.pushToken,
        });
      } catch (err: any) {
        await logClient('LA/ERR', {
          orderId,
          message: String(err?.message ?? err),
        });
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
    <View style={{ flex: 1, padding: 24 }}>
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
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

      {/* Banner in-app de estado del pedido (sustituto de Live Activities) */}
      {FEATURE_INAPP_ORDER_BANNER && (
        <View style={{ marginTop: 16 }}>
          {/* Mantenemos una ventana un poco más amplia para OrderSuccess */}
          <OrderStatusBanner showDeliveredWindowMin={30} />
        </View>
      )}
    </View>
  );
}
