// frontend/src/screens/FeedScreen.tsx
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
  Alert,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { getBottomQuickActionsPadding } from '../components/BottomQuickActionsBar';
import {
  fetchFeed,
  getApiBaseUrl,
  getProductById,
  type FeedResponse,
  type FeedSlot,
  type FeedItem,
  type PricingView,
} from '../lib/api';
import { bus } from '../lib/bus';

// ---------- helpers de formato ----------
const formatCOP = (n?: number) =>
  typeof n === 'number'
    ? new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0,
      }).format(n)
    : '';

/** Overlay persistido por AdminPromotionsScreen */
const OVERLAY_KEY = 'published_promos_overlay_v1';
type OverlayItem = {
  id: string;
  name: string;
  productId: string; // numérica como string
  price?: number;
  imageUrl?: string;
  bannerKey?: string;
  publishedAt: number;
};
async function readOverlay(): Promise<OverlayItem[]> {
  try {
    const raw = await AsyncStorage.getItem(OVERLAY_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

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
  success: '#10b981',
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

// ---------- Utils UI ----------
function useTapOnce(cb: () => void, ms = 500) {
  const [disabled, setDisabled] = React.useState(false);
  return () => {
    if (disabled) return;
    setDisabled(true);
    try {
      cb();
    } finally {
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
  const authToken = (user as any)?.token ?? token ?? null;
  const hasToken = !!authToken;
  const rawRole = (user as any)?.role as string | undefined;
  const isAdmin = rawRole === 'ADMIN';
  const isLegacyBusiness = rawRole === 'BUSINESS';
  const isB2BRole = rawRole === 'B2B' || isLegacyBusiness;
  const canSeeBodegaVirtual = B2B_ENABLED && (isB2BRole || isAdmin);
  const bottomPadding = getBottomQuickActionsPadding(insets.bottom);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<FeedResponse | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<OverlayItem[]>([]);
  const FEED_CACHE_KEY = 'feed:last';

  // Cart helpers (tolerante a implementaciones)
  const cartContext = (useCart() as any) ?? {};
  const { addItem, addToCart } = cartContext;
  const addCart = addItem ?? addToCart ?? cartContext?.add;

  const addFromFeed = useCallback(
    async (item: { productId?: string }) => {
      try {
        const pid = Number(item?.productId);
        if (!pid || !Number.isFinite(pid)) throw new Error('Producto inválido');
        const product = await getProductById(pid);
        if (!addCart) throw new Error('Carrito no disponible');

        const attempts: Array<() => any> = [
          () => addCart(product, 1),
          () => addCart(product?.id ?? pid, 1),
          () => addCart(pid, 1),
        ];

        let added = false;
        for (const attempt of attempts) {
          try {
            const result = attempt();
            if (result?.then) await result;
            added = true;
            break;
          } catch {
            // probar siguiente firma
          }
        }

        if (!added) throw new Error('No se pudo agregar al carrito');
      } catch (e: any) {
        console.log('[feed] addFromFeed error', e?.message);
        Alert.alert('No se pudo agregar', e?.message ?? 'Intenta de nuevo');
      }
    },
    [addCart],
  );

  useEffect(() => {
    console.log('API_BASE_URL (axios) =>', getApiBaseUrl());
    console.log('FeedScreen isReady/token?', isReady, hasToken, (user as any)?.role);
  }, [isReady, hasToken, user]);

  const persistFeed = useCallback(async (res: FeedResponse) => {
    try {
      await AsyncStorage.setItem(
        FEED_CACHE_KEY,
        JSON.stringify({ data: res, ts: Date.now() }),
      );
    } catch {}
  }, []);

  const loadFromCache = useCallback(async (): Promise<FeedResponse | null> => {
    try {
      const cached = await AsyncStorage.getItem(FEED_CACHE_KEY);
      if (!cached) return null;
      const parsed = JSON.parse(cached);
      return parsed?.data ?? null;
    } catch {
      return null;
    }
  }, []);

  const reloadOverlay = useCallback(async () => {
    const ov = await readOverlay();
    setOverlay(ov);
  }, []);

  const load = useCallback(async () => {
    try {
      setErrMsg(null);
      const res = await fetchFeed();
      console.log('[feed] fetched slots:', res?.slots?.length ?? 0);
      setData(res);
      persistFeed(res).catch(() => undefined);

      await reloadOverlay();
    } catch (e: any) {
      console.log('[feed] load error ->', e?.status, e?.message);
      setErrMsg(e?.message ?? 'Error');
      const cached = await loadFromCache();
      if (cached) {
        console.log('[feed] using cached feed');
        setData(cached);
      } else {
        setData(null);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [persistFeed, loadFromCache, reloadOverlay]);

  // Arranque cuando la sesión está lista
  useEffect(() => {
    if (!isReady || !hasToken) return;
    setLoading(true);
    load();
  }, [isReady, hasToken, load]);

  // Suscribirse a publicaciones/eliminaciones desde Admin (refrescar overlay al vuelo)
  useEffect(() => {
    const handler = () => reloadOverlay();
    bus.on('promos:updated', handler);
    return () => { bus.off('promos:updated', handler); };
  }, [reloadOverlay]);

  // Reintenta al reenfocar si no hay data
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

  // Deeplinks internos: app://collection/:slug y app://product/:id
  const handleDeeplink = useCallback(
    (url?: string) => {
      if (!url) return;
      try {
        const u = new URL(url);
        const path = u.pathname.startsWith('/') ? u.pathname.slice(1) : u.pathname;

        if (u.host === 'collection' || path.startsWith('collection/')) {
          const slug =
            (u.host === 'collection' ? path : path.replace('collection/', '')) ||
            path.split('/').pop();
          if (slug) navigation.navigate('Catalog', { slug });
          return;
        }
        if (u.host === 'product' || path.startsWith('product/')) {
          const productId =
            (u.host === 'product' ? path : path.replace('product/', '')) ||
            path.split('/').pop();
          if (productId) navigation.navigate('ProductDetail', { productId });
          return;
        }
      } catch {}
    },
    [navigation],
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

  if (!data) {
    return (
      <Centered>
        <Text style={{ color: colors.text, fontSize: 16, marginBottom: spacing.xs }}>
          {errMsg ?? 'No pudimos cargar el feed'}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm }}>
          Base URL: {getApiBaseUrl() || 'n/d'}
        </Text>
        <TouchableOpacity
          onPress={() => {
            setLoading(true);
            load();
          }}
          style={{
            backgroundColor: colors.primary,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
            borderRadius: radius.md,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>Reintentar</Text>
        </TouchableOpacity>
      </Centered>
    );
  }

  const slots = data.slots ?? [];
  const isEmpty = slots.length === 0;

  // ---------- Lista ----------
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {isEmpty ? (
        <Centered>
          <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>
            No hay promociones por ahora
          </Text>
          <Text
            style={{
              color: colors.textMuted,
              fontSize: 12,
              marginBottom: spacing.sm,
              textAlign: 'center',
            }}
          >
            Vuelve más tarde o intenta refrescar.
          </Text>
          <TouchableOpacity
            onPress={onRefresh}
            style={{
              backgroundColor: '#111',
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: 'white', fontWeight: '600' }}>Reintentar</Text>
          </TouchableOpacity>
        </Centered>
      ) : (
        <FlashList
          data={slots}
          keyExtractor={(s) => s.id}
          renderItem={({ item }) => (
            <SlotRenderer
              slot={item}
              userRole={slotUserRole}
              overlay={overlay}
              onDeeplink={handleDeeplink}
              onItemPress={(p) => navigation.navigate('PromoDetail', { promoItem: p })}
              onAddToCart={(p) => addFromFeed(p)}
            />
          )}
          estimatedItemSize={300}
          contentContainerStyle={{ paddingBottom: spacing.xl + bottomPadding }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          removeClippedSubviews
          windowSize={7}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
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
      )}
    </View>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.bg,
        padding: spacing.lg,
      }}
    >
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
      <QuickAccessTiles
        showBodega={showBodega}
        onPressMarket={onPressMarket}
        onPressBodega={onPressBodega}
      />
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
  overlay,
  onDeeplink,
  onItemPress,
  onAddToCart,
}: {
  slot: FeedSlot;
  userRole: 'B2B' | 'B2C';
  overlay: OverlayItem[];
  onDeeplink: (url?: string) => void;
  onItemPress: (p: FeedItem) => void;
  onAddToCart: (p: FeedItem) => void;
}) {
  switch (slot.type) {
    case 'hero':
      return <HeroSlot slot={slot} overlay={overlay} onDeeplink={onDeeplink} onAddToCart={onAddToCart} />;
    case 'collection':
      return (
        <CollectionSlot
          slot={slot}
          userRole={userRole}
          overlay={overlay}
          onItemPress={onItemPress}
          onAddToCart={onAddToCart}
        />
      );
    default:
      return null;
  }
});

// ======================================================================
// Slots
// ======================================================================
const HeroSlot = React.memo(function HeroSlot({
  slot,
  overlay,
  onDeeplink,
  onAddToCart,
}: {
  slot: FeedSlot;
  overlay: OverlayItem[];
  onDeeplink: (url?: string) => void;
  onAddToCart: (p: { productId?: string }) => void;
}) {
  const onCta = useTapOnce(() => {
    const url = slot.cta?.deeplink || 'app://collection/promos-b2c';
    onDeeplink(url);
  });

  const img = (slot.image ?? '').trim();

  // Busca overlay que matchee esta imagen (o el primero como fallback)
  const ov = useMemo(() => {
    if (!img) return overlay[0];
    return overlay.find((o) => o.imageUrl === img) ?? overlay[0];
  }, [overlay, img]);

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

      {/* 👇 Bloque de promo debajo del hero (usando overlay) */}
      {ov?.name ? (
        <View style={{ marginTop: spacing.sm, gap: 6 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
            {ov.name}
          </Text>
          {typeof ov.price === 'number' ? (
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>
              {formatCOP(ov.price)}
            </Text>
          ) : null}
          {!!ov.productId && (
            <TouchableOpacity
              onPress={() => onAddToCart({ productId: ov.productId })}
              style={{
                alignSelf: 'flex-start',
                backgroundColor: '#111',
                paddingHorizontal: spacing.lg,
                paddingVertical: 10,
                borderRadius: radius.md,
              }}
              activeOpacity={0.85}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>Agregar</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}
    </View>
  );
});

const CollectionSlot = React.memo(function CollectionSlot({
  slot,
  userRole,
  overlay,
  onItemPress,
  onAddToCart,
}: {
  slot: FeedSlot;
  userRole: 'B2B' | 'B2C';
  overlay: OverlayItem[];
  onItemPress: (p: FeedItem) => void;
  onAddToCart: (p: FeedItem) => void;
}) {
  const itemsRaw = (slot.items ?? []).filter((it) => !!it.image && !!it.image.trim());

  // Inyectamos overlay: emparejar por imageUrl/productId; fallback al índice
  const items: FeedItem[] = itemsRaw.map((it, idx) => {
    const img = it.image?.trim();
    const pidStr = it.productId != null ? String(it.productId) : undefined;

    const match =
      overlay.find((ov) => (img && ov.imageUrl === img) || (pidStr && ov.productId === pidStr)) ??
      overlay[idx];

    if (!match) return it;

    return {
      ...it,
      title: match.name || it.title,
      productId: match.productId || it.productId,
      priceB2C: typeof match.price === 'number' ? match.price : it.priceB2C,
      image: it.image,
    };
  });

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
              onPress={() => onItemPress(item)}
              onAddToCart={() => onAddToCart(item)}
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
                onPress={() => onItemPress(item)}
                onAddToCart={() => onAddToCart(item)}
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
  onPress,
  onAddToCart,
}: {
  item: FeedItem;
  pricingView: PricingView;
  userRole: 'B2B' | 'B2C';
  width: number;
  onPress: () => void;
  onAddToCart: () => void;
}) {
  if (!item.image || !item.image.trim()) return null;
  const img = item.image.trim();

  const priceActive = useMemo(() => {
    if (typeof item.priceB2C === 'number') return item.priceB2C;
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

  const promoName = item.title || item.subtitle;

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
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
                {badgeText}
              </Text>
            </View>
          ) : null}

          {promoName ? (
            <Text numberOfLines={1} style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>
              {promoName}
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

        {/* Botón Agregar */}
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
