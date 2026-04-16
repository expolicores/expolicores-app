// src/components/feed/SlotRenderer.tsx
import React, { useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';

// =====================================================
// 🔹 Tipos mínimos (borra y usa tus imports si ya existen)
// =====================================================
type PricingView = 'B2C_ONLY'|'B2B_DEFAULT'|'COMPARATIVE'|'PUBLIC_REFERENCE';
type SlotType = 'hero'|'collection'|'chips'|'editorial'|'nav';
export type FeedItem = {
  productId?: string;
  title?: string;
  subtitle?: string;
  image?: string;
  badges?: string[];
  // precios opcionales si vienen ya “fijados” desde el feed JSON
  priceB2C?: number;
  priceB2B?: number;
  // navegación para chips/editorial
  deeplink?: string;
};
export type FeedSlot = {
  id: string;
  type: SlotType;
  title?: string;
  subtitle?: string;
  image?: string;
  layout?: 'grid'|'carousel';
  pricingView: PricingView;
  items?: FeedItem[];
  cta?: { label: string; deeplink?: string };
};
// =====================================================

// 🎨 Estilos base (ligeros)
const spacing = { xs: 8, sm: 12, md: 16, lg: 20, xl: 24 };
const radius = { sm: 8, md: 12, lg: 16, xl: 20 };
const colors = {
  primary: '#1F7A8C',
  primaryDark: '#155D6A',
  text: '#111',
  textMuted: '#6B7280',
  bg: '#fff',
  bgAlt: '#F6F7F8',
  border: '#E5E7EB',
  success: '#0EA5E9',   // “Tu precio”
  neutral: '#6B7280',   // “Precio público”
};

const { width: SCREEN_W } = Dimensions.get('window');
const HERO_H = Math.min(280, SCREEN_W * 0.6);
const COL_GAP = spacing.sm;
const COLS = 2;
const CARD_W = Math.floor((SCREEN_W - (spacing.md * 2) - COL_GAP) / COLS);
const CARD_H = 240;

const formatCOP = (n?: number) =>
  typeof n === 'number'
    ? n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
    : undefined;

// =====================================================
// SlotRenderer: export default
// =====================================================
export default function SlotRenderer({
  slot,
  userRole,
  onDeeplink,
}: {
  slot: FeedSlot;
  userRole: 'B2B'|'B2C';
  onDeeplink?: (deeplink?: string) => void;
}) {
  switch (slot.type) {
    case 'hero':
      return <HeroSlot slot={slot} onDeeplink={onDeeplink} />;
    case 'collection':
      return <CollectionSlot slot={slot} userRole={userRole} />;
    case 'chips':
      return <ChipsSlot slot={slot} onDeeplink={onDeeplink} />;
    case 'editorial':
      return <EditorialSlot slot={slot} onDeeplink={onDeeplink} />;
    default:
      return null;
  }
}

// =====================================================
// HERO
// =====================================================
export const HeroSlot = React.memo(function HeroSlot({
  slot,
  onDeeplink,
}: {
  slot: FeedSlot;
  onDeeplink?: (deeplink?: string) => void;
}) {
  return (
    <View style={{ backgroundColor: colors.bg, paddingHorizontal: spacing.md }}>
      {slot.title ? (
        <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 2 }}>
          {slot.title}
        </Text>
      ) : null}
      {slot.subtitle ? (
        <Text style={{ fontSize: 14, color: colors.textMuted, marginBottom: spacing.sm }}>
          {slot.subtitle}
        </Text>
      ) : null}
      {slot.image ? (
        <Image
          source={{ uri: slot.image }}
          style={{ width: '100%', height: HERO_H, borderRadius: radius.lg, backgroundColor: colors.bgAlt }}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
        />
      ) : null}
      {slot.cta?.label ? (
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => onDeeplink?.(slot.cta?.deeplink)}
          style={{
            alignSelf: 'flex-start',
            marginTop: spacing.sm,
            backgroundColor: colors.primary,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
            borderRadius: radius.md,
          }}>
          <Text style={{ color: '#fff', fontWeight: '600' }}>{slot.cta.label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
});

// =====================================================
// COLLECTION (grid o carousel) + MiniCard con lógica de precio
// =====================================================
export const CollectionSlot = React.memo(function CollectionSlot({
  slot, userRole,
}: { slot: FeedSlot; userRole: 'B2B'|'B2C' }) {
  const items = slot.items ?? [];
  const isCarousel = slot.layout === 'carousel';

  return (
    <View style={{ backgroundColor: colors.bg }}>
      {(slot.title || slot.subtitle) && (
        <View style={{ paddingHorizontal: spacing.md, marginBottom: spacing.sm }}>
          {slot.title ? <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>{slot.title}</Text> : null}
          {slot.subtitle ? <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>{slot.subtitle}</Text> : null}
        </View>
      )}

      {isCarousel ? (
        <FlashList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={items}
          estimatedItemSize={CARD_W}
          keyExtractor={(it, idx) => (it.productId ?? `i${idx}`)}
          contentContainerStyle={{ paddingHorizontal: spacing.md }}
          ItemSeparatorComponent={() => <View style={{ width: COL_GAP }} />}
          renderItem={({ item }) => (
            <ProductMiniCard item={item} pricingView={slot.pricingView} userRole={userRole} width={CARD_W} />
          )}
        />
      ) : (
        <FlashList
          data={items}
          numColumns={COLS}
          keyExtractor={(it, idx) => (it.productId ?? `i${idx}`)}
          estimatedItemSize={CARD_H}
          contentContainerStyle={{ paddingHorizontal: spacing.md }}
          ItemSeparatorComponent={() => <View style={{ height: COL_GAP }} />}
          renderItem={({ item, index }) => (
            <View style={{ width: CARD_W, marginRight: (index % COLS === 0) ? COL_GAP : 0 }}>
              <ProductMiniCard item={item} pricingView={slot.pricingView} userRole={userRole} width={CARD_W} />
            </View>
          )}
          removeClippedSubviews
          windowSize={5}
        />
      )}
    </View>
  );
});

const ProductMiniCard = React.memo(function ProductMiniCard({
  item, pricingView, userRole, width,
}: { item: FeedItem; pricingView: PricingView; userRole: 'B2B'|'B2C'; width: number }) {

  const priceActive = useMemo(() => {
    if (pricingView === 'B2B_DEFAULT') return item.priceB2B;
    if (pricingView === 'B2C_ONLY')   return item.priceB2C;
    if (pricingView === 'PUBLIC_REFERENCE') {
      // B2B ve público como referencia; B2C también ve público
      return item.priceB2C;
    }
    if (pricingView === 'COMPARATIVE') {
      // Prioriza “tu precio” para B2B; B2C ve público
      return userRole === 'B2B' ? (item.priceB2B ?? item.priceB2C) : item.priceB2C;
    }
    return undefined;
  }, [pricingView, userRole, item.priceB2B, item.priceB2C]);

  const secondaryLine = useMemo(() => {
    if (pricingView === 'COMPARATIVE' && item.priceB2C && item.priceB2B && userRole === 'B2B') {
      return `Público: ${formatCOP(item.priceB2C)}`;
    }
    if (pricingView === 'PUBLIC_REFERENCE' && userRole === 'B2B' && item.priceB2C) {
      return `Público (ref): ${formatCOP(item.priceB2C)}`;
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

  const onPress = useCallback(() => {
    // TODO: Navegar a detalle si tienes ProductDetailScreen
    // nav.navigate('ProductDetail', { productId: item.productId });
  }, [/* item.productId */]);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
      <View style={{
        width,
        height: CARD_H,
        backgroundColor: colors.bg,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
      }}>
        <Image
          source={{ uri: item.image }}
          style={{ width: '100%', height: 130, backgroundColor: colors.bgAlt }}
          contentFit="cover"
          transition={120}
          cachePolicy="memory-disk"
        />
        <View style={{ padding: spacing.sm }}>
          {badgeText ? (
            <View style={{
              alignSelf: 'flex-start',
              backgroundColor: badgeText === 'Tu precio' ? colors.success : colors.neutral,
              paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, marginBottom: 4
            }}>
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{badgeText}</Text>
            </View>
          ) : null}

          {item.title ? (
            <Text numberOfLines={1} style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>
              {item.title}
            </Text>
          ) : null}
          {item.subtitle ? (
            <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
              {item.subtitle}
            </Text>
          ) : null}

          {priceActive !== undefined ? (
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 4 }}>
              {formatCOP(priceActive)}
            </Text>
          ) : null}

          {secondaryLine ? (
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
              {secondaryLine}
            </Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
});

// =====================================================
// CHIPS (categorías / navegación rápida)
// =====================================================
export const ChipsSlot = React.memo(function ChipsSlot({
  slot, onDeeplink,
}: { slot: FeedSlot; onDeeplink?: (deeplink?: string) => void }) {
  const items = slot.items ?? [];

  if (!items.length) return null;

  return (
    <View style={{ backgroundColor: colors.bg, paddingVertical: spacing.xs }}>
      {slot.title ? (
        <View style={{ paddingHorizontal: spacing.md, marginBottom: spacing.xs }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{slot.title}</Text>
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.xs }}
      >
        {items.map((it, idx) => (
          <TouchableOpacity
            key={it.title ?? `chip-${idx}`}
            onPress={() => onDeeplink?.(it.deeplink)}
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs,
              borderRadius: 999,
              backgroundColor: colors.bgAlt,
              borderWidth: 1,
              borderColor: colors.border,
            }}>
            <Text style={{ color: colors.text, fontSize: 14 }}>
              {it.title ?? 'Ver'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
});

// =====================================================
// EDITORIAL (contenido sin precio, storytelling)
// =====================================================
export const EditorialSlot = React.memo(function EditorialSlot({
  slot, onDeeplink,
}: { slot: FeedSlot; onDeeplink?: (deeplink?: string) => void }) {
  return (
    <View style={{ backgroundColor: colors.bg, paddingHorizontal: spacing.md }}>
      {slot.title ? (
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 4 }}>
          {slot.title}
        </Text>
      ) : null}
      {slot.subtitle ? (
        <Text style={{ fontSize: 14, color: colors.textMuted, marginBottom: spacing.sm }}>
          {slot.subtitle}
        </Text>
      ) : null}
      {slot.image ? (
        <Image
          source={{ uri: slot.image }}
          style={{ width: '100%', height: 180, borderRadius: radius.md, backgroundColor: colors.bgAlt }}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
        />
      ) : null}
      {slot.cta?.label ? (
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => onDeeplink?.(slot.cta?.deeplink)}
          style={{
            alignSelf: 'flex-start',
            marginTop: spacing.sm,
            backgroundColor: colors.primary,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
            borderRadius: radius.md,
          }}>
          <Text style={{ color: '#fff', fontWeight: '600' }}>{slot.cta.label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
});
