// =============================
// File: src/components/OrderProgressBanner.tsx
// Desc: Banner de progreso del pedido con 3 hitos (Recibido → En camino → Entregado)
//       La moto se anima según el estado. Toca para ir al tracking.
//       FIX: no hay hooks condicionales; useRef se llama SIEMPRE.
// =============================
import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useActiveOrder } from '../hooks/useActiveOrder';
import type { OrderStatus } from '../types/order';
import { ORDER_STATUS } from '../types/order';
import type { RootStackScreenProps } from '../navigation/types';

type Props = {
  /** Mostrar ENTREGADO por X min después de completado. 0 para ocultar al instante. */
  showDeliveredWindowMin?: number;
  /** Compactar tipografía si quieres hacerlo más pequeño */
  compact?: boolean;
};

const STEP_LABELS: Record<OrderStatus, string> = {
  RECIBIDO: 'Recibido',
  EN_CAMINO: 'En camino',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
};

const stepIndex = (status: OrderStatus) =>
  status === ORDER_STATUS.RECIBIDO ? 0 :
  status === ORDER_STATUS.EN_CAMINO ? 1 :
  status === ORDER_STATUS.ENTREGADO ? 2 : 0;

export const OrderProgressBanner: React.FC<Props> = ({
  showDeliveredWindowMin = 20,
  compact = false,
}) => {
  // Hooks SIEMPRE
  const nav = useNavigation<RootStackScreenProps<'Catalog'>['navigation']>();
  const { order } = useActiveOrder({ showDeliveredWindowMin, pollMs: 12000 });

  // useRef SIEMPRE (FIX principal)
  const prog = useRef(new Animated.Value(0)).current;

  // Derivados memorizados (se llaman SIEMPRE; toleran order null)
  const targetProgress = useMemo(() => {
    if (!order) return 0; // punto inicial a la izquierda
    if (order.status === ORDER_STATUS.RECIBIDO) return 0;
    if (order.status === ORDER_STATUS.EN_CAMINO) return 0.5;
    return 1; // ENTREGADO (o lo demás)
  }, [order]);

  const badgeStyle = useMemo(() => {
    const st = order?.status;
    if (st === ORDER_STATUS.EN_CAMINO) return styles.badgeSky;
    if (st === ORDER_STATUS.ENTREGADO) return styles.badgeGreen;
    if (st === ORDER_STATUS.CANCELADO) return styles.badgeRed;
    return styles.badgeGray; // default/RECIBIDO/null
  }, [order?.status]);

  const title = useMemo(() => {
    if (!order) return '';
    if (order.status === ORDER_STATUS.RECIBIDO) return `Pedido #${order.id} recibido`;
    if (order.status === ORDER_STATUS.EN_CAMINO) return `¡Tu pedido #${order.id} va en camino!`;
    if (order.status === ORDER_STATUS.ENTREGADO) return `Pedido #${order.id} entregado`;
    if (order.status === ORDER_STATUS.CANCELADO) return `Pedido #${order.id} cancelado`;
    return `Pedido #${order.id}`;
  }, [order]);

  // Animación SIEMPRE montada (si no hay order, anima hacia 0)
  useEffect(() => {
    Animated.timing(prog, {
      toValue: targetProgress,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // left/width no soporta nativo
    }).start();
  }, [prog, targetProgress]);

  const motoLeft = prog.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  // A PARTIR DE AQUÍ podemos condicionar el render
  if (!order) return null;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => nav.navigate('OrderTracking', { orderId: order.id })}
      style={styles.container}
      accessibilityRole="button"
      accessibilityLabel={`Estado del pedido ${order.id}: ${STEP_LABELS[order.status]}`}
    >
      {/* Encabezado */}
      <View style={styles.headerRow}>
        <Text style={[styles.title, compact && { fontSize: 14 }]} numberOfLines={1}>
          {title}
        </Text>
        <View style={[styles.badge, badgeStyle]}>
          <Text style={styles.badgeText}>{STEP_LABELS[order.status]}</Text>
        </View>
      </View>

      {/* Pista + moto */}
      <View style={styles.trackBox}>
        <View style={styles.trackLine} />
        <View style={styles.trackSteps}>
          {[0, 1, 2].map((i) => {
            const done = i <= stepIndex(order.status);
            return (
              <View key={i} style={styles.stepDotWrap}>
                <View style={[styles.stepDot, done ? styles.stepDone : styles.stepPending]} />
              </View>
            );
          })}
        </View>
        <Animated.View style={[styles.moto, { left: motoLeft }]}>
          <MaterialCommunityIcons name="motorbike" size={22} color="#0f172a" />
        </Animated.View>
      </View>

      {/* Etiquetas de pasos */}
      <View style={styles.labelsRow}>
        <Text style={[styles.stepLabel, compact && { fontSize: 11 }]}>Recibido</Text>
        <Text style={[styles.stepLabelCenter, compact && { fontSize: 11 }]}>En camino</Text>
        <Text style={[styles.stepLabelRight, compact && { fontSize: 11 }]}>Entregado</Text>
      </View>

      {/* CTA */}
      <View style={styles.ctaRow}>
        <Text style={styles.ctaText}>Ver estado</Text>
        <MaterialCommunityIcons name="chevron-right" size={18} color="#0ea5e9" />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  badgeSky: { backgroundColor: '#0ea5e9' },   // EN_CAMINO
  badgeGreen: { backgroundColor: '#10b981' }, // ENTREGADO
  badgeGray: { backgroundColor: '#6b7280' },  // RECIBIDO / default
  badgeRed: { backgroundColor: '#ef4444' },   // CANCELADO

  trackBox: { marginTop: 12, height: 32, justifyContent: 'center' },
  trackLine: {
    position: 'absolute',
    left: 6,
    right: 6,
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 999,
  },
  trackSteps: {
    position: 'absolute',
    left: 0, right: 0, flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    alignItems: 'center',
  },
  stepDotWrap: { width: '33.3333%', alignItems: 'center' },
  stepDot: { width: 10, height: 10, borderRadius: 999, borderWidth: 2 },
  stepDone: { backgroundColor: '#0ea5e9', borderColor: '#0ea5e9' },
  stepPending: { backgroundColor: '#fff', borderColor: '#cbd5e1' },

  moto: {
    position: 'absolute',
    transform: [{ translateX: -10 }], // centrar icono
    backgroundColor: '#bae6fd',
    width: 28, height: 28, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
    borderColor: '#38bdf8', borderWidth: 1,
  },

  labelsRow: { marginTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  stepLabel: { fontSize: 12, color: '#64748b' },
  stepLabelCenter: { fontSize: 12, color: '#64748b', textAlign: 'center' },
  stepLabelRight: { fontSize: 12, color: '#64748b', textAlign: 'right' },

  ctaRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#ecfeff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderColor: '#a5f3fc',
    borderWidth: 1,
  },
  ctaText: { fontSize: 12, fontWeight: '700', color: '#0ea5e9', marginRight: 4 },
});

export default OrderProgressBanner;
