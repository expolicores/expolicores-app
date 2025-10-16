import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import MarketScreen from './MarketScreen';

export default function BodegaScreen() {
  const { user } = useAuth();
  const allowed = user?.role === 'NEGOCIO' || user?.role === 'ADMIN';

  if (!allowed) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.title}>Acceso restringido</Text>
        <Text style={styles.message}>
          La bodega mayorista solo está disponible para cuentas de tipo Negocio.
        </Text>
      </View>
    );
  }

  return <MarketScreen variant="B2B" />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 24 },
  center: { justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: '#111' },
  message: { marginTop: 8, color: '#6b7280', textAlign: 'center' },
});
