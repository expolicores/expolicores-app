// frontend/src/components/ProductMiniCard.tsx
import React, { memo, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { Image } from 'expo-image';
import formatCurrency from '../lib/formatCurrency';
import { getProductById, type FeedItem, type PricingView } from '../lib/api';

// ---------- UI tokens ----------
const spacing = { xs: 8, sm: 12 };
const radius = { md: 12 };
const colors = {
  text: '#111',
  textMuted: '#666',
  bg: '#fff',
  bgAlt: '#F6F7F8',
  border: '#E5E7EB',
  success: '#10B981',
  neutral: '#6B7280',
  info: '#0EA5E9',
};

// Alto fijo igual que en Feed
const CARD_H = 240;

// ---------- Cache-busting de imágenes ----------
const FEED_BUILD =
  process.env.EXPO_PUBLIC_FEED_BUILD || (Platform.OS === 'web' ? 'web' : 'dev');

function withCacheBust(uri?: string, key?: string | number) {
  if (!uri) return '';
  const v = key ?? FEED_BUILD;
  if (!v) return uri;
  return `${uri}${uri.includes('?') ? '&' : '?'}v=${encodeURIComponent(String(v))}`;
}

// ---------- Cache volátil de producto para completar datos ----------
const productCache = new Map<
  string,
  { name?: string; price?: number; b2bPrice?: number }
>();

type Props = {
  item: FeedItem;

  /** Cómo mostrar precios (misma semántica que en feed) */
  pricingView: PricingView;

  /** Rol del usuario para decidir precio activo */
  userRole: 'B2B' | 'B2C';

  /** Ancho de la tarjeta (el alto es fijo) */
  width: number;

  /** Cantidad actual en el carrito para este item (si 0, se muestra botón Agregar) */
  qty?: number;

  /** Id efectivo si difiere de item.id/productId (por ejemplo por overlay) */
  effectiveProductId?: string;

  /** Overrides desde overlay/promo o desde JSON */
  promoNameOverride?: string;
  promoPriceOverride?: number;

  /** Cache-bust key para la imagen (p.ej. publishedAt o productId) */
  cacheKey?: string | number;

  onPress?: () => void;

  /** Callbacks de carrito (desacoplados) */
  /** +1 (acepta overrides opcionales; si el callback ignora args, no afecta) */
  onAdd?: (opts?: { priceOverride?: number; nameOverride?: string }) => void;
  /** -1 */
  onMinus?: () => void;
  /** quitar línea */
  onRemove?: () => void;
};

function ProductMiniCardBase({
  item,
  pricingView,
  userRole,
  width,
  qty = 0,
  effectiveProductId,
  promoNameOverride,
  promoPriceOverride,
  cacheKey,
  onPress,
  onAdd,
  onMinus,
  onRemove,
}: Props) {
  if (!item?.image?.trim()) return null;

  // Id efectivo del producto para completar datos si faltan
  const baseId = (item as any)?.id ?? (item as any)?.productId;
  const pidStr =
    (effectiveProductId ?? baseId) != null
      ? String(effectiveProductId ?? baseId)
      : undefined;

  // ---------- Lazy price/name desde BD solo si FALTAN en JSON/overlays ----------
  const [fallback, setFallback] = useState<{
    name?: string;
    price?: number;
    b2bPrice?: number;
  } | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!pidStr) return;

    const cached = productCache.get(pidStr);
    if (cached) {
      setFallback(cached);
      return;
    }

    // Solo pedimos a la BD si realmente falta algo:
    const needsName = !item.title && !item.subtitle && !promoNameOverride;
    const needsPrice =
      promoPriceOverride == null &&
      item.priceB2C == null &&
      item.priceB2B == null;

    if (!needsName && !needsPrice) return;

    (async () => {
      try {
        const p = await getProductById(Number(pidStr));
        const payload = { name: p?.name, price: p?.price, b2bPrice: p?.b2bPrice };
        productCache.set(pidStr, payload);
        if (mounted) setFallback(payload);
      } catch {
        // silencioso
      }
    })();

    return () => {
      mounted = false;
    };
  }, [
    pidStr,
    item.title,
    item.subtitle,
    item.priceB2B,
    item.priceB2C,
    promoNameOverride,
    promoPriceOverride,
  ]);

  // Precio activo (prioridad: override > feed/JSON según pricingView > BD fallback)
  const priceActive = useMemo(() => {
    if (typeof promoPriceOverride === 'number') return promoPriceOverride;

    // precios entregados por el feed/JSON
    if (pricingView === 'B2B_DEFAULT') return item.priceB2B;
    if (pricingView === 'B2C_ONLY') return item.priceB2C;
    if (pricingView === 'PUBLIC_REFERENCE') return item.priceB2C;
    if (pricingView === 'COMPARATIVE') {
      return userRole === 'B2B'
        ? item.priceB2B ?? item.priceB2C
        : item.priceB2C;
    }

    // fallback desde BD si lo anterior no resolvió
    if (userRole === 'B2B' && typeof fallback?.b2bPrice === 'number')
      return fallback.b2bPrice;
    if (typeof fallback?.price === 'number') return fallback.price;

    return undefined;
  }, [pricingView, userRole, item.priceB2B, item.priceB2C, promoPriceOverride, fallback]);

  // Precio de referencia secundario (cuando aplica)
  const secondaryLine = useMemo(() => {
    if (promoPriceOverride != null) return undefined;
    const refB2C = item.priceB2C ?? fallback?.price;
    if (pricingView === 'COMPARATIVE' && refB2C && userRole === 'B2B') {
      return `Público: ${formatCurrency(refB2C)}`;
    }
    if (pricingView === 'PUBLIC_REFERENCE' && refB2C && userRole === 'B2B') {
      return `Público (ref): ${formatCurrency(refB2C)}`;
    }
    return undefined;
  }, [pricingView, userRole, item.priceB2C, promoPriceOverride, fallback]);

  const badgeText = useMemo(() => {
    if (promoPriceOverride != null) return 'Promo';
    if (pricingView === 'B2B_DEFAULT' && userRole === 'B2B') return 'Tu precio';
    if (pricingView === 'PUBLIC_REFERENCE' && userRole === 'B2B') return 'Precio público';
    if (pricingView === 'COMPARATIVE' && userRole === 'B2B') return 'Tu precio';
    if (pricingView === 'B2C_ONLY') return 'Precio público';
    return undefined;
  }, [pricingView, userRole, promoPriceOverride]);

  const titleToShow =
    promoNameOverride || item.title || item.subtitle || fallback?.name;

  // Usar el precio resuelto también al AGREGAR
  const handleAdd = () => {
    onAdd?.({
      priceOverride: typeof priceActive === 'number' ? priceActive : undefined,
      nameOverride: titleToShow,
    });
  };

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
      <View
        style={{
          width,
          height: CARD_H,
          backgroundColor: colors.bg,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: 'hidden',
          position: 'relative',
        }}
        pointerEvents="box-none"
      >
        <Image
          source={{ uri: withCacheBust(item.image.trim(), cacheKey ?? pidStr) }}
          style={{ width: '100%', height: 130, backgroundColor: colors.bgAlt }}
          contentFit="cover"
          transition={120}
          cachePolicy="memory-disk"
          onError={(e) => {
            console.log('[image error][product]', pidStr, item.image, e?.nativeEvent);
          }}
        />

        <View style={{ padding: spacing.sm }}>
          {badgeText ? (
            <View
              style={{
                alignSelf: 'flex-start',
                backgroundColor:
                  badgeText === 'Promo'
                    ? colors.info
                    : badgeText === 'Tu precio'
                    ? colors.success
                    : colors.neutral,
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 999,
                marginBottom: 4,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
                {badgeText}
              </Text>
            </View>
          ) : null}

          {!!titleToShow && (
            <Text numberOfLines={1} style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>
              {titleToShow}
            </Text>
          )}

          {priceActive !== undefined && (
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 4 }}>
              {formatCurrency(priceActive)}
            </Text>
          )}

          {!!secondaryLine && (
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
              {secondaryLine}
            </Text>
          )}
        </View>

        {/* Controles de carrito (desacoplados) */}
        {qty > 0 ? (
          <View
            style={{
              position: 'absolute',
              left: 8,
              right: 8,
              bottom: 8,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
            pointerEvents="box-none"
          >
            {/* eliminar / menos */}
            <TouchableOpacity
              onPress={qty <= 1 ? onRemove : onMinus}
              activeOpacity={0.85}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: '#fff',
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: qty <= 1 ? '#ef4444' : colors.text, fontSize: 18, fontWeight: '700' }}>
                {qty <= 1 ? '🗑' : '−'}
              </Text>
            </TouchableOpacity>

            {/* qty */}
            <View
              style={{
                minWidth: 52,
                paddingHorizontal: 12,
                height: 36,
                borderRadius: 10,
                backgroundColor: '#F3F4F6',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ fontWeight: '700', color: colors.text }}>{qty}</Text>
            </View>

            {/* plus (+) */}
            <TouchableOpacity
              onPress={handleAdd}
              activeOpacity={0.9}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: colors.success,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>+</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            onPress={handleAdd}
            activeOpacity={0.85}
            style={{
              position: 'absolute',
              right: 8,
              bottom: 8,
              backgroundColor: '#111',
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 10,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Agregar</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default memo(ProductMiniCardBase);
