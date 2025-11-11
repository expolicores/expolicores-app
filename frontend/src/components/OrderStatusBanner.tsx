// Banner simple que muestra el último pedido y la moto 🛵 cuando va EN_CAMINO.
// Usa ORDER_STATUS (constantes en runtime) para evitar errores de enum.

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useActiveOrder } from '../hooks/useActiveOrder';
import type { RootStackScreenProps } from '../navigation/types';
import type { OrderStatus } from '../types/order';
import { ORDER_STATUS } from '../types/order';
import { formatCOP } from '../lib/formatCurrency';

type Props = {
  showDeliveredWindowMin?: number;
  hideWhenNone?: boolean;
};

const STEP_LABELS: Record<OrderStatus, string> = {
  RECIBIDO: 'Recibido',
  EN_CAMINO: 'En camino',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
};

export const OrderStatusBanner: React.FC<Props> = ({
  showDeliveredWindowMin = 15,
  hideWhenNone = true,
}) => {
  const nav = useNavigation<RootStackScreenProps<'Catalog'>['navigation']>();
  const { order, refetch } = useActiveOrder({ showDeliveredWindowMin });

  const visible = useMemo(() => !!order, [order]);
  if (!visible && hideWhenNone) return null;

  if (!order) {
    return (
      <View style={[styles.container, styles.skeleton]}>
        <Text style={styles.skeletonText}>Revisando tu último pedido…</Text>
      </View>
    );
  }

  const isOnTheWay = order.status === ORDER_STATUS.EN_CAMINO;
  const isReceived = order.status === ORDER_STATUS.RECIBIDO;
  const isDelivered = order.status === ORDER_STATUS.ENTREGADO;

  const title = isOnTheWay
    ? `¡Tu pedido #${order.id} va en camino!`
    : isReceived
    ? `Pedido #${order.id} recibido`
    : isDelivered
    ? `Pedido #${order.id} entregado`
    : `Pedido #${order.id}`;

  const subtitleParts: string[] = [];
  if (order.total != null) subtitleParts.push(formatCOP(order.total));
  if (order.updatedAt) {
    // “Actualizado hh:mm” simple (sin dependencias)
    const d = new Date(order.updatedAt);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    subtitleParts.push(`actualizado ${hh}:${mm}`);
  }

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => nav.navigate('OrderTracking', { orderId: order.id })}
      onLongPress={refetch}
      style={[
        styles.container,
        isOnTheWay ? styles.onTheWay : isDelivered ? styles.delivered : styles.received,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Estado del pedido ${order.id}: ${STEP_LABELS[order.status]}`}
    >
      <View style={styles.leftIconBox}>
        {isOnTheWay ? (
          <MaterialCommunityIcons name="motorbike" size={24} color="#fff" />
        ) : isDelivered ? (
          <MaterialCommunityIcons name="check-circle" size={24} color="#fff" />
        ) : (
          <MaterialCommunityIcons name="clipboard-text-clock" size={24} color="#fff" />
        )}
      </View>

      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {!!subtitleParts.length && (
          <Text style={styles.subtitle} numberOfLines={1}>{subtitleParts.join(' · ')}</Text>
        )}
      </View>

      <View style={styles.cta}>
        <Text style={styles.ctaText}>Ver pedido</Text>
        <MaterialCommunityIcons name="chevron-right" size={22} color="#fff" />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: '#222',
  },
  leftIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  content: { flex: 1 },
  title: { color: '#fff', fontWeight: '700', fontSize: 15 },
  subtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },
  cta: { flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
  ctaText: { color: '#fff', fontWeight: '600', marginRight: 2 },
  onTheWay: { backgroundColor: '#0ea5e9' }, // EN_CAMINO
  received: { backgroundColor: '#6b7280' }, // RECIBIDO
  delivered: { backgroundColor: '#10b981' }, // ENTREGADO
  skeleton: { backgroundColor: '#374151' },
  skeletonText: { color: '#d1d5db', fontSize: 13 },
});

export default OrderStatusBanner;
