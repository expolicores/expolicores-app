import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../context/AuthContext';
import {
  fetchAdminProducts,
  updateProductPricing,
  type ProductPricePatch,
} from '../lib/api';
import { formatCurrency } from '../lib/formatCurrency';
import type { AdminProduct } from '../types/product';

type PriceKey = 'price' | 'b2bPrice';

type DraftMap = Record<number, string>;

interface ScreenConfig {
  priceKey: PriceKey;
  navTitle: string;
  headerTitle: string;
  helper: string;
  jumpLabel?: string;
  jumpRoute?: string;
  emptyLabel: string;
  emptyWithSearchLabel: string;
  currentPriceLabel: string;
  referenceLabel?: string;
}

export function createAdminPriceListScreen({
  priceKey,
  navTitle,
  headerTitle,
  helper,
  jumpLabel,
  jumpRoute,
  emptyLabel,
  emptyWithSearchLabel,
  currentPriceLabel,
  referenceLabel,
}: ScreenConfig) {
  const otherKey: PriceKey = priceKey === 'price' ? 'b2bPrice' : 'price';

  return function AdminPriceListVariantScreen() {
    const navigation = useNavigation<any>();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const isAdmin = user?.role === 'ADMIN';

    const [search, setSearch] = useState('');
    const [drafts, setDrafts] = useState<DraftMap>({});
    const [savingId, setSavingId] = useState<number | null>(null);

    React.useLayoutEffect(() => {
      navigation.setOptions({ title: navTitle });
    }, [navigation]);

    const { data, isLoading, isRefetching, refetch, error } = useQuery<AdminProduct[]>({
      queryKey: ['admin-products'],
      queryFn: ({ signal }) => fetchAdminProducts({ signal }),
      enabled: isAdmin,
      staleTime: 0,
      retry: 1,
    });

    useEffect(() => {
      if (!data) return;
      setDrafts((prev) => {
        const next: DraftMap = {};
        data.forEach((product) => {
          const existing = prev[product.id];
          const source = product[priceKey];
          next[product.id] = existing !== undefined ? existing : String(source);
        });
        return next;
      });
    }, [data, priceKey]);

    const filtered = useMemo(() => {
      const term = search.trim().toLowerCase();
      if (!term) return data ?? [];
      return (data ?? []).filter((product) => {
        const nameHit = product.name.toLowerCase().includes(term);
        const catHit = product.category ? product.category.toLowerCase().includes(term) : false;
        const descHit = product.description ? product.description.toLowerCase().includes(term) : false;
        return nameHit || catHit || descHit;
      });
    }, [data, search]);

    const priceMutation = useMutation({
      mutationFn: ({ productId, value }: { productId: number; value: number }) => {
        const payload: ProductPricePatch =
          priceKey === 'price' ? { price: value } : { b2bPrice: value };
        return updateProductPricing(productId, payload);
      },
      onMutate: async ({ productId, value }) => {
        setSavingId(productId);
        await queryClient.cancelQueries({ queryKey: ['admin-products'] });
        const previous = queryClient.getQueryData<AdminProduct[]>(['admin-products']);

        queryClient.setQueryData<AdminProduct[]>(['admin-products'], (old) => {
          if (!old) return old;
          return old.map((item) =>
            item.id === productId
              ? {
                  ...item,
                  [priceKey]: value,
                  updatedAt: new Date().toISOString(),
                }
              : item,
          );
        });

        return { previous };
      },
      onError: (err: any, _vars, context) => {
        if (context?.previous) {
          queryClient.setQueryData(['admin-products'], context.previous);
        }
        const message =
          err?.response?.data?.message || err?.message || 'No se pudo guardar.';
        Alert.alert('Error', String(message));
      },
      onSuccess: (updated) => {
        setDrafts((prev) => ({
          ...prev,
          [updated.id]: String(updated[priceKey]),
        }));
      },
      onSettled: () => {
        setSavingId(null);
        queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      },
    });

    const handleChange = (productId: number, value: string) => {
      const sanitized = value.replace(/[^\d]/g, '');
      setDrafts((prev) => ({ ...prev, [productId]: sanitized }));
    };

    const handleReset = (product: AdminProduct) => {
      setDrafts((prev) => ({ ...prev, [product.id]: String(product[priceKey]) }));
    };

    const handleSave = (product: AdminProduct) => {
      const raw = drafts[product.id] ?? '';
      if (!raw.trim()) {
        Alert.alert('Precio requerido', 'Ingresa un valor numérico.');
        return;
      }

      const parsed = Number.parseInt(raw, 10);
      if (!Number.isFinite(parsed) || parsed < 0) {
        Alert.alert('Precio inválido', 'El precio debe ser un número positivo.');
        return;
      }

      if (parsed === product[priceKey]) {
        Alert.alert('Sin cambios', 'El precio ingresado es igual al valor actual.');
        return;
      }

      priceMutation.mutate({ productId: product.id, value: parsed });
    };

    if (!isAdmin) {
      return (
        <View style={[styles.container, styles.center]}>
          <Text style={styles.lockTitle}>Acceso restringido</Text>
          <Text style={styles.lockText}>
            Esta sección solo está disponible para administradores.
          </Text>
        </View>
      );
    }

    if (isLoading && !data) {
      return (
        <View style={[styles.container, styles.center]}>
          <ActivityIndicator />
          <Text style={styles.muted}>Cargando productos...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={[styles.container, styles.center, styles.errorBox]}>
          <Text style={styles.lockTitle}>No se pudo cargar la lista</Text>
          <Text style={styles.lockText}>Desliza hacia abajo para reintentar.</Text>
        </View>
      );
    }

    const listHeader = (
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{headerTitle}</Text>
        {jumpLabel && jumpRoute ? (
          <Pressable
            onPress={() => navigation.navigate(jumpRoute)}
            style={({ pressed }) => [
              styles.jumpButton,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={styles.jumpButtonText}>{jumpLabel}</Text>
          </Pressable>
        ) : null}
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por nombre, categoría o descripción"
          placeholderTextColor="#9ca3af"
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
        {search.trim().length > 0 ? (
          <Pressable
            onPress={() => setSearch('')}
            style={({ pressed }) => [
              styles.clearButton,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.clearButtonText}>Limpiar búsqueda</Text>
          </Pressable>
        ) : null}
        <Text style={styles.helper}>{helper}</Text>
      </View>
    );

    return (
      <View style={styles.container}>
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            <View style={[styles.center, styles.empty]}>
              <Text style={styles.lockTitle}>Sin resultados</Text>
              <Text style={styles.lockText}>
                {search.trim() ? emptyWithSearchLabel : emptyLabel}
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          renderItem={({ item }) => {
            const draftValue = drafts[item.id] ?? String(item[priceKey]);
            const dirty = draftValue !== String(item[priceKey]);
            const isSaving = savingId === item.id && priceMutation.status === 'pending';

            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.productName}>{item.name}</Text>
                    {item.category ? (
                      <Text style={styles.category}>{item.category}</Text>
                    ) : null}
                  </View>
                  <View style={styles.priceBlock}>
                    <Text style={styles.priceLabel}>{currentPriceLabel}</Text>
                    <Text style={styles.currentPrice}>
                      {formatCurrency(item[priceKey])}
                    </Text>
                  </View>
                </View>

                {referenceLabel ? (
                  <Text style={styles.reference}>
                    {referenceLabel}: {formatCurrency(item[otherKey])}
                  </Text>
                ) : null}

                {item.description ? (
                  <Text style={styles.description}>{item.description}</Text>
                ) : null}

                <Text style={styles.stock}>Stock: {item.stock}</Text>

                <View style={styles.controlRow}>
                  <TextInput
                    value={draftValue}
                    onChangeText={(value) => handleChange(item.id, value)}
                    keyboardType="numeric"
                    style={[
                      styles.priceInput,
                      dirty && styles.priceInputDirty,
                    ]}
                  />

                  <Pressable
                    onPress={() => handleSave(item)}
                    disabled={!dirty || isSaving}
                    style={({ pressed }) => [
                      styles.saveButton,
                      (!dirty || isSaving) && styles.buttonDisabled,
                      pressed && !isSaving && dirty && { opacity: 0.7 },
                    ]}
                  >
                    {isSaving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.saveButtonText}>Guardar</Text>
                    )}
                  </Pressable>

                  {dirty ? (
                    <Pressable
                      onPress={() => handleReset(item)}
                      style={({ pressed }) => [
                        styles.resetButton,
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <Text style={styles.resetButtonText}>Revertir</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          }}
        />
      </View>
    );
  };
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { justifyContent: 'center', alignItems: 'center' },
  muted: { marginTop: 8, color: '#6b7280' },
  lockTitle: { fontSize: 18, fontWeight: '700', color: '#111' },
  lockText: { marginTop: 6, color: '#6b7280', textAlign: 'center' },
  listContent: { padding: 16, paddingBottom: 32 },
  header: { marginBottom: 16, gap: 8 },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#111' },
  searchInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#111827',
    backgroundColor: '#f9fafb',
  },
  clearButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
  },
  clearButtonText: { color: '#374151', fontWeight: '600', fontSize: 12 },
  helper: {
    color: '#6b7280',
    fontSize: 12,
  },
  jumpButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#111827',
  },
  jumpButtonText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  card: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#fff',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    gap: 8,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  productName: { fontSize: 16, fontWeight: '700', color: '#111827' },
  category: { marginTop: 4, color: '#6b7280', fontSize: 12 },
  priceBlock: { alignItems: 'flex-end' },
  priceLabel: { fontSize: 12, color: '#6b7280' },
  currentPrice: { fontWeight: '700', color: '#111827', marginTop: 2 },
  reference: { color: '#6b7280', fontSize: 12 },
  description: { color: '#4b5563' },
  stock: { color: '#6b7280', fontSize: 12 },
  controlRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  priceInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    color: '#111827',
  },
  priceInputDirty: { borderColor: '#6366f1', backgroundColor: '#eef2ff' },
  saveButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#111827',
    borderRadius: 10,
  },
  saveButtonText: { color: '#fff', fontWeight: '600' },
  resetButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  resetButtonText: { color: '#374151', fontWeight: '600' },
  buttonDisabled: { backgroundColor: '#9ca3af' },
  empty: { padding: 24 },
  errorBox: { paddingHorizontal: 24 },
});
