// frontend/src/screens/LockerScreen.tsx
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
import { useLocker } from '../hooks/useLocker';
import type { Product } from '../types/product';
import { getBottomQuickActionsPadding } from '../components/BottomQuickActionsBar';

export default function LockerScreen() {
  const navigation = useNavigation<any>();
  const { isAuthenticated, user } = useAuth();
  const insets = useSafeAreaInsets();
  const bottomPadding = getBottomQuickActionsPadding(insets.bottom);

  const { locker, isLoading, isFetching, refetch, lockerIds, toggleLocker } =
    useLocker();

  const isB2B =
    user?.role === 'B2B' || user?.role === 'ADMIN' || user?.role === 'BUSINESS';

  const products: Product[] = useMemo(() => {
    if (!locker) return [];
    // En casillero para B2B, mostramos precio B2B si aplica
    return locker.map((p) => ({
      ...p,
      price: isB2B ? p.b2bPrice ?? p.price : p.price,
    }));
  }, [locker, isB2B]);

  const handleNavigateLogin = () => {
    navigation.navigate('Login', {
      message: 'Inicia sesión como negocio para usar tu casillero',
    });
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <Text style={styles.title}>Tu casillero</Text>
        <Text style={styles.subtitle}>
          Inicia sesión para crear y usar tu casillero de productos frecuentes.
        </Text>
        <Pressable style={styles.loginButton} onPress={handleNavigateLogin}>
          <Text style={styles.loginButtonText}>Iniciar sesión</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (!isB2B) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <Text style={styles.title}>Tu casillero</Text>
        <Text style={styles.subtitle}>
          El casillero está disponible para negocios (B2B). Si quieres activar
          tu cuenta como negocio, usa la opción "Soy negocio" en tu perfil.
        </Text>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="small" color="#0E8A3A" />
        <Text style={[styles.subtitle, { marginTop: 12 }]}>
          Cargando tu casillero…
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { paddingBottom: bottomPadding }]}>
      <FlatList
        data={products}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 12 }}
        contentContainerStyle={{
          paddingVertical: 16,
          paddingBottom: 32,
          gap: 12,
        }}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={refetch} />
        }
        ListHeaderComponent={
          <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
            <Text style={styles.title}>Tu casillero</Text>
            <Text style={styles.subtitle}>
              Piensa en tu casillero como tu bodeguita virtual: guarda aquí lo
              que sueles pedir cada mes y luego pasa productos al carrito cuando
              los necesites. Los productos no quedan reservados; precios y
              disponibilidad se confirman al agregar al carrito.
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={[styles.center, { padding: 24 }]}>
            <Text style={styles.subtitle}>
              Aún no tienes productos en tu casillero.
            </Text>
            <Text style={[styles.subtitle, { marginTop: 4 }]}>
              Entra a la Bodega Virtual y toca el icono de casillero en un
              producto para guardarlo aquí.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ flex: 1 }}>
            <ProductCard
              product={item}
              showFavorite={false}
              showLocker={true}
              isInLocker={lockerIds.has(item.id)}
              onToggleLocker={() => toggleLocker(item)}
            />
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
    textAlign: 'left',
  },
  subtitle: {
    color: '#6b7280',
    textAlign: 'left',
    paddingRight: 8,
  },
  loginButton: {
    marginTop: 16,
    backgroundColor: '#0E8A3A',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  loginButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
});
