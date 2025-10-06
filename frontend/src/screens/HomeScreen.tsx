// src/screens/HomeScreen.tsx
import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, SafeAreaView } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

// Feature flag (futuro: Restaurantes)
const RESTAURANTS_ENABLED =
  (process.env.EXPO_PUBLIC_FEATURE_RESTAURANTS || 'false') === 'true';

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { user, refreshMe } = useAuth();

  // Revalida el perfil cuando esta pantalla gana foco (con refreshMe estable)
  useFocusEffect(
    React.useCallback(() => {
      refreshMe();
    }, [refreshMe])
  );

  // Logs de verificación (opcional)
  useEffect(() => {
    console.log('BASE_URL', (api.defaults as any).baseURL);
  }, []);
  useEffect(() => {
    console.log('[ME]', user);
  }, [user]);

  // Bodega para NEGOCIO (y ADMIN si aplica)
  const canSeeBodega = user?.role === 'NEGOCIO' || user?.role === 'ADMIN';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Inicio</Text>
      </View>

      <View style={styles.tilesRow}>
        {RESTAURANTS_ENABLED && (
          <Pressable
            style={[styles.tile, { backgroundColor: '#FFF6F2' }]}
            onPress={() => navigation.navigate('Restaurants')}
            accessibilityLabel="Ir a Restaurantes"
          >
            <Ionicons name="fast-food-outline" size={28} color="#DD6B20" />
            <Text style={styles.tileTitle}>Restaurantes</Text>
            <Text style={styles.tileSub}>Explora aliados</Text>
          </Pressable>
        )}

        <Pressable
          style={[styles.tile, { backgroundColor: '#F0FFF4' }]}
          onPress={() => navigation.navigate('Market')}
          accessibilityLabel="Ir al Mercado"
        >
          <Ionicons name="basket-outline" size={28} color="#0E8A3A" />
          <Text style={styles.tileTitle}>Mercado</Text>
          <Text style={styles.tileSub}>Compra ahora</Text>
        </Pressable>
      </View>

      {canSeeBodega && (
        <View style={styles.tilesRow}>
          <Pressable
            style={[styles.tile, { backgroundColor: '#EEF2FF' }]}
            onPress={() => navigation.navigate('Bodega')}
            accessibilityLabel="Ir a Bodega Virtual"
          >
            <Ionicons name="business-outline" size={28} color="#4338CA" />
            <Text style={styles.tileTitle}>Bodega Virtual</Text>
            <Text style={styles.tileSub}>Mayorista</Text>
          </Pressable>
          <View style={[styles.tile, styles.tileGhost]} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  title: { fontSize: 20, fontWeight: '700', color: '#111' },
  tilesRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginTop: 12 },
  tile: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tileGhost: { opacity: 0 },
  tileTitle: { marginTop: 8, color: '#111', fontWeight: '700', fontSize: 15 },
  tileSub: { color: '#666', marginTop: 2, fontSize: 12 },
});
