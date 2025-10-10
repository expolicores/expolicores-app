import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../context/AuthContext';
import { fetchAdminProducts, updateProductPrice } from '../lib/api';
import { formatCurrency } from '../lib/formatCurrency';
import type { AdminProduct } from '../types/product';

export default function AdminPriceListScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  React.useLayoutEffect(() => {
    navigation.setOptions({ title: 'Lista de precios' });
  }, [navigation]);

  const {
    data,
    isLoading,
    isRefetching,
    refetch,
    error,
  } = useQuery<AdminProduct[]>({
    queryKey: ['admin-products'],
    queryFn: () => fetchAdminProducts(),
    enabled: isAdmin,
    staleTime: 30_000,
  });

  const priceMutation = useMutation({
    mutationFn: ({ id, price }: { id: number; price: number }) =>
      updateProductPrice(id, price),
    onMutate: async ({ id, price }) => {
      setUpdatingId(id);
      await queryClient.cancelQueries({ queryKey: ['admin-products'] });
      const previous = queryClient.getQueryData<AdminProduct[]>(['admin-products']);

      queryClient.setQueryData<AdminProduct[]>(['admin-products'], (old) => {
        if (!old) return old;
        return old.map((product) =>
          product.id === id ? { ...product, price } : product,
        );
      });

      return { previous };
    },
    onError: (err: any, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['admin-products'], context.previous);
      }
      const msg = err?.response?.data?.message || err?.message || 'No se pudo actualizar el precio.';
      Alert.alert('Error', String(msg));
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<AdminProduct[]>(['admin-products'], (old) => {
        if (!old) return old;
        return old.map((product) =>
          product.id === updated.id ? { ...product, ...updated } : product,
        );
      });
      setDrafts((prev) => ({ ...prev, [updated.id]: String(updated.price ?? '') }));
    },
    onSettled: () => {
      setUpdatingId(null);
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    },
  });

  const products = useMemo(() => {
    if (!data) return [] as AdminProduct[];
    return data
      .slice()
      .sort((a, b) => {
        const catA = (a.category || '').toLowerCase();
        const catB = (b.category || '').toLowerCase();
        if (catA !== catB) return catA.localeCompare(catB);
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      });
  }, [data]);

  const sanitizePrice = (value: string) => value.replace(/[^0-9]/g, '');

  const handleDraftChange = (id: number, raw: string) => {
    const cleaned = sanitizePrice(raw);
    setDrafts((prev) => ({ ...prev, [id]: cleaned }));
  };

  const handleSave = (product: AdminProduct) => {
    const value = drafts[product.id] ?? String(product.price ?? '');
    const normalized = sanitizePrice(value);
    if (!normalized) {
      Alert.alert('Precio requerido', 'Ingresa un valor numérico para el precio.');
      return;
    }

    const parsed = Number.parseInt(normalized, 10);
    if (!Number.isFinite(parsed)) {
      Alert.alert('Precio inválido', 'El valor ingresado no es un número válido.');
      return;
    }

    if (parsed === product.price) {
      Alert.alert('Sin cambios', 'El nuevo precio es igual al actual.');
      return;
    }

    priceMutation.mutate({ id: product.id, price: parsed });
  };

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
        <Text style={styles.muted}>Cargando productos...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.center, styles.container]}>
        <Text style={styles.lockTitle}>No se pudo cargar la lista</Text>
        <Text style={styles.lockText}>Desliza hacia abajo para intentar nuevamente.</Text>
      </View>
    );
  }

  if (products.length === 0) {
    return (
      <View style={[styles.center, styles.container]}>
        <Text style={styles.lockTitle}>Sin productos</Text>
        <Text style={styles.lockText}>Cuando registres productos aparecerán aquí.</Text>
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={styles.listContent}
      data={products}
      keyExtractor={(item) => String(item.id)}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      renderItem={({ item }) => {
        const draftValue = drafts[item.id] ?? String(item.price ?? '');
        const normalized = sanitizePrice(draftValue);
        const parsed = normalized ? Number.parseInt(normalized, 10) : NaN;
        const hasChanges = Number.isFinite(parsed) && parsed !== item.price;
        const disabled = updatingId === item.id && priceMutation.isPending;

        return (
          <View style={styles.card}>
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.productName}>{item.name}</Text>
                {item.category ? (
                  <Text style={styles.category}>{item.category}</Text>
                ) : null}
              </View>
              <Text style={styles.currentPrice}>{formatCurrency(item.price)}</Text>
            </View>

            <Text style={styles.inputLabel}>Nuevo precio</Text>
            <TextInput
              value={normalized}
              onChangeText={(text) => handleDraftChange(item.id, text)}
              keyboardType="number-pad"
              placeholder={String(item.price)}
              style={styles.input}
              maxLength={9}
            />
            <Text style={styles.preview}>
              {normalized ? formatCurrency(Number.parseInt(normalized, 10)) : 'Ingresa un valor'}
            </Text>

            <View style={styles.actionsRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Restablecer precio para ${item.name}`}
                onPress={() =>
                  setDrafts((prev) => {
                    const next = { ...prev };
                    delete next[item.id];
                    return next;
                  })
                }
                style={[styles.secondaryButton, disabled && styles.buttonDisabled]}
                disabled={disabled}
              >
                <Text style={[styles.secondaryButtonText, disabled && styles.buttonTextDisabled]}>
                  Restablecer
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Guardar nuevo precio para ${item.name}`}
                onPress={() => handleSave(item)}
                style={[
                  styles.primaryButton,
                  (!hasChanges || disabled) && styles.buttonDisabled,
                ]}
                disabled={!hasChanges || disabled}
              >
                {disabled ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>Guardar</Text>
                )}
              </Pressable>
            </View>
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
    padding: 24,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  muted: {
    marginTop: 12,
    color: '#6B7280',
  },
  lockTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  lockText: {
    marginTop: 8,
    fontSize: 15,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 20,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
    backgroundColor: '#F3F4F6',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#11182733',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  productName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  category: {
    marginTop: 2,
    color: '#6B7280',
    fontSize: 13,
  },
  currentPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
  },
  inputLabel: {
    fontSize: 13,
    color: '#4B5563',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  preview: {
    marginTop: 6,
    fontSize: 13,
    color: '#6B7280',
  },
  actionsRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#374151',
    fontWeight: '600',
  },
  primaryButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonTextDisabled: {
    color: '#9CA3AF',
  },
});
