// src/screens/FeedScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Keyboard,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import { getBottomQuickActionsPadding } from '../components/BottomQuickActionsBar';
import {
  fetchFeed,
  getApiBaseUrl,
  type FeedResponse,
  type FeedSlot,
  type FeedItem,
  type PricingView,
} from '../lib/api';
import { useFavorites } from '../hooks/useFavorites';
import { useActiveOrdersCount } from '../hooks/useActiveOrders';

// 👉 Si tienes un placeholder local, descomenta la línea de abajo y crea assets/placeholder.png (1–3 KB).
// import placeholderImg from '../../assets/placeholder.png';

// ---------- Estilos ----------
const spacing = { xs: 8, sm: 12, md: 16, lg: 20, xl: 24 };
const radius = { sm: 8, md: 12, lg: 16, xl: 20 };
const colors = {
  primary: '#1F7A8C',
  text: '#111',
  textMuted: '#666',
  bg: '#fff',
  bgAlt: '#F6F7F8',
  border: '#E5E7EB',
  success: '#0EA5E9',
  neutral: '#6B7280',
};
const B2B_ENABLED = (process.env.EXPO_PUBLIC_FEATURE_B2B || 'false') === 'true';

// ---------- Layout helpers ----------
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

// ---------- Utils UI ----------
function useTapOnce(cb: () => void, ms = 500) {
  const [disabled, setDisabled] = React.useState(false);
  return () => {
    if (disabled) return;
    setDisabled(true);
    try { cb(); } finally {
      setTimeout(() => setDisabled(false), ms);
    }
  };
}

// ======================================================================
// FEED SCREEN
// ======================================================================
export default function FeedScreen() {
  const { user, token, isReady } = useAuth();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const authToken = user?.token ?? token ?? null;
  const hasToken = !!authToken;
  const rawRole = (user as any)?.role as string | undefined;
  const isAdmin = rawRole === 'ADMIN';
  const isLegacyBusiness = rawRole === 'BUSINESS';
  const isB2BRole = rawRole === 'B2B' || isLegacyBusiness;
  const canSeeBodegaVirtual = B2B_ENABLED && (isB2BRole || isAdmin);
  const bottomPadding = getBottomQuickActionsPadding(insets.bottom);

  const [loading, setLoading] = useState(false); // no arrancar en true
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<FeedResponse | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // Logs de diagnóstico
  useEffect(() => {
    console.log('API_BASE_URL (axios) =>', getApiBaseUrl());
    console.log('FeedScreen isReady/token?', isReady, hasToken, user?.role);
  }, [isReady, hasToken, user?.role]);

  const load = useCallback(async () => {
    try {
      setErrMsg(null);
      const res = await fetchFeed();
      console.log('[feed] fetched slots:', res?.slots?.length ?? 0);
      setData(res);
    } catch (e: any) {
      console.log('[feed] load error ->', e?.status, e?.message);
      setErrMsg(e?.message ?? 'Error');
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Dispara SOLO cuando la sesión está lista y hay token
  useEffect(() => {
    if (!isReady || !hasToken) return;
    setLoading(true);
    load();
  }, [isReady, hasToken, load]);

  // Reintenta al enfocar (por si el token llegó después)
  useFocusEffect(
    useCallback(() => {
      if (isReady && hasToken && !data && !loading) {
        setLoading(true);
        load();
      }
    }, [isReady, hasToken, data, loading, load]),
  );

  const onRefresh = useCallback(() => {
    if (!isReady || !hasToken) return;
    setRefreshing(true);
    load();
  }, [isReady, hasToken, load]);

  const handleSearchSubmit = useCallback(
    (term: string) => {
      const value = term.trim();
      if (!value) return;
      navigation.navigate(canSeeBodegaVirtual ? 'Bodega' : 'Market', {
        initialQuery: value,
        searchToken: Date.now(),
      });
    },
    [navigation, canSeeBodegaVirtual],
  );
  const slotUserRole: 'B2B' | 'B2C' = isB2BRole || isAdmin ? 'B2B' : 'B2C';

  // ---------- Estados ----------
  if (!isReady) {
    return (
      <Centered>
        <ActivityIndicator color={colors.primary} />
        <Text style={{ marginTop: 8, color: colors.textMuted }}>Preparando tu sesión…</Text>
      </Centered>
    );
  }

  if (!hasToken) {
    return (
      <Centered>
        <Text style={{ color: colors.text }}>Inicia sesión para ver el feed.</Text>
      </Centered>
    );
  }

  if (loading && !data) return <FeedSkeleton />;

  if (errMsg || !data) {
    return (
      <Centered>
        <Text style={{ color: colors.text, fontSize: 16, marginBottom: spacing.xs }}>
          {errMsg ?? 'No pudimos cargar el feed'}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm }}>
          Base URL: {getApiBaseUrl() || 'n/d'}
        </Text>
        <TouchableOpacity
          onPress={() => { setLoading(true); load(); }}
          style={{ backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.md }}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>Reintentar</Text>
        </TouchableOpacity>
      </Centered>
    );
  }

  // ---------- Lista ----------
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlashList
        data={data.slots}
        keyExtractor={(s) => s.id}
        renderItem={({ item }) => (
          <SlotRenderer slot={item} userRole={slotUserRole} />
        )}
        estimatedItemSize={300}
        contentContainerStyle={{ paddingBottom: spacing.xl + bottomPadding }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        removeClippedSubviews
        windowSize={7}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <FeedHeader
            showBodega={canSeeBodegaVirtual}
            onPressMarket={() => navigation.navigate('Market')}
            onPressBodega={() => navigation.navigate('Bodega')}
            onSubmitSearch={handleSearchSubmit}
            isB2BSearch={canSeeBodegaVirtual}
          />
        }
        ListFooterComponent={
          loading ? (
            <View style={{ padding: spacing.md }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null
        }
      />
    </View>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: spacing.lg }}>
      {children}
    </View>
  );
}

const FeedHeader = React.memo(function FeedHeader({
  showBodega,
  onPressMarket,
  onPressBodega,
  onSubmitSearch,
  isB2BSearch,
}: {
  showBodega: boolean;
  onPressMarket: () => void;
  onPressBodega: () => void;
  onSubmitSearch: (value: string) => void;
  isB2BSearch: boolean;
}) {
  return (
    <View
      style={{
        backgroundColor: colors.bg,
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
        paddingBottom: spacing.md,
        marginBottom: spacing.md,
        gap: spacing.md,
      }}
    >
      <HomeSearchBar onSubmit={onSubmitSearch} isB2B={isB2BSearch} />
      <QuickAccessTiles showBodega={showBodega} onPressMarket={onPressMarket} onPressBodega={onPressBodega} />
    </View>
  );
});

const HomeSearchBar = React.memo(function HomeSearchBar({
  onSubmit,
  isB2B,
}: {
  onSubmit: (value: string) => void;
  isB2B: boolean;
}) {
  const [value, setValue] = React.useState('');

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue('');
    Keyboard.dismiss();
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        borderRadius: 20,
        paddingHorizontal: spacing.md,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: colors.border,
        gap: spacing.sm,
      }}
    >
      <Ionicons name="search" size={18} color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder={isB2B ? 'Busca en Bodega Virtual' : 'Busca productos'}
        placeholderTextColor={colors.textMuted}
        style={{ flex: 1, color: colors.text, fontSize: 15 }}
        returnKeyType="search"
        onSubmitEditing={handleSubmit}
      />
    </View>
  );
});

const QuickAccessTiles = React.memo(function QuickAccessTiles({
  showBodega,
  onPressMarket,
  onPressBodega,
}: {
  showBodega: boolean;
  onPressMarket: () => void;
  onPressBodega?: () => void;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
      <TouchableOpacity
        onPress={onPressMarket}
        activeOpacity={0.85}
        style={{
          flex: 1,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: '#F0FFF4',
          padding: spacing.md,
        }}
      >
        <Ionicons name="basket-outline" size={28} color="#0E8A3A" />
        <Text style={{ marginTop: spacing.xs, color: colors.text, fontWeight: '700', fontSize: 15 }}>
          Mercado
        </Text>
        <Text style={{ marginTop: 4, color: colors.textMuted, fontSize: 12 }}>Compra ahora</Text>
      </TouchableOpacity>

      {showBodega ? (
        <TouchableOpacity
          onPress={() => onPressBodega?.()}
          activeOpacity={0.85}
          style={{
            flex: 1,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: '#EEF2FF',
            padding: spacing.md,
          }}
        >
          <Ionicons name="business-outline" size={28} color="#4338CA" />
          <Text style={{ marginTop: spacing.xs, color: colors.text, fontWeight: '700', fontSize: 15 }}>
            Bodega Virtual
          </Text>
          <Text style={{ marginTop: 4, color: colors.textMuted, fontSize: 12 }}>Mayorista</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
});

// ======================================================================
// Slot renderer
// ======================================================================
const SlotRenderer = React.memo(function SlotRenderer({
  slot,
  userRole,
}: {
  slot: FeedSlot;
  userRole: 'B2B' | 'B2C';
}) {
  switch (slot.type) {
    case 'hero':
      return <HeroSlot slot={slot} />;
    case 'collection':
      return <CollectionSlot slot={slot} userRole={userRole} />;
    default:
      return null;
  }
});

// ======================================================================
// Slots
// ======================================================================
const HeroSlot = React.memo(function HeroSlot({ slot }: { slot: FeedSlot }) {
  const onCta = useTapOnce(() => {
    console.log('[hero] cta', slot.cta?.deeplink);
    // TODO: manejar deeplink si aplica
  });

  const img = (slot.image ?? '').trim();

  return (
    <View style={{ backgroundColor: colors.bg, paddingHorizontal: spacing.md }}>
      {slot.title ? (
        <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 4 }}>
          {slot.title}
        </Text>
      ) : null}
      {slot.subtitle ? (
        <Text style={{ fontSize: 14, color: colors.textMuted, marginBottom: spacing.sm }}>
          {slot.subtitle}
        </Text>
      ) : null}
      {img ? (
        <Image
          source={{ uri: img }}
          style={{ width: '100%', height: HERO_H, borderRadius: radius.lg, backgroundColor: colors.bgAlt }}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
          // placeholder={placeholderImg}
          onError={(e) => {
            console.log('[image error][hero]', img, e?.nativeEvent);
          }}
        />
      ) : null}
      {slot.cta?.label ? (
        <TouchableOpacity
          onPress={onCta}
          style={{
            alignSelf: 'flex-start',
            marginTop: spacing.sm,
            backgroundColor: colors.primary,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
            borderRadius: radius.md,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>{slot.cta.label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
});

const CollectionSlot = React.memo(function CollectionSlot({
  slot,
  userRole,
}: {
  slot: FeedSlot;
  userRole: 'B2B' | 'B2C';
}) {
  const items = (slot.items ?? []).filter((it) => !!it.image && !!it.image.trim()); // omitimos items sin imagen
  const isCarousel = slot.layout === 'carousel';

  return (
    <View style={{ backgroundColor: colors.bg }}>
      {(slot.title || slot.subtitle) && (
        <View style={{ paddingHorizontal: spacing.md, marginBottom: spacing.sm }}>
          {slot.title ? (
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>
              {slot.title}
            </Text>
          ) : null}
          {slot.subtitle ? (
            <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>
              {slot.subtitle}
            </Text>
          ) : null}
        </View>
      )}

      {isCarousel ? (
        <FlashList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={items}
          estimatedItemSize={CARD_W}
          keyExtractor={(it, idx) => it.productId ?? `i${idx}`}
          contentContainerStyle={{ paddingHorizontal: spacing.md }}
          ItemSeparatorComponent={() => <View style={{ width: COL_GAP }} />}
          renderItem={({ item }) => (
            <ProductMiniCard
              item={item}
              pricingView={slot.pricingView}
              userRole={userRole}
              width={CARD_W}
            />
          )}
        />
      ) : (
        <FlashList
          data={items}
          numColumns={COLS}
          keyExtractor={(it, idx) => it.productId ?? `i${idx}`}
          estimatedItemSize={CARD_H}
          contentContainerStyle={{ paddingHorizontal: spacing.md }}
          ItemSeparatorComponent={() => <View style={{ height: COL_GAP }} />}
          renderItem={({ item, index }) => (
            <View style={{ width: CARD_W, marginRight: index % COLS === 0 ? COL_GAP : 0 }}>
              <ProductMiniCard
                item={item}
                pricingView={slot.pricingView}
                userRole={userRole}
                width={CARD_W}
              />
            </View>
          )}
          removeClippedSubviews
          windowSize={5}
        />
      )}
    </View>
  );
});

// ======================================================================
// Card
// ======================================================================
const ProductMiniCard = React.memo(function ProductMiniCard({
  item,
  pricingView,
  userRole,
  width,
}: {
  item: FeedItem;
  pricingView: PricingView;
  userRole: 'B2B' | 'B2C';
  width: number;
}) {
  // 🔒 Si no hay URL, no renderizamos la card
  if (!item.image || !item.image.trim()) return null;
  const img = item.image.trim();

  const priceActive = useMemo(() => {
    if (pricingView === 'B2B_DEFAULT') return item.priceB2B;
    if (pricingView === 'B2C_ONLY') return item.priceB2C;
    if (pricingView === 'PUBLIC_REFERENCE') return item.priceB2C;
    if (pricingView === 'COMPARATIVE')
      return userRole === 'B2B' ? item.priceB2B ?? item.priceB2C : item.priceB2C;
    return undefined;
  }, [pricingView, userRole, item.priceB2B, item.priceB2C]);

  const secondaryLine = useMemo(() => {
    if (pricingView === 'COMPARATIVE' && item.priceB2C && item.priceB2B && userRole === 'B2B') {
      return `Público: ${formatCOP(item.priceB2C)}`;
    }
    if (pricingView === 'PUBLIC_REFERENCE' && item.priceB2C && userRole === 'B2B') {
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

  const onPress = useTapOnce(() => {
    console.log('[product] open', item.productId);
    // TODO: navegar a detalle si tienes ProductDetailScreen
  });

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
          // placeholder={placeholderImg}
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
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{secondaryLine}</Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
});

// ======================================================================
// Skeleton
// ======================================================================
function Rect({ w, h, r = 12 }: { w: number | string; h: number; r?: number }) {
  return <View style={{ width: w, height: h, borderRadius: r, backgroundColor: colors.bgAlt }} />;
}

function FeedSkeleton() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.md, gap: spacing.md }}>
      <Rect w={'100%'} h={HERO_H} r={radius.lg} />
      <Rect w={160} h={18} r={8} />
      <View style={{ flexDirection: 'row', gap: COL_GAP }}>
        <Rect w={CARD_W} h={CARD_H} />
        <Rect w={CARD_W} h={CARD_H} />
      </View>
      <View style={{ flexDirection: 'row', gap: COL_GAP }}>
        <Rect w={CARD_W} h={CARD_H} />
        <Rect w={CARD_W} h={CARD_H} />
      </View>
    </View>
  );
}
