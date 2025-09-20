import React, { useMemo, useRef, useState, useEffect } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  ScrollView,
  Text,
  TextInput,
  View,
  RefreshControl,
} from "react-native";
import { useInfiniteQuery } from "@tanstack/react-query";
import { getProductsPaged } from "../lib/api";
import { useDebounce } from "../lib/useDebounce";
import CategoryChips from "../components/CategoryChips";
import ProductCard from "../components/ProductCard";

const PAGE_SIZE = 20;
const SORT_OPTIONS = [
  { key: "newest", label: "Nuevos" },
  { key: "price_asc", label: "Precio ↑" },
  { key: "price_desc", label: "Precio ↓" },
  { key: "name_asc", label: "Nombre A-Z" },
  { key: "name_desc", label: "Nombre Z-A" },
] as const;
type SortKey = (typeof SORT_OPTIONS)[number]["key"];

export default function CatalogScreen() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [sort, setSort] = useState<SortKey>("newest");

  const q = useDebounce(search.trim(), 400);
  const listRef = useRef<FlatList>(null);

  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    isFetchingNextPage,
    hasNextPage,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: ["products", { q, category, sort }],
    queryFn: ({ pageParam = 1, signal }) =>
      getProductsPaged(
        { q: q || undefined, category, sort, page: pageParam, limit: PAGE_SIZE },
        { signal }
      ),
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((acc, p) => acc + p.items.length, 0);
      if (loaded >= (lastPage.total ?? 0)) return undefined;
      const totalPages = Math.max(1, Math.ceil((lastPage.total ?? 0) / PAGE_SIZE));
      const next = allPages.length + 1; // 1-based
      return next <= totalPages ? next : undefined;
    },
    keepPreviousData: true,
    staleTime: 30_000,
  });

  // Volver al inicio al cambiar filtros/búsqueda/orden
  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [q, category, sort]);

  // Aplana y deduplica por id para evitar duplicados
  const items = useMemo(() => {
    const map = new Map<number, any>();
    (data?.pages ?? []).forEach((p) => {
      p.items.forEach((it: any) => map.set(it.id, it));
    });
    return Array.from(map.values());
  }, [data]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.muted}>Cargando catálogo…</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>No pudimos cargar el catálogo.</Text>
        <Pressable onPress={() => refetch()} style={styles.retryBtn}>
          <Text style={styles.retryText}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Buscador */}
      <TextInput
        placeholder="Buscar por nombre o descripción"
        value={search}
        onChangeText={setSearch}
        style={styles.search}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />

      {/* Categorías */}
      <CategoryChips
        selected={category}
        onSelect={(c) => setCategory(c)}
        onResetAll={() => setSearch("")}
      />

      {/* Ordenar (scrollable) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sortRow}
      >
        {SORT_OPTIONS.map((opt) => (
          <Pressable
            key={opt.key}
            onPress={() => setSort(opt.key)}
            style={[styles.sortChip, sort === opt.key && styles.sortChipActive]}
          >
            <Text style={[styles.sortText, sort === opt.key && styles.sortTextActive]}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Lista */}
      {items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>No hay productos disponibles.</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef as any}
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <ProductCard product={item} onAdd={() => { /* US08 */ }} />
          )}
          contentContainerStyle={{ padding: 12 }}
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
          }}
          ListFooterComponent={
            isFetchingNextPage ? <ActivityIndicator style={{ marginVertical: 12 }} /> : null
          }
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          // Performance en listas largas
          initialNumToRender={12}
          windowSize={10}
          removeClippedSubviews
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  muted: { color: "#666", marginTop: 8 },
  error: { color: "#c1121f", marginBottom: 12, fontWeight: "600" },
  retryBtn: {
    backgroundColor: "#111827",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: { color: "#fff", fontWeight: "600" },
  search: {
    backgroundColor: "#f3f4f6",
    margin: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  sortRow: { flexDirection: "row", paddingHorizontal: 12, gap: 8, marginBottom: 6 },
  sortChip: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sortChipActive: { backgroundColor: "#111827" },
  sortText: { color: "#111827" },
  sortTextActive: { color: "#fff", fontWeight: "600" },
});
