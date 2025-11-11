import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, Text, ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { api } from '../lib/api';
import type { Order } from '../types/order';
import { ORDER_STATUS } from '../types/order';

type RouteParams = { orderId: number };

export default function OrderTrackingScreen() {
  // Hooks al tope (nunca condicionales)
  const route = useRoute<any>();
  const navigation = useNavigation();
  const orderId = Number(route?.params?.orderId) || 0;

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<Order | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const fetchOrder = useCallback(async () => {
    if (!orderId) return;
    try {
      setLoading(true);
      const res = await api.get(`/orders/${orderId}`);
      setOrder(res.data as Order);
    } catch (e) {
      // Error suave; mantén el último estado
      // console.warn('[OrderTracking] fetch error', e);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    // Primer fetch + polling
    fetchOrder();
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(fetchOrder, 10000); // 10s
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchOrder]);

  // Derivados memorizados (no hooks condicionales)
  const statusText = useMemo(() => {
    if (!order) return '';
    switch (order.status) {
      case ORDER_STATUS.RECIBIDO:
        return 'Recibido';
      case ORDER_STATUS.EN_CAMINO:
        return 'En camino';
      case ORDER_STATUS.ENTREGADO:
        return 'Entregado';
      case ORDER_STATUS.CANCELADO:
        return 'Cancelado';
      default:
        return String(order.status);
    }
  }, [order]);

  const badgeStyle = useMemo(() => {
    switch (order?.status) {
      case ORDER_STATUS.EN_CAMINO:
        return styles.badgeSky;
      case ORDER_STATUS.ENTREGADO:
        return styles.badgeGreen;
      case ORDER_STATUS.CANCELADO:
        return styles.badgeRed;
      case ORDER_STATUS.RECIBIDO:
      default:
        return styles.badgeGray;
    }
  }, [order?.status]);

  // ===== A partir de aquí, render condicional (ya se invocaron todos los hooks) =====

  if (!orderId) {
    return (
      <Centered>
        <Text>Pedido no válido</Text>
      </Centered>
    );
  }

  if (loading && !order) {
    return (
      <Centered>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Cargando pedido #{orderId}…</Text>
      </Centered>
    );
  }

  if (!order) {
    return (
      <Centered>
        <Text>No se encontró el pedido #{orderId}</Text>
      </Centered>
    );
  }

  // Render normal
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>Pedido #{order.id}</Text>

      <View style={[styles.badge, badgeStyle]}>
        <Text style={styles.badgeText}>{statusText}</Text>
      </View>

      {/* Aquí puedes colocar el detalle de items, dirección, tracking, etc. */}
      {/* ... */}
    </ScrollView>
  );
}

/** Pequeño contenedor centrado para estados vacíos/carga */
function Centered({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.centered}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  h1: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 8 },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },

  // Badges de estado
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  badgeText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  badgeSky: { backgroundColor: '#0ea5e9' },   // EN_CAMINO
  badgeGreen: { backgroundColor: '#10b981' }, // ENTREGADO
  badgeGray: { backgroundColor: '#6b7280' },  // RECIBIDO (default)
  badgeRed: { backgroundColor: '#ef4444' },   // CANCELADO
});
