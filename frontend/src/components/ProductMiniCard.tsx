// frontend/src/components/ProductMiniCard.tsx
import React, { memo, useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import formatCurrency from '../lib/formatCurrency';
import type { FeedItem, PricingView } from '../lib/api';

// Tokens locales (ligeros) para mantener estilo consistente
const spacing = { xs: 8, sm: 12 };
const radius = { md: 12 };
const colors = {
  text: '#111',
  textMuted: '#666',
  bg: '#fff',
  bgAlt: '#F6F7F8',
  border: '#E5E7EB',
  success: '#0EA5E9',
  neutral: '#6B7280',
};

// Alto fijo como en el Feed
const CARD_H = 240;

type Props = {
  item: FeedItem;
  pricingView: PricingView;
  userRole: 'B2B' | 'B2C';
  width: number;
  onPress?: () => void;
  onAddToCart?: () => void;
};

function ProductMiniCardBase({
  item,
  pricingView,
  userRole,
  width,
  onPress,
  onAddToCart,
}: Props) {
  if (!item?.image?.trim()) return null;
  const img = item.image.trim();

  const priceActive = useMemo(() => {
    if (pricingView === 'B2B_DEFAULT') return item.priceB2B;
    if (pricingView === 'B2C_ONLY') return item.priceB2C;
    if (pricingView === 'PUBLIC_REFERENCE') return item.priceB2C;
    if (pricingView === 'COMPARATIVE') {
      return userRole === 'B2B' ? item.priceB2B ?? item.priceB2C : item.priceB2C;
    }
    return undefined;
  }, [pricingView, userRole, item.priceB2B, item.priceB2C]);

  const secondaryLine = useMemo(() => {
    if (pricingView === 'COMPARATIVE' && item.priceB2C && item.priceB2B && userRole === 'B2B') {
      return `Público: ${formatCurrency(item.priceB2C)}`;
    }
    if (pricingView === 'PUBLIC_REFERENCE' && item.priceB2C && userRole === 'B2B') {
      return `Público (ref): ${formatCurrency(item.priceB2C)}`;
    }
    return undefined;
  }, [pricingView, userRole, item.priceB2B, item.priceB2C]);

  const badgeText = useMemo(() => {
    if (pricingView === 'B2B_DEFAULT' && userRole === 'B2B') return 'Tu precio';
    if (pricingView === 'PUBLIC_REFERENCE' && userRole === 'B2B') return 'Precio público';
    if (pricingView === 'COMPARATIVE' && userRole === 'B2B') return 'Tu precio';
    if (pricingView === 'B2C_ONLY') return 'Precio público';
    return undefined;
  }, [pricingView, userRole]);

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
        }}
      >
        <Image
          source={{ uri: img }}
          style={{ width: '100%', height: 130, backgroundColor: colors.bgAlt }}
          contentFit="cover"
          transition={120}
          cachePolicy="memory-disk"
          onError={(e) => {
            console.log('[image error][product]', item.productId, img, e?.nativeEvent);
          }}
        />

        <View style={{ padding: spacing.sm }}>
          {badgeText ? (
            <View
              style={{
                alignSelf: 'flex-start',
                backgroundColor: badgeText === 'Tu precio' ? colors.success : colors.neutral,
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 999,
                marginBottom: 4,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{badgeText}</Text>
            </View>
          ) : null}

          {!!item.title && (
            <Text numberOfLines={1} style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>
              {item.title}
            </Text>
          )}
          {!!item.subtitle && (
            <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
              {item.subtitle}
            </Text>
          )}

          {priceActive !== undefined && (
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 4 }}>
              {formatCurrency(priceActive)}
            </Text>
          )}

          {!!secondaryLine && (
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{secondaryLine}</Text>
          )}
        </View>

        {/* Botón Agregar (overlay) */}
        <TouchableOpacity
          onPress={onAddToCart}
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
      </View>
    </TouchableOpacity>
  );
}

export default memo(ProductMiniCardBase);
