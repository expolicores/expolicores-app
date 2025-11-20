// src/components/ProductCard.tsx
import React, { useMemo } from 'react';
import { View, Text, Image, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import type { Product } from '../types/product';
import { useFavorites } from '../hooks/useFavorites';
import { formatCurrency } from '../lib/formatCurrency';
import { resolveProductImageUri } from '../lib/image';

type Props = {
  product: Product;

  /** Modo controlado (opcional). Si no se proveen, el componente usa useCart internamente */
  quantity?: number;
  stock?: number | null;
  onAdd?: () => void;
  onInc?: () => void;
  onDec?: () => void;
  onRemove?: () => void; // opcional en modo controlado

  showFavorite?: boolean;
  onOpenDetail?: () => void;

  /** ====== NUEVO: Casillero B2B ====== */
  /** Si true, muestra el icono de casillero en la esquina inferior derecha de la imagen */
  showLocker?: boolean;
  /** Indica si este producto ya está en el casillero del usuario */
  isInLocker?: boolean;
  /** Handler para alternar en casillero (add/remove) */
  onToggleLocker?: () => void;
};

const COLORS = {
  text: '#111111',
  border: '#E5E7EB',
  bg: '#FFFFFF',
  imgBg: '#F3F4F6',
  green: '#0E8A3A', // CTA Boyaca
  greenLight: '#E8F3EC',
  grayText: '#6B7280',
  red: '#D32F2F',
};

export default function ProductCard({
  product,
  quantity,
  stock,
  onAdd,
  onInc,
  onDec,
  onRemove,
  showFavorite = true,
  onOpenDetail,

  showLocker = false,
  isInLocker = false,
  onToggleLocker,
}: Props) {
  const navigation = useNavigation<any>();
  const { isAuthenticated } = useAuth();
  const cart = useCart();
  const { favoriteIds, toggleFavorite, isMutating } = useFavorites();

  const productImageUri = useMemo(
    () => resolveProductImageUri(product.imageUrl),
    [product.imageUrl],
  );

  // ===== MODO AUTONOMO =====
  const autonomous = typeof quantity !== 'number' && !onAdd && !onInc && !onDec;

  const qtyFromCart = useMemo(() => {
    if (!autonomous) return 0;
    return cart.items.find((it: any) => it.productId === product.id)?.qty ?? 0;
  }, [autonomous, cart.items, product.id]);

  const effectiveQty = autonomous ? qtyFromCart : quantity ?? 0;

  const productStock =
    (typeof stock === 'number' ? stock : (product as any).stock) as
      | number
      | undefined
      | null;
  const effectiveStock = productStock ?? null;

  const atMax = effectiveStock != null && effectiveQty >= effectiveStock;
  const isOutOfStock = effectiveStock === 0;
  const canInc = effectiveStock == null ? true : effectiveQty < effectiveStock;

  // ===== Handlers carrito =====
  const addOne = () => {
    if (atMax) return;
    if (!autonomous) return onAdd?.();

    const existing = qtyFromCart;
    if (typeof cart.add === 'function') {
      cart.add({
        productId: product.id,
        name: product.name,
        price: product.price,
        imageUrl: productImageUri,
        stock: (product as any).stock ?? undefined,
        category: (product as any).category ?? null,
      });
    } else if (typeof cart.setQty === 'function') {
      const next =
        effectiveStock == null ? existing + 1 : Math.min(existing + 1, effectiveStock);
      cart.setQty(product.id, next);
    }
  };

  const incOne = () => {
    if (atMax) return;
    if (!autonomous) return onInc?.();

    if (typeof cart.add === 'function') {
      cart.add({
        productId: product.id,
        name: product.name,
        price: product.price,
        imageUrl: productImageUri,
        stock: (product as any).stock ?? undefined,
        category: (product as any).category ?? null,
      });
    } else if (typeof cart.setQty === 'function') {
      const next =
        effectiveStock == null
          ? effectiveQty + 1
          : Math.min(effectiveQty + 1, effectiveStock);
      cart.setQty(product.id, next);
    }
  };

  const decOne = () => {
    if (!autonomous) return onDec?.();
    if (effectiveQty > 1) {
      cart.setQty(product.id, effectiveQty - 1);
    } else {
      if (typeof cart.remove === 'function') cart.remove(product.id);
      else cart.setQty(product.id, 0);
    }
  };

  const removeLine = () => {
    if (!autonomous) return onRemove?.();
    if (typeof cart.remove === 'function') cart.remove(product.id);
    else cart.setQty(product.id, 0);
  };

  // ===== Favoritos =====
  const isFavorite = (product.isFavorite ?? false) || favoriteIds.has(product.id);
  const handleFavorite = () => {
    if (!isAuthenticated) {
      navigation.navigate('Login', { message: 'Inicia sesion para guardar favoritos' });
      return;
    }
    toggleFavorite(product);
  };

  // ===== Casillero =====
  const handleToggleLocker = () => {
    if (!onToggleLocker) return;
    onToggleLocker();
  };

  const goToDetail = () => {
    if (onOpenDetail) return onOpenDetail();
    navigation.navigate('ProductDetail', { id: product.id });
  };

  const remainingStock =
    typeof effectiveStock === 'number'
      ? Math.max(effectiveStock - effectiveQty, 0)
      : null;

  return (
    <View style={styles.card}>
      <Pressable style={{ flex: 1 }} onPress={goToDetail}>
        <View style={styles.imageWrapper}>
          <Image
            source={{ uri: productImageUri }}
            style={styles.image}
            resizeMode="contain" // evita recortes
          />

          {/* Favorito en esquina superior derecha de la imagen */}
          {showFavorite && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                handleFavorite();
              }}
              style={[styles.favBtn, isMutating && { opacity: 0.6 }]}
              hitSlop={8}
              accessibilityLabel={
                isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'
              }
              disabled={isMutating}
            >
              <Ionicons
                name={isFavorite ? 'heart' : 'heart-outline'}
                size={20}
                color={isFavorite ? '#EF4444' : '#111'}
              />
            </Pressable>
          )}

          {/* NUEVO: Casillero en esquina inferior derecha de la imagen */}
          {showLocker && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                handleToggleLocker();
              }}
              style={[
                styles.lockerBtn,
                isInLocker && styles.lockerBtnActive,
              ]}
              hitSlop={8}
              accessibilityLabel={
                isInLocker
                  ? 'Quitar de mi casillero'
                  : 'Agregar a mi casillero'
              }
            >
              <Ionicons
                name={isInLocker ? 'cube' : 'cube-outline'}
                size={18}
                color={isInLocker ? COLORS.green : '#4B5563'}
              />
            </Pressable>
          )}
        </View>

        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>
        <Text style={styles.price}>
          {formatCurrency(product.price)}
        </Text>
        {typeof effectiveStock === 'number' && (
          <Text style={styles.stockHint}>
            Stock: {remainingStock} / {effectiveStock}
          </Text>
        )}
      </Pressable>

      {effectiveQty > 0 ? (
        <>
          <View style={styles.counter}>
            <Pressable
              onPress={effectiveQty === 1 ? removeLine : decOne}
              style={[styles.roundBtn, effectiveQty === 1 && styles.deleteBtn]}
              accessibilityLabel={
                effectiveQty === 1 ? 'Eliminar del carrito' : 'Disminuir'
              }
            >
              {effectiveQty === 1 ? (
                <Ionicons name="trash-outline" size={18} color={COLORS.red} />
              ) : (
                <Ionicons name="remove" size={18} color="#fff" />
              )}
            </Pressable>

            <View style={styles.qtyBox}>
              <Text style={styles.qtyText}>{effectiveQty}</Text>
            </View>

            <Pressable
              onPress={canInc ? incOne : undefined}
              disabled={!canInc}
              style={[styles.roundBtn, !canInc && { opacity: 0.5 }]}
              accessibilityLabel="Aumentar"
            >
              <Ionicons name="add" size={18} color="#fff" />
            </Pressable>
          </View>
          {atMax && <Text style={styles.stockNote}>Sin mas stock</Text>}
        </>
      ) : isOutOfStock ? (
        <View style={[styles.addBtn, { backgroundColor: '#E5E7EB' }]}>
          <Text style={[styles.addText, { color: COLORS.grayText }]}>Agotado</Text>
        </View>
      ) : (
        <Pressable
          onPress={addOne}
          style={styles.addBtn}
          accessibilityLabel={`Agregar ${product.name}`}
        >
          <Ionicons name="add" size={18} color="#FFF" />
          <Text style={styles.addText}>Agregar</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 10,
  },
  imageWrapper: {
    width: '100%',
    height: 138,
    borderRadius: 12,
    backgroundColor: COLORS.bg, // fondo blanco para la “bodeguita”
    overflow: 'hidden',
    position: 'relative',
    marginTop: 6,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  name: { marginTop: 8, color: COLORS.text, fontWeight: '600' },
  price: { color: COLORS.text, marginTop: 4, fontWeight: '800' },
  stockHint: { marginTop: 2, color: COLORS.grayText, fontSize: 12 },

  addBtn: {
    marginTop: 8,
    backgroundColor: COLORS.green,
    borderRadius: 12,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  addText: { color: 'white', textAlign: 'center', fontWeight: '700' },

  counter: {
    marginTop: 8,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.greenLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
  },
  roundBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    backgroundColor: '#FFF4F4',
    borderWidth: 1,
    borderColor: '#FAD1D1',
  },
  qtyBox: {
    minWidth: 44,
    paddingHorizontal: 8,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: { fontWeight: '800', color: COLORS.text },
  stockNote: { marginTop: 4, color: COLORS.grayText, fontSize: 12 },

  favBtn: {
    position: 'absolute',
    right: 8,
    top: 8,
    backgroundColor: '#FFFFFFE6',
    padding: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  lockerBtn: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    backgroundColor: '#FFFFFFE6',
    padding: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  lockerBtnActive: {
    borderColor: COLORS.green,
    backgroundColor: '#E8F3EC',
  },
});

