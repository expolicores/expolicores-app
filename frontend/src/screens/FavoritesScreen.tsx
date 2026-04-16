import React, { useMemo } from 'react';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { useAuth } from '../context/AuthContext';
import ProductCard from '../components/ProductCard';
import { useFavorites } from '../hooks/useFavorites';
import type { Product } from '../types/product';
import { getBottomQuickActionsPadding } from '../components/BottomQuickActionsBar';

export default function FavoritesScreen() {
  const navigation = useNavigation<any>();
  const { isAuthenticated, user } = useAuth();
  const insets = useSafeAreaInsets();
  const bottomPadding = getBottomQuickActionsPadding(insets.bottom);
  const { favorites, isLoading, isFetching, refetch } = useFavorites();
  const isB2B =
    user?.role === 'BUSINESS' || user?.role === 'B2B' || user?.role === 'ADMIN';

  const products = useMemo<Product[]>(() => {
    return (favorites ?? []).map((item) => ({
      ...item,
      price: isB2B ? item.b2bPrice : item.price,
      isFavorite: true,
    }));
  }, [favorites, isB2B]);

  const handleNavigateLogin = () => {
    navigation.navigate('Login', { message: 'Inicia sesión para guardar favoritos' });
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <Text style={styles.title}>Tus favoritos</Text>
        <Text style={styles.subtitle}>Inicia sesión para guardar y ver tus productos favoritos.</Text>
        <Pressable style={styles.loginButton} onPress={handleNavigateLogin}>
          <Text style={styles.loginButtonText}>Iniciar sesión</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator />
        <Text style={styles.subtitle}>Cargando favoritos…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={products}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 12 }}
        contentContainerStyle={{ paddingVertical: 16, paddingBottom: 32, gap: 12 }}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={refetch} />
        }
        ListEmptyComponent={
          <View style={[styles.center, { padding: 32 }]}>
            <Text style={styles.title}>Sin favoritos</Text>
            <Text style={styles.subtitle}>Toca el corazón de un producto en el catálogo para guardarlo aquí.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <ProductCard product={item} showFavorite />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: '#111', marginBottom: 8, textAlign: 'center' },
  subtitle: { color: '#6b7280', textAlign: 'center', paddingHorizontal: 24 },
  loginButton: {
    marginTop: 16,
    backgroundColor: '#0E8A3A',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  loginButtonText: { color: '#fff', fontWeight: '700' },
});
