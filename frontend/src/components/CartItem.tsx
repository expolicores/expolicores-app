// src/components/CartItem.tsx
import React, { memo } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { formatCurrency } from '../lib/formatCurrency';
import type { Product } from '../types/product';

// Línea del carrito: producto + cantidad
export type CartLine = {
  product: Product;
  quantity: number;
};

type Props = {
  line: CartLine;
  onInc: () => void;
  onDec: () => void;
  onRemove: () => void;
  canInc?: boolean;
  canDec?: boolean;
};

function CartItemBase({
  line,
  onInc,
  onDec,
  onRemove,
  canInc = true,
  canDec = true,
}: Props) {
  const { product, quantity } = line;

  return (
    <View style={styles.card}>
      <Image
        source={{
          uri:
            product.imageUrl ||
            'https://via.placeholder.com/80x80.png?text=Img',
        }}
        style={styles.image}
      />

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>
        <Text style={styles.price}>{formatCurrency(product.price)}</Text>

        <View style={styles.controlsRow}>
          <View style={styles.qtyBox}>
            <TouchableOpacity
              onPress={onDec}
              disabled={!canDec}
              style={[styles.qtyBtn, !canDec && styles.btnDisabled]}
              accessibilityLabel="Disminuir cantidad"
            >
              <Text style={styles.qtyBtnText}>−</Text>
            </TouchableOpacity>

            <View style={styles.qtyValueBox}>
              <Text style={styles.qtyValue}>{quantity}</Text>
            </View>

            <TouchableOpacity
              onPress={onInc}
              disabled={!canInc}
              style={[styles.qtyBtn, !canInc && styles.btnDisabled]}
              accessibilityLabel="Aumentar cantidad"
            >
              <Text style={styles.qtyBtnText}>＋</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={onRemove}
            accessibilityLabel="Eliminar del carrito"
          >
            <Text style={styles.remove}>Eliminar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export const CartItem = memo(CartItemBase);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#F7F7F8',
  },
  info: { flex: 1 },
  name: { color: '#111', fontSize: 16, fontWeight: '600' },
  price: { color: '#111', fontSize: 17, fontWeight: '800', marginTop: 6 },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  qtyBox: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F7F8',
  },
  btnDisabled: { opacity: 0.4 },
  qtyBtnText: { fontSize: 20, color: '#111' },
  qtyValueBox: {
    minWidth: 44,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  qtyValue: { fontSize: 16, fontWeight: '700', color: '#111' },
  remove: { color: '#D32F2F', fontSize: 14, fontWeight: '600' },
});
