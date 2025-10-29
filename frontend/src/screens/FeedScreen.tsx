import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Dimensions, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';

// ==== TIPOS MINIMOS (si ya creaste src/types/feed.ts, importa desde allí y elimina esto) ====
type PricingView = 'B2C_ONLY'|'B2B_DEFAULT'|'COMPARATIVE'|'PUBLIC_REFERENCE';
type SlotType = 'hero'|'collection'|'nav'|'chips'|'editorial';
type FeedItem = {
  productId?: string;
  title?: string;
  subtitle?: string;
  image?: string;
  badges?: string[];
  priceB2C?: number;
  priceB2B?: number;
};
type FeedSlot = {
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
type FeedResponse = { version: string; updatedAt?: string; timezone?: string; slots: FeedSlot[] };

// ==== CONTEXTO / API ====
import { useAuth } from '../context/AuthContext'; // asegura la ruta
import { API_BASE_URL } from '../lib/api'; // si tienes base; si no, ajusta
async function fetchFeed(token: string): Promise<FeedResponse> {
  const res = await fetch(`${API_BASE_URL}/feed`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Feed fetch failed');
  return res.json();
}

// ==== THEME LIGERO ====
const spacing = { xs: 8, sm: 12, md: 16, lg: 20, xl: 24 };
const radius = { sm: 8, md: 12, lg: 16, xl: 20 };
const colors = {
  primary: '#1F7A8C',
  primaryDark: '#155D6A',
  text: '#111',
  textMuted: '#666',
  bg: '#fff',
  bgAlt: '#F6F7F8',
  border: '#E5E7EB',
  success: '#0EA5E9', // usamos celeste para “Tu precio”
  neutral: '#6B7280',
};

// ==== UTILS ====
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

// ==== FEED SCREEN ====
export default function FeedScreen() {
  const nav = useNavigation<any>();
  const { user } = useAuth(); // esperamos user.token y user.role
  const [data, setData] = useState<FeedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const feed = await fetchFeed(user.token);
      setData(feed);
    } catch (e: any) {
      setError('No pudimos cargar el feed');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user.token]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  if (loading) return <FeedSkeleton />;

  if (error || !data) {
    return (
      <View style={{ flex:1, alignItems:'center', justifyContent:'center', backgroundColor: colors.bg }}>
        <Text style={{ color: colors.text, fontSize: 16, marginBottom: spacing.sm }}>{error ?? 'Sin datos'}</Text>
        <TouchableOpacity onPress={load} style={{ backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.md }}>
          <Text style={{ color: '#fff', fontWeight: '600' }}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlashList
      data={data.slots}
      keyExtractor={(s) => s.id}
      renderItem={({ item }) => <SlotRenderer slot={item} userRole={user.role} />}
      estimatedItemSize={300}
      contentContainerStyle={{ paddingBottom: spacing.xl }}
      ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      removeClippedSubviews
      windowSize={7}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    />
  );
}

// ==== RENDERER POR SLOT ====
const SlotRenderer = React.memo(function SlotRenderer({ slot, userRole }: { slot: FeedSlot; userRole: 'B2B'|'B2C' }) {
  switch (slot.type) {
    case 'hero':
      return <HeroSlot slot={slot} />;
    case 'collection':
      return <CollectionSlot slot={slot} userRole={userRole} />;
    default:
      return null;
  }
});

// ==== HERO SLOT ====
const HeroSlot = React.memo(function HeroSlot({ slot }: { slot: FeedSlot }) {
  return (
    <View style={{ backgroundColor: colors.bg, paddingHorizontal: spacing.md }}>
      {slot.title ? <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: spacing.sm }}>{slot.title}</Text> : null}
      {slot.subtitle ? <Text style={{ fontSize: 14, color: colors.textMuted, marginBottom: spacing.sm }}>{slot.subtitle}</Text> : null}
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
          onPress={() => { /* TODO: resolver deeplink slot.cta.deeplink */ }}
          style={{ alignSelf: 'flex-start', marginTop: spacing.sm, backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.md }}>
          <Text style={{ color: '#fff', fontWeight: '600' }}>{slot.cta.label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
});

// ==== COLLECTION SLOT (grid 2 col / carousel simple) ====
const CollectionSlot = React.memo(function CollectionSlot({ slot, userRole }: { slot: FeedSlot; userRole: 'B2B'|'B2C' }) {
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

// ==== CARD MINI (autónoma, rápida) ====
const ProductMiniCard = React.memo(function ProductMiniCard({
  item, pricingView, userRole, width,
}: { item: FeedItem; pricingView: PricingView; userRole: 'B2B'|'B2C'; width: number }) {

  const priceActive = useMemo(() => {
    if (pricingView === 'B2B_DEFAULT') return item.priceB2B;
    if (pricingView === 'B2C_ONLY')   return item.priceB2C;
    if (pricingView === 'PUBLIC_REFERENCE') {
      return userRole === 'B2B' ? item.priceB2C : item.priceB2C; // B2B ve público como referencia aquí
    }
    if (pricingView === 'COMPARATIVE') {
      // prioridad: si es B2B, mostrar su precio; si no, B2C
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
    // Navegar a detalle si tienes ProductDetailScreen con productId
    // nav.navigate('ProductDetail', { productId: item.productId });
  }, [/* nav, item.productId */]);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
      <View style={{ width, height: CARD_H, backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
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

          {item.title ? <Text numberOfLines={1} style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{item.title}</Text> : null}
          {item.subtitle ? <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{item.subtitle}</Text> : null}

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

// ==== SKELETON ====
function Rect({ w, h, r=12 }: { w: number|string; h: number; r?: number }) {
  return <View style={{ width: w, height: h, borderRadius: r, backgroundColor: colors.bgAlt }} />;
}

function FeedSkeleton() {
  return (
    <View style={{ flex:1, backgroundColor: colors.bg, padding: spacing.md, gap: spacing.md }}>
      {/* Hero */}
      <Rect w={'100%'} h={HERO_H} r={radius.lg} />
      {/* Section title */}
      <Rect w={160} h={18} r={8} />
      {/* Grid rows (2x2) */}
      <View style={{ flexDirection:'row', gap: COL_GAP }}>
        <Rect w={CARD_W} h={CARD_H} />
        <Rect w={CARD_W} h={CARD_H} />
      </View>
      <View style={{ flexDirection:'row', gap: COL_GAP }}>
        <Rect w={CARD_W} h={CARD_H} />
        <Rect w={CARD_W} h={CARD_H} />
      </View>
    </View>
  );
}
