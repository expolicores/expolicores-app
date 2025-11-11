// =============================
// File: src/components/OrderStatusBanner.tsx
// Desc: Banner compacto que muestra el último pedido activo (CREATED/EN_CAMINO)
//       y opcionalmente ENTREGADO reciente. Ícono de motocicleta cuando EN_CAMINO.
// =============================
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import es from 'date-fns/locale/es';
import { useActiveOrder } from '../hooks/useActiveOrder';
import { formatCOP } from '../lib/formatCurrency';
import type { RootStackScreenProps } from '../navigation/types';
import { OrderStatus } from '../types/order';

export type OrderStatusBannerProps = {
  /** Muestra ENTREGADO si fue recientemente entregado (ventana en minutos) */
  showDeliveredWindowMin?: number;
  /** Ocultar si no hay pedido activo */
  hideWhenNone?: boolean;
};

export const OrderStatusBanner: React.FC<OrderStatusBannerProps> = ({
  showDeliveredWindowMin = 15,
  hideWhenNone = true,
}) => {
  const nav = useNavigation<RootStackScreenProps<'Catalog'>['navigation']>();
  const { order, loading, refetch } = useActiveOrder({ showDeliveredWindowMin });

  const visible = useMemo(() => !!order, [order]);
  if (!visible && hideWhenNone) return null;

  if (!order) {
    // Placeholder mínimo para evitar saltos de layout cuando se decida mostrar skeleton
    return (
      <View style={[styles.container, styles.skeleton]}>
        <Text style={styles.skeletonText}>Revisando tu último pedido…</Text>
      </View>
    );
  }

  const isOnTheWay = order.status === OrderStatus.EN_CAMINO;
  const isCreated = order.status === OrderStatus.CREATED;
  const isDelivered = order.status === OrderStatus.ENTREGADO;

  const title = isOnTheWay
    ? `¡Tu pedido #${order.id} va en camino!`
    : isCreated
    ? `Pedido #${order.id} recibido`
    : isDelivered
    ? `Pedido #${order.id} entregado`
    : `Pedido #${order.id}`;

  const subtitleParts: string[] = [];
  if (order.totalAmount != null) subtitleParts.push(formatCOP(order.totalAmount));
  if (order.updatedAt) {
    try {
      subtitleParts.push(
        `${isDelivered ? 'hace' : 'actualizado'} ${formatDistanceToNow(new Date(order.updatedAt), { addSuffix: false, locale: es })}`
      );
    } catch {}
  }

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => nav.navigate('OrderTracking', { orderId: order.id })}
      onLongPress={refetch}
      style={[
        styles.container,
        isOnTheWay ? styles.onTheWay : isDelivered ? styles.delivered : styles.created,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Estado del pedido ${order.id}: ${order.status}`}
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
  onTheWay: { backgroundColor: '#0ea5e9' }, // sky-500
  created: { backgroundColor: '#6b7280' }, // gray-500
  delivered: { backgroundColor: '#10b981' }, // emerald-500
  skeleton: { backgroundColor: '#374151' },
  skeletonText: { color: '#d1d5db', fontSize: 13 },
});

export default OrderStatusBanner;
