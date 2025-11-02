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
  type DimensionValue,
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
  fetchRemoteOverlay,
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

/** Overlay persistido por AdminPromotionsScreen (legacy; hoy usamos remoto) */
const OVERLAY_KEY = 'published_promos_overlay_v1';
type OverlayItem = {
  id: string;
  name: string;
  productId: string; // string (numérica o slug)
  price?: number;
  imageUrl?: string;
  bannerKey?: string;
  publishedAt?: number;
};
async function readOverlay(): Promise<OverlayItem[]> {
  try {
    const raw = await AsyncStorage.getItem(OVERLAY_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    const list: any[] = Array.isArray(arr) ? arr : [];
    return list.map((o) => ({
      ...o,
      imageUrl: o.imageUrl ?? o.image ?? o.img ?? undefined,
      productId: o.productId != null ? String(o.productId) : '',
    }));
  } catch {
    return [];
  }
}

// ---------- helpers de matching (robusto) ----------
function normUrl(u?: string) {
  return (u || '').trim().replace(/\?.*$/, '').toLowerCase();
}
function fileNameFromUrl(u?: string) {
  const nu = normUrl(u);
  const last = nu.split('/').pop() || '';
  const base = last.replace(/\.(jpg|jpeg|png|webp|gif|avif)$/i, '');
  const pruned = base.replace(
    /(-|\.)?(100|200|300|320|360|400|450|480|600|640|720|750|800|900|1080|1200|1440|1536|1600|1920|2048)(@2x|@3x)?$/i,
    '',
  );
  return pruned;
}
function sameImageHeuristic(a?: string, b?: string) {
  const A = normUrl(a);
  const B = normUrl(b);
  if (!A || !B) return false;
  if (A === B) return true;
  const ka = fileNameFromUrl(A);
  const kb = fileNameFromUrl(B);
  if (ka && kb && ka === kb) return true;
  if (A.includes(kb) || B.includes(ka)) return true;
  return false;
}
function findOverlayForItem(
  overlay: OverlayItem[],
  item: { image?: string | null; productId?: string | number | null; id?: string | number | null },
) {
  const img = item?.image ?? undefined;
  const pid =
    (item?.id != null ? String(item.id) : item?.productId != null ? String(item.productId) : '').trim();

  let ov = overlay.find((o) => sameImageHeuristic(o.imageUrl, img));
  if (ov) return ov;

  if (pid) {
    ov = overlay.find((o) => (o.productId || '').trim().toLowerCase() === pid.toLowerCase());
    if (ov) return ov;
  }

  return undefined;
}

// (Temporal) Solo remoto
function mergeOverlayRemoteOnly(_local: OverlayItem[], remote: OverlayItem[]): OverlayItem[] {
  return Array.isArray(remote) ? remote.slice(0, 3) : [];
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
const CARD_W = Math.floor((SCREEN_W - spacing.md * 2 - COL_GAP) / COLS);
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
  const bottomPadding = getBottomQuickActionsPadding(insets.bottom, { isAdmin });

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<FeedResponse | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<OverlayItem[]>([]);
  const FEED_CACHE_KEY = 'feed:last:v2';

  // Cart helpers
  const cartContext = (useCart() as any) ?? {};
  const { addItem, addToCart } = cartContext as any;
  const addCart = addItem ?? addToCart ?? cartContext?.add;

  // 🚚 acepta overrides desde el feed
  const addFromFeed = useCallback(
    async (item: { productId?: string; priceOverride?: number; nameOverride?: string }) => {
      try {
        const pid = Number(item?.productId);
        if (!pid || !Number.isFinite(pid)) throw new Error('Producto inválido');
        const product = await getProductById(pid);
        if (!addCart) throw new Error('Carrito no disponible');

        const opts = {
          priceOverride: typeof item.priceOverride === 'number' ? item.priceOverride : undefined,
          nameOverride:
            item.nameOverride && String(item.nameOverride).trim().length
              ? String(item.nameOverride).trim()
              : undefined,
        };

        const attempts: Array<() => any> = [
          () => addCart(product, 1, opts),
          () => addCart(product?.id ?? pid, 1, opts),
          () => addCart(pid, 1, opts),
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
          } catch {}
        }

        if (!added) throw new Error('No se pudo agregar al carrito');
      } catch (e: any) {
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
      await AsyncStorage.setItem(FEED_CACHE_KEY, JSON.stringify({ data: res, ts: Date.now() }));
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

  // 🔄 carga overlay REMOTO (solo) — ADMIN se trata como B2C
  const reloadOverlay = useCallback(async () => {
    const audience: 'B2C' | 'B2B' = isB2BRole ? 'B2B' : 'B2C';
    let remote: OverlayItem[] = [];
    try {
      const r = await fetchRemoteOverlay(audience);
      remote = (Array.isArray(r) ? r : []).map((o: any) => ({
        ...o,
        productId: o.productId != null ? String(o.productId) : '',
        imageUrl: o.imageUrl ?? o.image ?? o.img ?? undefined,
      }));
    } catch (e: any) {
      console.log('[overlay] remote fetch failed', e?.message);
    }
    const merged = mergeOverlayRemoteOnly([], remote);
    setOverlay(merged);
  }, [isB2BRole]);

  const load = useCallback(async () => {
    try {
      setErrMsg(null);
      const res = await fetchFeed();
      setData(res);
      persistFeed(res).catch(() => undefined);
      await reloadOverlay();
    } catch (e: any) {
      setErrMsg(e?.message ?? 'Error');
      const cached = await loadFromCache();
      if (cached) {
        setData(cached);
      } else {
        setData(null);
      }
      await reloadOverlay();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [persistFeed, loadFromCache, reloadOverlay]);

  // Arranque cuando la sesión está lista
  useEffect(() => {
    if (!isReady || !hasToken) return;
    setLoading(true);
    reloadOverlay().finally(() => load());
  }, [isReady, hasToken, load, reloadOverlay]);

  // Suscripción a cambios de promociones (overlay)
  useEffect(() => {
    const handler = () => reloadOverlay();
    bus.on('promos:updated', handler);
    bus.on('promos:changed', handler);
    return () => {
      bus.off('promos:updated', handler);
      bus.off('promos:changed', handler);
    };
  }, [reloadOverlay]);

  // Reintento al foco si no hay data
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

  const clearLocalCaches = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(OVERLAY_KEY);
      await AsyncStorage.removeItem(FEED_CACHE_KEY);
      setOverlay([]);
      setData(null);
      setRefreshing(true);
      await load();
      Alert.alert('Listo', 'Caché local limpiada y feed recargado.');
    } catch (e: any) {
      Alert.alert('Ups', e?.message ?? 'No se pudo limpiar caché');
    } finally {
      setRefreshing(false);
    }
  }, [load]);

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

  // Deeplinks internos
  const handleDeeplink = useCallback(
    (url?: string) => {
      if (!url) return;
      try {
        const u = new URL(url);
        thePath: {
          const path = u.pathname.startsWith('/') ? u.pathname.slice(1) : u.pathname;

          if (u.host === 'collection' || path.startsWith('collection/')) {
            const slug =
              (u.host === 'collection' ? path : path.replace('collection/', '')) ||
              path.split('/').pop();
            if (slug) navigation.navigate('Catalog', { slug });
            break thePath;
          }
          if (u.host === 'product' || path.startsWith('product/')) {
            const productId =
              (u.host === 'product' ? path : path.replace('product/', '')) ||
              path.split('/').pop();
            if (productId) navigation.navigate('ProductDetail', { productId });
            break thePath;
          }
        }
      } catch {}
    },
    [navigation],
  );

  // ⚠️ ADMIN no fuerza B2B para overlays/slots
  const slotUserRole: 'B2B' | 'B2C' = isB2BRole ? 'B2B' : 'B2C';

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
        {__DEV__ && (
          <TouchableOpacity
            onPress={clearLocalCaches}
            style={{ marginTop: spacing.md, padding: spacing.sm, backgroundColor: '#111', borderRadius: 10 }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Limpiar caché</Text>
          </TouchableOpacity>
        )}
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
        <>
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
                onAddToCart={(p) => addFromFeed(p as any)}
              />
            )}
            // @ts-ignore typings viejos
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

          {/* Botón dev flotante */}
          {__DEV__ && (
            <TouchableOpacity
              onPress={clearLocalCaches}
              activeOpacity={0.85}
              style={{
                position: 'absolute',
                right: 12,
                bottom: 12,
                backgroundColor: '#111',
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 14,
                shadowColor: '#000',
                shadowOpacity: 0.2,
                shadowRadius: 8,
                elevation: 4,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Limpiar caché</Text>
            </TouchableOpacity>
          )}
        </>
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
type AddToCartPayload = { productId?: string; priceOverride?: number; nameOverride?: string };

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
  onAddToCart: (p: AddToCartPayload) => void;
}) {
  switch (slot.type) {
    case 'hero':
      return (
        <HeroSlot
          slot={slot}
          overlay={overlay}
          onDeeplink={onDeeplink}
          onAddToCart={onAddToCart}
        />
      );
    case 'collection':
      return (
        <CollectionSlot
          slot={slot}
          userRole={userRole}
          overlay={overlay}
          onItemPress={onItemPress}
          onAddToCart={(p) => onAddToCart(p)}
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
  onAddToCart: (p: AddToCartPayload) => void;
}) {
  const onCta = useTapOnce(() => {
    const url = slot.cta?.deeplink || 'app://collection/promos-b2c';
    onDeeplink(url);
  });

  const img = (slot.image ?? '').trim();
  const heroImg = normUrl(img);
  const slotBannerKey = (slot as any)?.bannerKey as string | undefined;

  const ov =
    (slotBannerKey && overlay.find((o) => o.bannerKey === slotBannerKey)) ||
    overlay.find((o) => sameImageHeuristic(o.imageUrl, heroImg)) ||
    undefined;

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
          onError={(err) => {
            console.log('[image error][hero]', img, err);
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

      {/* Bloque de promo debajo del hero */}
      {ov?.name ? (
        <View style={{ marginTop: spacing.sm, gap: 6 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{ov.name}</Text>
          {typeof ov.price === 'number' ? (
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>
              {formatCOP(ov.price)}
            </Text>
          ) : null}
          {!!ov.productId && (
            <TouchableOpacity
              onPress={() =>
                onAddToCart({
                  productId: ov.productId,
                  priceOverride: ov.price,
                  nameOverride: ov.name,
                })
              }
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
  onAddToCart: (p: AddToCartPayload) => void;
}) {
  const itemsRaw = (slot.items ?? []).filter((it) => !!it.image && !!it.image.trim());

  const itemsWithOverrides = itemsRaw.map((it) => {
    const ov = findOverlayForItem(overlay, {
      image: it.image,
      productId: (it as any).productId,
      id: (it as any).id,
    });

    const effectiveProductId =
      (it as any).id != null
        ? String((it as any).id)
        : (it as any).productId != null
        ? String((it as any).productId)
        : undefined;

    return {
      item: { ...it, productId: effectiveProductId },
      promoNameOverride: ov?.name,
      promoPriceOverride: typeof ov?.price === 'number' ? ov.price : undefined,
      promoProductIdOverride: ov?.productId ?? effectiveProductId,
      effectiveId: ov?.productId ?? effectiveProductId,
    };
  });

  const isCarousel = slot.layout === 'carousel';

  return (
    <View style={{ backgroundColor: colors.bg }}>
      {(slot.title || slot.subtitle) && (
        <View style={{ paddingHorizontal: spacing.md, marginBottom: spacing.sm }}>
          {slot.title ? (
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>{slot.title}</Text>
          ) : null}
          {slot.subtitle ? (
            <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>{slot.subtitle}</Text>
          ) : null}
        </View>
      )}

      {isCarousel ? (
        <FlashList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={itemsWithOverrides}
          // @ts-ignore typings viejos
          estimatedItemSize={CARD_W}
          keyExtractor={(row, idx) =>
            (row.item.productId as any) ?? ((row.item as any).id as any) ?? `i${idx}`
          }
          contentContainerStyle={{ paddingHorizontal: spacing.md }}
          ItemSeparatorComponent={() => <View style={{ width: COL_GAP }} />}
          renderItem={({ item: row }) => {
            const productIdEffective = row.effectiveId ?? row.promoProductIdOverride ?? row.item.productId;
            const itemForCard: FeedItem = { ...row.item, productId: productIdEffective as any };
            return (
              <ProductMiniCard
                item={itemForCard}
                pricingView={slot.pricingView}
                userRole={userRole}
                width={CARD_W}
                promoNameOverride={row.promoNameOverride}
                promoPriceOverride={row.promoPriceOverride}
                effectiveProductId={productIdEffective as any}
                onPress={() => onItemPress(row.item)}
                onAddToCart={() =>
                  onAddToCart({
                    productId: productIdEffective as any,
                    priceOverride: row.promoPriceOverride,
                    nameOverride: row.promoNameOverride,
                  })
                }
              />
            );
          }}
        />
      ) : (
        <FlashList
          data={itemsWithOverrides}
          numColumns={COLS}
          keyExtractor={(row, idx) =>
            (row.item.productId as any) ?? ((row.item as any).id as any) ?? `i${idx}`
          }
          // @ts-ignore typings viejos
          estimatedItemSize={CARD_H}
          contentContainerStyle={{ paddingHorizontal: spacing.md }}
          ItemSeparatorComponent={() => <View style={{ height: COL_GAP }} />}
          renderItem={({ item: row, index }) => {
            const productIdEffective = row.effectiveId ?? row.promoProductIdOverride ?? row.item.productId;
            const itemForCard: FeedItem = { ...row.item, productId: productIdEffective as any };
            return (
              <View style={{ width: CARD_W, marginRight: index % COLS === 0 ? COL_GAP : 0 }}>
                <ProductMiniCard
                  item={itemForCard}
                  pricingView={slot.pricingView}
                  userRole={userRole}
                  width={CARD_W}
                  promoNameOverride={row.promoNameOverride}
                  promoPriceOverride={row.promoPriceOverride}
                  effectiveProductId={productIdEffective as any}
                  onPress={() => onItemPress(row.item)}
                  onAddToCart={() =>
                    onAddToCart({
                      productId: productIdEffective as any,
                      priceOverride: row.promoPriceOverride,
                      nameOverride: row.promoNameOverride,
                    })
                  }
                />
              </View>
            );
          }}
          removeClippedSubviews
          windowSize={5}
        />
      )}
    </View>
  );
});

// ======================================================================
// Card (con controles dinámicos estilo Catálogo)
// ======================================================================
const ProductMiniCard = React.memo(function ProductMiniCard({
  item,
  pricingView,
  userRole,
  width,
  promoNameOverride,
  promoPriceOverride,
  effectiveProductId,
  onPress,
  onAddToCart,
}: {
  item: FeedItem;
  pricingView: PricingView;
  userRole: 'B2B' | 'B2C';
  width: number;
  promoNameOverride?: string;
  promoPriceOverride?: number;
  effectiveProductId?: string;
  onPress: () => void;
  onAddToCart: () => void;
}) {
  if (!item.image || !item.image.trim()) return null;
  const img = item.image.trim();

  // id efectivo
  const baseId = (item as any)?.id ?? (item as any)?.productId;
  const pidStr = (effectiveProductId ?? baseId) != null ? String(effectiveProductId ?? baseId) : undefined;
  const pidNum = pidStr ? Number(pidStr) : NaN;
  const pidKey: any = Number.isFinite(pidNum) ? pidNum : pidStr;

  // Cart
  const cart = (useCart() as any) ?? {};
  const cartItems: Array<any> = cart?.items ?? cart?.lines ?? [];
  const qty = useMemo(() => {
    if (!pidStr) return 0;
    const line = cartItems.find((l) => String(l?.productId ?? l?.id) === String(pidStr));
    return Number(line?.qty ?? 0);
  }, [cartItems, pidStr]);

  const tryDecrement = () => {
    if (!pidStr) return;
    const next = Math.max(0, qty - 1);
    const attempts: Array<() => any> = [
      () => cart.addItem?.(pidKey, -1),
      () => cart.decrement?.(pidKey),
      () => cart.updateQty?.(pidKey, next),
      () => cart.setQty?.(pidKey, next),
      () => (qty <= 1 ? cart.removeItem?.(pidKey) : undefined),
    ];
    for (const fn of attempts) {
      try {
        const r = fn?.();
        if (r?.then) return r;
        return;
      } catch {}
    }
  };

  const tryRemove = () => {
    if (!pidStr) return;
    const attempts: Array<() => any> = [
      () => cart.removeItem?.(pidKey),
      () => cart.updateQty?.(pidKey, 0),
      () => cart.setQty?.(pidKey, 0),
    ];
    for (const fn of attempts) {
      try {
        const r = fn?.();
        if (r?.then) return r;
        return;
      } catch {}
    }
  };

  const handlePlus = () => {
    onAddToCart();
  };

  // Precio activo (respeta override)
  const priceActive = useMemo(() => {
    if (typeof promoPriceOverride === 'number') return promoPriceOverride;
    if (typeof item.priceB2C === 'number') return item.priceB2C;
    if (pricingView === 'B2B_DEFAULT') return item.priceB2B;
    if (pricingView === 'B2C_ONLY') return item.priceB2C;
    if (pricingView === 'PUBLIC_REFERENCE') return item.priceB2C;
    if (pricingView === 'COMPARATIVE')
      return userRole === 'B2B' ? item.priceB2B ?? item.priceB2C : item.priceB2C;
    return undefined;
  }, [pricingView, userRole, item.priceB2B, item.priceB2C, promoPriceOverride]);

  const secondaryLine = useMemo(() => {
    if (promoPriceOverride != null) return undefined;
    if (pricingView === 'COMPARATIVE' && item.priceB2C && item.priceB2B && userRole === 'B2B') {
      return `Público: ${formatCOP(item.priceB2C)}`;
    }
    if (pricingView === 'PUBLIC_REFERENCE' && item.priceB2C && userRole === 'B2B') {
      return `Público (ref): ${formatCOP(item.priceB2C)}`;
    }
    return undefined;
  }, [pricingView, userRole, item.priceB2B, item.priceB2C, promoPriceOverride]);

  const badgeText = useMemo(() => {
    if (promoPriceOverride != null) return 'Promo';
    if (pricingView === 'B2B_DEFAULT' && userRole === 'B2B') return 'Tu precio';
    if (pricingView === 'PUBLIC_REFERENCE' && userRole === 'B2B') return 'Precio público';
    if (pricingView === 'COMPARATIVE' && userRole === 'B2B') return 'Tu precio';
    if (pricingView === 'B2C_ONLY') return 'Precio público';
    return undefined;
  }, [pricingView, userRole, promoPriceOverride]);

  const promoName = promoNameOverride || item.title || item.subtitle;

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
          source={{ uri: img }}
          style={{ width: '100%', height: 130, backgroundColor: colors.bgAlt }}
          contentFit="cover"
          transition={120}
          cachePolicy="memory-disk"
          onError={(err) => {
            console.log('[image error][product]', pidStr, img, err);
          }}
        />

        <View style={{ padding: spacing.sm }}>
          {badgeText ? (
            <View
              style={{
                alignSelf: 'flex-start',
                backgroundColor:
                  badgeText === 'Promo' ? '#0EA5E9' : badgeText === 'Tu precio' ? colors.success : colors.neutral,
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 999,
                marginBottom: 4,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{badgeText}</Text>
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
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{secondaryLine}</Text>
          ) : null}
        </View>

        {/* Controles de carrito estilo Catálogo */}
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
              onPress={qty <= 1 ? tryRemove : tryDecrement}
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
              {qty <= 1 ? (
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
              ) : (
                <Ionicons name="remove" size={18} color={colors.text} />
              )}
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
              onPress={handlePlus}
              activeOpacity={0.9}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: '#10B981',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="add" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            onPress={handlePlus}
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
});

// ======================================================================
// Skeleton
// ======================================================================
function Rect({ w, h, r = 12 }: { w: number | `${number}%`; h: number; r?: number }) {
  return <View style={{ width: w as DimensionValue, height: h, borderRadius: r, backgroundColor: colors.bgAlt }} />;
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
