import React from 'react';
import { View, Text, FlatList, ActivityIndicator, Button, Alert } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { getProducts, getCategories } from '../lib/api';
import { Product } from '../types/product';
import ProductCard from '../components/ProductCard';
import CategoryChips from '../components/CategoryChips';

export default function CatalogScreen() {
  const productsQ = useQuery({ queryKey: ['products'], queryFn: getProducts });
  const categoriesQ = useQuery({ queryKey: ['categories'], queryFn: getCategories });
  const [active, setActive] = React.useState<string | null>(null);

  // Placeholder para el botón "Agregar" (US08 vendrá luego)
  const onAddPlaceholder = (p: Product) =>
    Alert.alert('Carrito', `“${p.name}” se agregará en el próximo sprint (US08).`);

  if (productsQ.isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Cargando…</Text>
      </View>
    );
  }

  if (productsQ.isError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 }}>
        <Text style={{ marginBottom: 12 }}>No se pudo cargar el catálogo</Text>
        <Button title="Reintentar" onPress={() => { productsQ.refetch(); categoriesQ.refetch(); }} />
      </View>
    );
  }

  const products = (productsQ.data ?? []) as Product[];
  const categories = (categoriesQ.data && categoriesQ.data.length > 0)
    ? categoriesQ.data
    : Array.from(new Set(products.map(p => p.category).filter(Boolean))) as string[];
  const filtered = active ? products.filter(p => p.category === active) : products;

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <CategoryChips categories={categories} active={active} onChange={setActive} />
      {filtered.length === 0 ? (
        <Text>No hay productos disponibles</Text>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <ProductCard product={item} onAdd={() => onAddPlaceholder(item)} />
          )}
        />
      )}
    </View>
  );
}
