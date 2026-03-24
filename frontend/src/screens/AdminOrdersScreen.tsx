import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../context/AuthContext';
import { fetchAllOrders, updateOrderStatus } from '../lib/api';
import { formatCurrency } from '../lib/formatCurrency';
import { statusLabel } from '../lib/orderStatus';
import StatusBadge from '../components/StatusBadge';
import type { AxiosError } from 'axios';
import type { OrderStatus, OrderWithUser, PaymentMethod } from '../types/order';
import { getBottomQuickActionsPadding } from '../components/BottomQuickActionsBar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const STATUS_FLOW: OrderStatus[] = ['RECIBIDO', 'EN_CAMINO', 'ENTREGADO', 'CANCELADO'];

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Efectivo',
  TRANSFER: 'Transferencia',
  CARD: 'Tarjeta',
  CREDIT: 'Crédito',
};

const PAYMENT_COLORS: Record<PaymentMethod, { bg: string; text: string }> = {
  CASH: { bg: '#FEF3C7', text: '#92400E' },
  TRANSFER: { bg: '#DBEAFE', text: '#1D4ED8' },
  CARD: { bg: '#ECFDF5', text: '#065F46' },
  CREDIT: { bg: '#F3E8FF', text: '#6B21A8' },
};

export default function AdminOrdersScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const bottomPadding = getBottomQuickActionsPadding(insets.bottom, { isAdmin });
  const contentPaddingBottom = Math.max(bottomPadding, 16);
  const queryClient = useQueryClient();
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  React.useLayoutEffect(() => {
    navigation.setOptions({ title: 'Pedidos (Admin)' });
  }, [navigation]);

  const {
    data,
    isLoading,
    isRefetching,
    refetch,
    error,
  } = useQuery<OrderWithUser[]>({
    queryKey: ['admin-orders'],
    queryFn: ({ signal }) => fetchAllOrders({}, { signal }),
    enabled: isAdmin,
    staleTime: 5_000,
    retry: 1,
    refetchInterval: (dataOrQuery) => {
      const currentData = Array.isArray(dataOrQuery)
        ? dataOrQuery
        : Array.isArray((dataOrQuery as any)?.state?.data)
          ? (dataOrQuery as any).state.data
          : undefined;

      const hasActive =
        Array.isArray(currentData) &&
        currentData.some(
          (o: OrderWithUser) => o.status === 'RECIBIDO' || o.status === 'EN_CAMINO',
        );

      return hasActive ? 8_000 : false;
    },
    onError: (err) => {
      const axiosErr = err as AxiosError<any>;
      const status = axiosErr?.response?.status;
      const payload = axiosErr?.response?.data;
      console.error('[AdminOrders] fetch error', status, payload ?? axiosErr?.message);

      if (status === 401) {
        Alert.alert('Sesión expirada', 'Vuelve a iniciar sesión.', [
          { text: 'OK', onPress: () => signOut() },
        ]);
      }
    },
  });

  const changeStatus = useMutation({
    mutationFn: ({ orderId, status }: { orderId: number; status: OrderStatus }) =>
      updateOrderStatus(orderId, status),
    onMutate: async ({ orderId, status }) => {
      setUpdatingId(orderId);
      await queryClient.cancelQueries({ queryKey: ['admin-orders'] });

      const previous = queryClient.getQueryData<OrderWithUser[]>(['admin-orders']);

      queryClient.setQueryData<OrderWithUser[]>(['admin-orders'], (old) => {
        if (!old) return old;
        return old.map((order) =>
          order.id === orderId ? { ...order, status, updatedAt: new Date().toISOString() } : order,
        );
      });

      return { previous };
    },
    onError: (err: any, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['admin-orders'], context.previous);
      }

      const message =
        err?.response?.data?.message || err?.message || 'No se pudo actualizar el estado.';
      Alert.alert('Error', String(message));
    },
    onSettled: () => {
      setUpdatingId(null);
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
    },
  });

  const orders = useMemo(() => (data ?? []).slice().sort((a, b) => b.id - a.id), [data]);

  if (!isAdmin) {
    return (
      <View style={[styles.center, styles.container]}>
        <Text style={styles.lockTitle}>Acceso restringido</Text>
        <Text style={styles.lockText}>
          Esta sección solo está disponible para usuarios con rol administrador.
        </Text>
      </View>
    );
  }

  if (isLoading && !data) {
    return (
      <View style={[styles.center, styles.container]}>
        <ActivityIndicator />
        <Text style={styles.muted}>Cargando pedidos...</Text>
      </View>
    );
  }

  if (error) {
    const axiosErr = error as AxiosError<any>;
    const status = axiosErr?.response?.status;
    const raw = axiosErr?.response?.data?.message;
    const serverMessage = raw ? (Array.isArray(raw) ? raw.join(' | ') : String(raw)) : null;

    const friendly =
      status === 403
        ? 'Tu cuenta no tiene permisos para ver los pedidos. Inicia sesión con un administrador.'
        : serverMessage || (error as any).message || 'Intenta nuevamente más tarde.';

    return (
      <View style={[styles.center, styles.container]}>
        <Text style={styles.lockTitle}>No se pudieron cargar los pedidos</Text>
        <Text style={styles.lockText}>{friendly}</Text>
      </View>
    );
  }

  if (orders.length === 0) {
    return (
      <View style={[styles.center, styles.container]}>
        <Text style={styles.lockTitle}>Sin pedidos</Text>
        <Text style={styles.lockText}>Apenas lleguen pedidos aparecerán aquí.</Text>
      </View>
    );
  }

  const confirmChange = (order: OrderWithUser, status: OrderStatus) => {
    if (order.status === status) return;

    Alert.alert('Cambiar estado', `Pasar el pedido #${order.id} a "${statusLabel[status]}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        style: 'destructive',
        onPress: () => changeStatus.mutate({ orderId: order.id, status }),
      },
    ]);
  };

  return (
    <FlatList
      contentContainerStyle={[styles.listContent, { paddingBottom: contentPaddingBottom }]}
      data={orders}
      keyExtractor={(order) => String(order.id)}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      renderItem={({ item }) => {
        const summary = (item.items ?? [])
          .map((i) => `${i.quantity}x ${i.product?.name ?? 'Producto'}`)
          .join(' · ');

        const disabled = updatingId === item.id && changeStatus.isLoading;
        const pm = item.paymentMethod as PaymentMethod | undefined;

        const addressLine =
          item.addressShort ||
          item.address?.short ||
          item.address?.line1 ||
          null;

        const addressMeta = [
          item.address?.line2,
          item.address?.neighborhood,
          item.address?.city,
          item.address?.state,
        ]
          .filter(Boolean)
          .join(' · ');

        const contactName =
          item.address?.recipient ||
          item.user?.name ||
          null;

        const contactPhone =
          item.address?.phone ||
          item.user?.phone ||
          null;

        const deliveryNotes = item.address?.notes || null;

        return (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.orderId}>Pedido #{item.id}</Text>
              <StatusBadge status={item.status} />
            </View>

            <Text style={styles.timestamp}>
              {new Date(item.createdAt).toLocaleString()}
            </Text>

            {item.user && (
              <View style={styles.userBlock}>
                <Text style={styles.userName}>{item.user.name || 'Sin nombre'}</Text>
                {!!item.user.email && <Text style={styles.userMeta}>{item.user.email}</Text>}
                {!!item.user.phone && <Text style={styles.userMeta}>{item.user.phone}</Text>}
              </View>
            )}

            {addressLine ? (
              <View style={styles.addressBlock}>
                <Text style={styles.addressLabel}>Entregar en:</Text>
                <Text style={styles.addressLine}>{addressLine}</Text>

                {!!addressMeta && <Text style={styles.addressMeta}>{addressMeta}</Text>}

                {!!contactName && (
                  <Text style={styles.addressMeta}>Recibe: {contactName}</Text>
                )}

                {!!contactPhone && (
                  <Text style={styles.addressMeta}>Tel: {contactPhone}</Text>
                )}

                {!!deliveryNotes && (
                  <Text style={styles.addressMeta}>Notas dirección: {deliveryNotes}</Text>
                )}
              </View>
            ) : (
              <View style={styles.addressBlockMuted}>
                <Text style={styles.addressLabel}>Entregar en:</Text>
                <Text style={styles.addressMissing}>Sin dirección disponible en este pedido</Text>
              </View>
            )}

            {!!summary && <Text style={styles.items}>{summary}</Text>}

            {!!item.notes && <Text style={styles.notes}>Nota del pedido: {item.notes}</Text>}

            {!!pm && (
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Forma de pago:</Text>
                <View
                  style={[
                    styles.paymentBadge,
                    { backgroundColor: PAYMENT_COLORS[pm].bg },
                  ]}
                >
                  <Text
                    style={[
                      styles.paymentBadgeText,
                      { color: PAYMENT_COLORS[pm].text },
                    ]}
                  >
                    {PAYMENT_LABELS[pm]}
                  </Text>
                </View>
              </View>
            )}

            <Text style={styles.total}>{formatCurrency(item.total)}</Text>

            <View style={styles.statusRow}>
              {STATUS_FLOW.map((status) => {
                const selected = status === item.status;

                return (
                  <Pressable
                    key={status}
                    style={[styles.statusChip, selected && styles.statusChipActive]}
                    disabled={selected || disabled}
                    onPress={() => confirmChange(item, status)}
                  >
                    <Text
                      style={[
                        styles.statusChipText,
                        selected && styles.statusChipTextActive,
                        disabled && styles.statusChipTextDisabled,
                      ]}
                    >
                      {statusLabel[status]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {disabled ? <ActivityIndicator size="small" style={styles.spinner} /> : null}
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  muted: {
    marginTop: 8,
    color: '#6b7280',
  },
  lockTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  lockText: {
    marginTop: 6,
    color: '#6b7280',
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderId: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
  },
  timestamp: {
    marginTop: 6,
    color: '#6b7280',
  },
  userBlock: {
    marginTop: 10,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
  },
  userMeta: {
    color: '#6b7280',
    marginTop: 2,
  },
  addressBlock: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  addressBlockMuted: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  addressLabel: {
    color: '#4b5563',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  addressLine: {
    color: '#111827',
    fontWeight: '700',
    fontSize: 14,
  },
  addressMeta: {
    color: '#6b7280',
    marginTop: 3,
  },
  addressMissing: {
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  items: {
    marginTop: 10,
    color: '#374151',
  },
  notes: {
    marginTop: 6,
    color: '#4b5563',
    fontStyle: 'italic',
  },
  paymentRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  paymentLabel: {
    fontSize: 13,
    color: '#4b5563',
    marginRight: 6,
  },
  paymentBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  paymentBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  total: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
  },
  statusRow: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  statusChipActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  statusChipText: {
    color: '#111827',
    fontWeight: '600',
  },
  statusChipTextActive: {
    color: '#fff',
  },
  statusChipTextDisabled: {
    color: '#9ca3af',
  },
  spinner: {
    marginTop: 12,
  },
});