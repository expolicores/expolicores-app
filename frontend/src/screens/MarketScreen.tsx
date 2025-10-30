// src/screens/MarketScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useNavigation, useIsFocused, useRoute } from '@react-navigation/native';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../lib/api';
import { useCart } from '../context/CartContext';
import ProductCard from '../components/ProductCard';
import type { Product } from '../types/product';
import { useFavorites } from '../hooks/useFavorites';

type Category = string;
type Paged = { items: Product[]; nextPage?: number | null };

const AUTO_REFRESH_INTERVAL = 10_000;
type MarketScreenProps = { variant?: 'B2C' | 'B2B' };

// Tags virtuales (UI)
const VIRTUAL_TAGS = [
  { key: 'oferta', label: 'Ofertas' },
  { key: 'low_price', label: '<= $16.000' },
  { key: 'pack', label: 'Packs' },
];

export default function MarketScreen({ variant = 'B2C' }: MarketScreenProps) {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const isFocused = useIsFocused();
  const listRef = useRef<FlatList<Product> | null>(null);
  const lastSearchTokenRef = useRef<unknown>(null);
  const { items: cartItems, add, setQty, remove } = useCart() as any;
  const { favoriteIds } = useFavorites();
  const isB2B = variant === 'B2B';

  const [q, setQ] = useState(() => {
    const initial = route?.params?.initialQuery;
    return typeof initial === 'string' ? initial : '';
  });
  const [category, setCategory] = useState<Category | undefined>(undefined);
  const [tag, setTag] = useState<string | undefined>(undefined);

  // Cache local de stock (cuando el listado viene sin stock)
  const stockCacheRef = useRef<Record<number, number | null>>({});
  const pendingRef = useRef<Record<number, boolean>>({}); // anti multi-tap

  // ----- CATEGORAS -----
  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const r = await api.get('/products/categories');
      return r.data as string[];
    },
  });

  // ----- PRODUCTOS (paginado) -----
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isFetching,
  } = useInfiniteQuery<Paged>({
    queryKey: ['products', { q, category, tag, variant }],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const r = await api.get('/products', {
        params: { q, category, tag, page: pageParam, limit: 20 },
      });
      const total = parseInt(r.headers['x-total-count'] || '0', 10);
      const next = pageParam * 20 < total ? pageParam + 1 : null;
      const rawItems = Array.isArray(r.data) ? (r.data as Product[]) : [];
      const items = rawItems.map((item) => ({
        ...item,
        b2bPrice:
          typeof item.b2bPrice === 'number' && !Number.isNaN(item.b2bPrice)
            ? item.b2bPrice
            : item.price,
      }));
      return { items, nextPage: next };
    },
    getNextPageParam: (last) => last.nextPage ?? undefined,
    refetchInterval: isFocused ? AUTO_REFRESH_INTERVAL : false,
    refetchIntervalInBackground: false,
    staleTime: AUTO_REFRESH_INTERVAL,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: 1,
    placeholderData: (prev) => prev,
  });

  useEffect(() => {
    const nextQueryParam = route?.params?.initialQuery;
    const token = route?.params?.searchToken ?? nextQueryParam;

    if (typeof nextQueryParam !== 'string') return;
    const trimmed = nextQueryParam.trim();
    if (!trimmed.length) return;

    const tokenKey = token ?? trimmed;
    if (lastSearchTokenRef.current === tokenKey) return;

    lastSearchTokenRef.current = tokenKey;
    setQ(trimmed);
    setCategory(undefined);
    setTag(undefined);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
    refetch();
  }, [route?.params?.initialQuery, route?.params?.searchToken, refetch]);

  const favoriteKey = useMemo(() => Array.from(favoriteIds).join(","), [favoriteIds]);

  const products = useMemo(() => {
    const flat = data?.pages.flatMap((p) => p.items) ?? [];
    return flat.map((item) => ({
      ...item,
      price: isB2B ? item.b2bPrice : item.price,
      isFavorite: favoriteIds.has(item.id),
    }));
  }, [data, isB2B, favoriteKey]);

  const isInitialLoad = !data && isFetching && !isFetchingNextPage;
  const isRefreshing = !!data && isFetching && !isFetchingNextPage;

  const qtyInCart = (pid: number) =>
    cartItems.find((it: any) => it.productId === pid)?.qty ?? 0;

  // Obtiene stock confiable: listado -> cache -> fetch detalle
  const ensureStock = async (item: Product): Promise<number | null> => {
    if (typeof item.stock === 'number') {
      stockCacheRef.current[item.id] = item.stock;
      return item.stock;
    }

    const cached = stockCacheRef.current[item.id];
    if (typeof cached === 'number' || cached === null) return cached;

    if (pendingRef.current[item.id]) return null; // evita paralelizar
    pendingRef.current[item.id] = true;
    try {
      const r = await api.get(`/products/${item.id}`);
      const s: number | null =
        typeof r.data?.stock === 'number' ? r.data.stock : null;
      stockCacheRef.current[item.id] = s;

      // Si ya hay qty y excede el stock recin conocido  clampeamos
      const q = qtyInCart(item.id);
      if (typeof s === 'number' && q > s) setQty(item.id, s);

      return s;
    } catch {
      stockCacheRef.current[item.id] = null;
      return null;
    } finally {
      pendingRef.current[item.id] = false;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Buscador */}
      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color="#666" />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Busca productos"
          style={styles.searchInput}
          returnKeyType="search"
          onSubmitEditing={() => refetch()}
        />
      </View>

      {/* Chips: virtuales + reales */}
      <FlatList
        data={[
          ...VIRTUAL_TAGS.map((t) => ({ type: 'tag', key: t.key, label: t.label } as const)),
          ...(categories?.map((c) => ({ type: 'cat', key: c, label: c })) || []),
        ]}
        keyExtractor={(it) => `${it.type}:${it.key}`}
        renderItem={({ item }) => {
          const active =
            item.type === 'tag' ? tag === item.key : category === (item.key as string);
          return (
            <Pressable
              onPress={() => {
                if (item.type === 'tag') {
                  setTag((prev) =>
                    prev === item.key ? undefined : (item.key as string),
                  );
                  setCategory(undefined);
                } else {
                  setCategory((prev) =>
                    prev === item.key ? undefined : (item.key as string),
                  );
                  setTag(undefined);
                }
              }}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        }}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
        style={{ maxHeight: 48, marginTop: 8 }}
      />

      {/* Grid de productos */}
      <FlatList
        ref={listRef}
        data={isInitialLoad ? [] : products}
        keyExtractor={(p) => String(p.id)}
        numColumns={2}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 12 }}
        contentContainerStyle={{ paddingVertical: 12, paddingBottom: 24, gap: 12, flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refetch}
          />
        }
        ListEmptyComponent={
          isInitialLoad ? (
            <View style={{ flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator />
              <Text style={{ marginTop: 12, color: '#6B7280' }}>Cargando catálogo…</Text>
            </View>
          ) : (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Text style={{ color: '#6B7280' }}>Sin resultados</Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const qty = qtyInCart(item.id);
          const unitPrice = isB2B ? item.b2bPrice : item.price;
          const productForCard: Product = { ...item, price: unitPrice };

          // Stock efectivo para mostrar: cache > listado > null
          const cached = stockCacheRef.current[item.id];
          const effectiveStock =
            typeof cached === 'number'
              ? cached
              : typeof item.stock === 'number'
              ? item.stock
              : null;

          const handleAdd = async () => {
            if (pendingRef.current[item.id]) return;

            const s = await ensureStock(item); // null = desconocido
            if (typeof s === 'number') {
              if (qty >= s) return; // tope
              add({
                productId: item.id,
                name: item.name,
                price: unitPrice,
                imageUrl: item.imageUrl ?? null,
                stock: s, // guardamos el stock real en la lnea
                category: item.category ?? null,
              });
            } else {
              // Stock no disponible -> no arriesgar sobreventa (conservador)
              // (opcional: mostrar toast/alerta)
              return;
            }
          };

          const handleInc = async () => {
            if (pendingRef.current[item.id]) return;

            const s = await ensureStock(item);
            if (typeof s === 'number') {
              if (qty >= s) return;
              setQty(item.id, Math.min(qty + 1, s));
            } else {
              // sin stock conocido -> no incrementamos (conservador)
              return;
            }
          };

          const handleDec = () => {
            if (qty > 1) setQty(item.id, qty - 1);
            else remove(item.id);
          };

          return (
            <ProductCard
              product={productForCard}
              quantity={qty}
              stock={effectiveStock} // el card calcula disponibilidad restante
              onAdd={() => { void handleAdd(); }}
              onInc={() => { void handleInc(); }}
              onDec={handleDec}
              onRemove={() => remove(item.id)}
              onOpenDetail={() =>
                navigation.navigate('ProductDetail', { id: item.id })
              }
              showFavorite
            />
          );
        }}
        onEndReachedThreshold={0.6}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#111' },
  chip: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: '#0E8A3A1A', borderColor: '#0E8A3A' },
  chipText: { color: '#111', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#0E8A3A' },
});
