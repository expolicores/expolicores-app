// frontend/src/components/CollectionSlot.tsx
import React, { memo } from 'react';
import { View, Text, Dimensions } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import ProductMiniCard from './ProductMiniCard';
import type { FeedItem, PricingView } from '../lib/api';

type Props = {
  title?: string;
  subtitle?: string;
  items: FeedItem[];
  pricingView: PricingView;
  userRole: 'B2B' | 'B2C';
  layout?: 'grid' | 'carousel';
  columns?: number;               // sólo para grid
  gap?: number;                   // espacio entre tarjetas
  cardWidth?: number;             // opcional si quieres forzar ancho
  onItemPress?: (p: FeedItem) => void;
  onAddToCart?: (p: FeedItem) => void;
};

// Tokens de estilo locales (alineados con FeedScreen)
const spacing = { xs: 8, sm: 12, md: 16 };
const colors = { text: '#111', textMuted: '#666', bg: '#fff' };

const { width: SCREEN_W } = Dimensions.get('window');
const DEFAULT_COLUMNS = 2;
const DEFAULT_GAP = spacing.sm;
const CARD_H = 240;

function CollectionSlotBase({
  title,
  subtitle,
  items,
  pricingView,
  userRole,
  layout = 'grid',
  columns = DEFAULT_COLUMNS,
  gap = DEFAULT_GAP,
  cardWidth,
  onItemPress,
  onAddToCart,
}: Props) {
  const filtered = (items ?? []).filter((it) => !!it?.image?.trim());
  const isCarousel = layout === 'carousel';

  // Cálculo de ancho de tarjeta (igual que en FeedScreen)
  const computedCardWidth =
    cardWidth ??
    Math.floor((SCREEN_W - spacing.md * 2 - gap) / Math.max(1, columns));

  return (
    <View style={{ backgroundColor: colors.bg }}>
      {(title || subtitle) && (
        <View style={{ paddingHorizontal: spacing.md, marginBottom: spacing.sm }}>
          {!!title && (
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>
              {title}
            </Text>
          )}
          {!!subtitle && (
            <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>
              {subtitle}
            </Text>
          )}
        </View>
      )}

      {isCarousel ? (
        <FlashList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={filtered}
          estimatedItemSize={computedCardWidth}
          keyExtractor={(it, idx) => it.productId ?? `i${idx}`}
          contentContainerStyle={{ paddingHorizontal: spacing.md }}
          ItemSeparatorComponent={() => <View style={{ width: gap }} />}
          renderItem={({ item }) => (
            <ProductMiniCard
              item={item}
              pricingView={pricingView}
              userRole={userRole}
              width={computedCardWidth}
              onPress={() => onItemPress?.(item)}
              onAddToCart={() => onAddToCart?.(item)}
            />
          )}
        />
      ) : (
        <FlashList
          data={filtered}
          numColumns={columns}
          keyExtractor={(it, idx) => it.productId ?? `i${idx}`}
          estimatedItemSize={CARD_H}
          contentContainerStyle={{ paddingHorizontal: spacing.md }}
          ItemSeparatorComponent={() => <View style={{ height: gap }} />}
          renderItem={({ item, index }) => (
            <View
              style={{
                width: computedCardWidth,
                marginRight: index % columns === 0 ? gap : 0,
              }}
            >
              <ProductMiniCard
                item={item}
                pricingView={pricingView}
                userRole={userRole}
                width={computedCardWidth}
                onPress={() => onItemPress?.(item)}
                onAddToCart={() => onAddToCart?.(item)}
              />
            </View>
          )}
          removeClippedSubviews
          windowSize={5}
        />
      )}
    </View>
  );
}

export default memo(CollectionSlotBase);
