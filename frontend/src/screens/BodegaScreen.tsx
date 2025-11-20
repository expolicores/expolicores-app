// frontend/src/screens/BodegaScreen.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import MarketScreen from './MarketScreen';

export default function BodegaScreen() {
  const { user } = useAuth();
  const allowed =
    user?.role === 'BUSINESS' || user?.role === 'B2B' || user?.role === 'ADMIN';

  if (!allowed) {
    return (
      <SafeAreaView style={styles.restrictedContainer}>
        <View style={styles.center}>
          <Text style={styles.title}>Acceso restringido</Text>
          <Text style={styles.message}>
            La bodega mayorista y el casillero solo están disponibles para cuentas de
            tipo Negocio. Si quieres activar tu perfil como negocio, usa la opción
            "Soy negocio" en tu perfil.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Bodega Virtual</Text>
        <Text style={styles.headerMessage}>
          Esta es tu bodega mayorista. Desde aquí puedes ver el catálogo para tu
          negocio y usar el casillero como tu “bodeguita virtual”: guarda los
          productos que sueles pedir cada mes y luego pásalos al carrito cuando los
          necesites.
        </Text>
      </View>

      <View style={styles.body}>
        {/* 
          MarketScreen en variante B2B se encarga del listado y del uso de ProductCard.
          El casillero solo se mostrará en esta vista (no en Mercado) usando la prop
          showLocker en ProductCard desde la variante B2B.
        */}
        <MarketScreen variant="B2B" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  restrictedContainer: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 24,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  headerMessage: {
    fontSize: 11,
    lineHeight: 16,
    color: '#6b7280',
  },
  body: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    textAlign: 'center',
  },
  message: {
    marginTop: 8,
    color: '#6b7280',
    textAlign: 'center',
  },
});
