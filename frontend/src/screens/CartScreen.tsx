// src/screens/CartScreen.tsx
import React, { useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  Image,
  FlatList,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../context/CartContext';

export default function CartScreen() {
  const navigation = useNavigation<any>();
  const { items, setQty, remove, subtotal, clear } = useCart();

  const data = useMemo(() => items, [items]);
  const hasItems = data.length > 0;

  const dec = (it: any) => setQty(it.productId, Math.max(1, it.qty - 1));
  const inc = (it: any) => setQty(it.productId, Math.min((it.qty ?? 0) + 1, it.stock ?? 9999));

  const renderItem = ({ item }: any) => {
    const isMin = (item.qty ?? 1) <= 1;
    return (
      <View style={styles.card}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]} />
        )}

        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={2}>
            {item.name}
          </Text>

          <Text style={styles.price}>
            ${(item.price * item.qty).toLocaleString('es-CO')}
          </Text>

          <View style={styles.controlsRow}>
            <View style={styles.qtyBox}>
              {/* IZQUIERDA: papelera si qty==1, si no, botón − */}
              <Pressable
                onPress={() => (isMin ? remove(item.productId) : dec(item))}
                accessibilityLabel={isMin ? 'Eliminar del carrito' : 'Disminuir cantidad'}
                style={[styles.qtyBtn, isMin && styles.deleteBtn]}
              >
                {isMin ? (
                  <Ionicons name="trash-outline" size={18} color={COLORS.red} />
                ) : (
                  <Text style={styles.qtyBtnText}>−</Text>
                )}
              </Pressable>

              <View style={styles.qtyValueBox}>
                <Text style={styles.qtyValue}>{item.qty}</Text>
              </View>

              <Pressable
                onPress={() => inc(item)}
                accessibilityLabel="Aumentar cantidad"
                style={styles.qtyBtn}
              >
                <Text style={styles.qtyBtnText}>＋</Text>
              </Pressable>
            </View>

            <Pressable
              onPress={() => remove(item.productId)}
              accessibilityLabel="Eliminar del carrito"
            >
              <Text style={styles.remove}>Eliminar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  };

  if (!hasItems) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>Tu carrito está vacío</Text>
          <Pressable
            onPress={() => navigation.navigate('Catalog')}
            style={styles.btnPrimary}
          >
            <Text style={styles.btnPrimaryText}>Ir al catálogo</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={data}
        keyExtractor={(it: any) => String(it.productId)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 140 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      />

      <View style={styles.noteBox}>
        <Text style={styles.noteText}>* El envío se calcula en el checkout.</Text>
      </View>

      <View style={styles.stickyBar}>
        <View style={styles.stickyMeta}>
          <Text style={styles.metaLeft}>Artículos ({data.length})</Text>
          <Text style={styles.metaRight}>
            Subtotal ${subtotal.toLocaleString('es-CO')}
          </Text>
        </View>

        <Pressable
          onPress={() => navigation.navigate('Checkout')}
          style={styles.btnPrimary}
          accessibilityLabel="Continuar a checkout"
        >
          <Text style={styles.btnPrimaryText}>Continuar</Text>
        </Pressable>

        <Pressable onPress={clear} style={styles.btnSecondary}>
          <Text style={styles.btnSecondaryText}>Vaciar carrito</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const COLORS = {
  bg: '#FFFFFF',
  border: '#E5E7EB',
  muted: '#F7F7F8',
  text: '#111111',
  text2: '#666666',
  green: '#0E8A3A',
  red: '#D32F2F',
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.bg,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  image: { width: 80, height: 80, borderRadius: 12 },
  imagePlaceholder: { backgroundColor: COLORS.muted },
  info: { flex: 1, marginLeft: 12 },
  name: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  price: { color: COLORS.text, fontSize: 17, fontWeight: '800', marginTop: 6 },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  qtyBox: { flexDirection: 'row', alignItems: 'center' },
  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.muted,
  },
  deleteBtn: {
    borderColor: '#FAD1D1',
    backgroundColor: '#FFF4F4',
  },
  qtyBtnText: { fontSize: 20, color: COLORS.text },
  qtyValueBox: {
    minWidth: 44,
    height: 36,
    marginHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  qtyValue: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  remove: { color: COLORS.red, fontSize: 14, fontWeight: '600' },

  noteBox: { paddingHorizontal: 16, paddingBottom: 92 },
  noteText: { color: COLORS.text2, fontSize: 12 },

  stickyBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.bg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
  },
  stickyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  metaLeft: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
  metaRight: { color: COLORS.text, fontSize: 16, fontWeight: '800' },

  btnPrimary: {
    backgroundColor: COLORS.green,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnPrimaryText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  btnSecondary: {
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  btnSecondaryText: { color: COLORS.text2, fontSize: 14, fontWeight: '600' },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { color: COLORS.text2, fontSize: 15, marginBottom: 10 },
});
