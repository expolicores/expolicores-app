// frontend/src/screens/OrderSuccessScreen.tsx
import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Linking, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useNotifications } from '../context/NotificationsContext';
import { presentLocalNotification } from '../lib/notifications';
import { startOrderActivity } from '../lib/liveActivity';

export default function OrderSuccessScreen() {
  const { params } = useRoute<any>();
  const navigation = useNavigation<any>();
  const { status, ensurePermission } = useNotifications();

  const orderId: number | undefined = params?.orderId;
  const rawTotal = typeof params?.total === 'number' ? params.total : 0;
  const rawShipping = typeof params?.shipping === 'number' ? params.shipping : undefined;
  const rawSubtotal = typeof params?.subtotal === 'number' ? params.subtotal : undefined;

  const subtotal: number =
    rawSubtotal ?? (rawShipping !== undefined ? Math.max(rawTotal - rawShipping, 0) : rawTotal);
  const shipping: number =
    rawShipping ?? (rawSubtotal !== undefined ? Math.max(rawTotal - rawSubtotal, 0) : 0);
  const total: number = rawTotal || subtotal + shipping;
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value || 0);

  // Evita iniciar la Live Activity más de una vez
  const startedLiveActivityRef = useRef(false);

  // Soft-ask de notificaciones: solo si aún no está concedido
  useEffect(() => {
    if (status === 'unknown' || status === 'denied') {
      Alert.alert(
        'Sigue tu pedido',
        'Activa notificaciones para saber cuando esté en preparación y en camino.',
        [
          { text: 'Luego' },
          { text: 'Activar', onPress: () => { void ensurePermission(); } },
        ]
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // una sola vez al entrar a esta pantalla

  // Inicia la Live Activity (iOS 16.2+) y registra el pushToken en backend
  useEffect(() => {
    if (!orderId) return;
    if (startedLiveActivityRef.current) return;
    startedLiveActivityRef.current = true;

    // addressShort puede venir en params si lo pasas desde Checkout
    const addressShort: string | undefined =
      params?.addressShort || params?.address?.short || undefined;

    void startOrderActivity({
      orderId,
      totalCOP: total,
      addressShort,
    });
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

      {/* Botón de prueba de notificación local (solo en desarrollo) */}
      {__DEV__ && (
        <TouchableOpacity
          onPress={() => presentLocalNotification('Expolicores', 'Prueba local OK')}
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
