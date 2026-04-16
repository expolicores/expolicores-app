// frontend/src/screens/AdminPromotionsScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Alert,
  Image,
  Platform,
  type TextInputProps,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { getBottomQuickActionsPadding } from '../components/BottomQuickActionsBar';
import { useAuth } from '../context/AuthContext';
import { api, fetchAdminPromotions, type AdminPromotion, fetchFeed, type FeedResponse } from '../lib/api';
import { bus } from '../lib/bus';

type PromoType = 'PRICE_OVERRIDE' | 'PERCENT_OFF' | 'X_FOR_Y' | 'GIFT_WITH_PURCHASE';

// 👇 ahora tenemos 4 slots (y además dinámico según el JSON del feed)
const MAX_PUBLISHED = 4;

// Overlay local “publicadas”
const OVERLAY_PUBLISHED_KEY = 'published_promos_overlay_v1';
// “Tombstones” locales para eliminadas
const OVERLAY_DELETED_KEY = 'deleted_promos_overlay_v1';

// Claves de caché que podemos limpiar
const CACHE_KEYS_TO_CLEAR = ['published_promos_overlay_v1', 'feed:last', 'feed:last:v2'];

// Descubrimos candidatos de banners desde el feed (dinámico)
type BannerCandidate = {
  key: string;          // bannerKey sugerido
  imageUrl?: string;    // preview
  source: 'hero' | 'collection' | 'item' | 'manual';
};

type OverlayPublished = {
  id: string;
  name: string;
  productId: string; // numeric string
  price?: number;
  imageUrl?: string;
  bannerKey?: string;
  publishedAt: number;
};

type ComponentRow = { productId: string; qtyStr: string };

const baseInputStyle = {
  borderWidth: 1,
  borderColor: '#ddd',
  borderRadius: 8,
  padding: Platform.OS === 'ios' ? 12 : 10,
  color: '#111',
};

function FormInput({
  style,
  placeholderTextColor,
  ...rest
}: TextInputProps) {
  return (
    <TextInput
      {...rest}
      placeholderTextColor={placeholderTextColor ?? '#9CA3AF'}
      style={[baseInputStyle, style]}
    />
  );
}

async function readPublished(): Promise<OverlayPublished[]> {
  try {
    const raw = await AsyncStorage.getItem(OVERLAY_PUBLISHED_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
async function writePublished(items: OverlayPublished[]) {
  await AsyncStorage.setItem(OVERLAY_PUBLISHED_KEY, JSON.stringify(items));
}
async function upsertPublished(item: OverlayPublished) {
  const list = await readPublished();
  const idx = list.findIndex((x) => x.id === item.id);
  const next =
    idx >= 0
      ? list.map((x, i) => (i === idx ? { ...x, ...item, publishedAt: Date.now() } : x))
      : [{ ...item, publishedAt: Date.now() }, ...list].slice(0, MAX_PUBLISHED);
  await writePublished(next);
  return next;
}
async function removeFromPublished(id: string) {
  const list = await readPublished();
  const next = list.filter((x) => x.id !== id);
  await writePublished(next);
  return next;
}

// Tombstones
async function readDeletedIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(OVERLAY_DELETED_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
async function addDeletedId(id: string) {
  const list = await readDeletedIds();
  if (!list.includes(id)) {
    list.push(id);
    await AsyncStorage.setItem(OVERLAY_DELETED_KEY, JSON.stringify(list));
  }
  return list;
}

// helpers
function uniq<T>(arr: T[], key: (x: T) => string) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of arr) {
    const k = key(it);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

function cacheBust(url?: string, v?: string | number) {
  if (!url) return undefined;
  const token = v ?? Date.now();
  return `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(String(token))}`;
}

export default function AdminPromotionsScreen() {
  const { token, user } = useAuth();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [list, setList] = useState<AdminPromotion[]>([]);
  const [overlayPublished, setOverlayPublished] = useState<OverlayPublished[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Descubiertos desde el feed
  const [feed, setFeed] = useState<FeedResponse | null>(null);
  const [bannerCandidates, setBannerCandidates] = useState<BannerCandidate[]>([]);
  const [manualBanner, setManualBanner] = useState<{ key: string; imageUrl?: string }>({ key: '', imageUrl: '' });

  // ====== FORM ======
  const [form, setForm] = useState<any>({
    name: '',
    type: 'PRICE_OVERRIDE' as PromoType,
    audience: 'B2C',
    priority: 100,
    stacking: false,
    startsAt: new Date().toISOString(),
    endsAt: new Date(Date.now() + 86400000).toISOString(),
    products: [{ productId: '' }], // productId principal (string numérica)
    benefits: {},                  // se rellena según type
    conditions: {},
    bannerKey: '',                 // dinámico; viene de candidatos o manual
    bannerImageUrl: '',            // opcional (para cache bust y mobile)
    // Campos extra (solo UI)
    components: [] as ComponentRow[], // lista editable {productId, qtyStr}
    // X_FOR_Y
    bundleId: '',
    xStr: '',
    yStr: '',
    // GWP
    triggerProductId: '',
    giftProductId: '',
    triggerQtyStr: '1',
  });

  const isAdmin = user?.role === 'ADMIN';
  const bottomPadding = getBottomQuickActionsPadding(insets.bottom, { isAdmin });

  const headers = useMemo(() => {
    const auth = token ? `Bearer ${token}` : undefined;
    const base: Record<string, string> = { 'Content-Type': 'application/json' };
    if (auth) base.Authorization = auth;
    return base;
  }, [token]);

  const discoverBannersFromFeed = useCallback((res: FeedResponse | null) => {
    if (!res) return [];
    const candidates: BannerCandidate[] = [];

    for (const slot of res.slots ?? []) {
      const bk = (slot as any)?.bannerKey as string | undefined;
      if (slot.type === 'hero') {
        if (bk) candidates.push({ key: bk, imageUrl: slot.image ?? undefined, source: 'hero' });
        else if (slot.image) {
          // fallback: filename as key
          const last = slot.image.split('/').pop() ?? '';
          const base = last.replace(/\.(png|jpe?g|webp|gif|avif)$/i, '');
          candidates.push({ key: base, imageUrl: slot.image, source: 'hero' });
        }
      }
      if (slot.type === 'collection') {
        // a nivel de slot
        if (bk && slot.image) {
          candidates.push({ key: bk, imageUrl: slot.image, source: 'collection' });
        }
        // a nivel de items
        for (const it of slot.items ?? []) {
          const kb = (it as any)?.bannerKey as string | undefined;
          if (kb) candidates.push({ key: kb, imageUrl: it.image ?? undefined, source: 'item' });
        }
      }
    }

    // dedup por key, priorizando los que tengan imageUrl
    const ordered = candidates
      .sort((a, b) => Number(!!b.imageUrl) - Number(!!a.imageUrl));
    const unique = uniq(ordered, (c) => c.key.trim().toLowerCase()).filter((c) => !!c.key?.trim());

    return unique;
  }, []);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = !!opts?.silent;
      if (!silent) setLoading(true);
      try {
        const [res, savedPublished, savedDeleted, feedRes] = await Promise.all([
          fetchAdminPromotions(headers),
          readPublished(),
          readDeletedIds(),
          fetchFeed().catch(() => null),
        ]);

        setOverlayPublished(savedPublished);
        setDeletedIds(savedDeleted);
        setFeed(feedRes);

        const cleaned = (res ?? []).filter((p: any) => {
          if (!p) return false;
          const idStr = String(p.id);
          if (savedDeleted.includes(idStr)) return false;
          if (p.deleted === true) return false;
          if (p.isDeleted === true) return false;
          if (p.deletedAt) return false;
          if (p.status && String(p.status).toLowerCase() === 'deleted') return false;
          return true;
        });

        const publishedIds = new Set(savedPublished.map((s) => String(s.id)));
        const merged = cleaned.map((p: any) => ({
          ...p,
          published: !!p.published || publishedIds.has(String(p.id)),
        })) as AdminPromotion[];

        setList(merged);

        const discovered = discoverBannersFromFeed(feedRes);
        setBannerCandidates(discovered);

        return merged;
      } catch (e: any) {
        if (!silent) Alert.alert('No pudimos cargar', e?.message ?? 'Intenta de nuevo');
        throw e;
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [headers, discoverBannersFromFeed],
  );

  useEffect(() => {
    if (isAdmin) load().catch(() => undefined);
  }, [isAdmin, load]);

  const normalizeISO = (v: string) => new Date(v).toISOString();
  const normalizeProductId = (val: any) => String(val ?? '').trim();

  // ====== VALIDACIONES ======
  const validateForm = () => {
    const msgs: string[] = [];
    if (!form.name?.trim()) msgs.push('Falta el nombre');

    if (!['PRICE_OVERRIDE', 'PERCENT_OFF', 'X_FOR_Y', 'GIFT_WITH_PURCHASE'].includes(form.type))
      msgs.push('Tipo inválido');

    if (!form.startsAt || !form.endsAt) msgs.push('Falta vigencia');

    const pid = normalizeProductId(form.products?.[0]?.productId);
    if (!pid) msgs.push('Falta productId');
    if (!/^\d+$/.test(pid)) msgs.push('productId debe ser numérico (string)');

    if (form.type === 'PRICE_OVERRIDE') {
      const price = form.benefits?.price;
      if (!(typeof price === 'number') || price < 0) msgs.push('Precio fijo inválido');
    }
    if (form.type === 'PERCENT_OFF') {
      const p = form.benefits?.percent;
      if (!(typeof p === 'number') || p <= 0 || p >= 100) msgs.push('% descuento inválido (1..99)');
    }
    if (form.type === 'X_FOR_Y') {
      if (!String(form.bundleId || '').trim()) msgs.push('Bundle ID requerido');
      const x = Number(form.xStr);
      const y = Number(form.yStr);
      if (!Number.isInteger(x) || x <= 0) msgs.push('X debe ser entero > 0');
      if (!Number.isInteger(y) || y <= 0) msgs.push('Y debe ser entero > 0');
    }
    if (form.type === 'GIFT_WITH_PURCHASE') {
      if (!String(form.bundleId || '').trim()) msgs.push('Bundle ID requerido');
      if (!String(form.triggerProductId || '').trim()) msgs.push('Trigger productId requerido');
      if (!String(form.giftProductId || '').trim()) msgs.push('Gift productId requerido');
      const tq = Number(form.triggerQtyStr);
      if (!Number.isInteger(tq) || tq <= 0) msgs.push('Qty trigger debe ser entero > 0');
    }
    // BannerKey puede ser vacío (sin banner), pero si pones imageUrl, sugiere bannerKey
    if (form.bannerImageUrl && !form.bannerKey) msgs.push('Si especificas imagen, indica un bannerKey');
    return msgs;
  };

  // ====== GUARDAR ======
  const save = async () => {
    const errors = validateForm();
    if (errors.length) {
      Alert.alert('Revisa el formulario', errors.join('\n'));
      return;
    }
    setSaving(true);
    try {
      // Normaliza componentes opcionales
      const comps =
        (form.components as ComponentRow[])
          ?.map((c) => ({ productId: c.productId.trim(), qty: Number(c.qtyStr) }))
          ?.filter((c) => c.productId && Number.isInteger(c.qty) && c.qty > 0) ?? [];

      const benefits: any = {};

      if (form.type === 'PRICE_OVERRIDE') {
        benefits.price = Number(form.benefits?.price);
      }
      if (form.type === 'PERCENT_OFF') {
        benefits.percent = Number(form.benefits?.percent);
      }
      if (form.type === 'X_FOR_Y') {
        benefits.bundleId = String(form.bundleId).trim();
        benefits.x = Number(form.xStr);
        benefits.y = Number(form.yStr);
        if (comps.length) benefits.components = comps;
      }
      if (form.type === 'GIFT_WITH_PURCHASE') {
        benefits.bundleId = String(form.bundleId).trim();
        benefits.triggerProductId = String(form.triggerProductId).trim();
        benefits.giftProductId = String(form.giftProductId).trim();
        benefits.triggerQty = Number(form.triggerQtyStr || '1');
        if (comps.length) benefits.components = comps;
      }

      const metadata: Record<string, any> | undefined =
        form.bannerKey || form.bannerImageUrl
          ? {
              bannerKey: form.bannerKey || undefined,
              imageUrl: form.bannerImageUrl || undefined,
            }
          : undefined;

      const payload = {
        name: String(form.name).trim(),
        type: form.type as PromoType,
        audience: form.audience ?? 'B2C',
        priority: Number(form.priority ?? 100),
        stacking: !!form.stacking,
        startsAt: normalizeISO(form.startsAt),
        endsAt: normalizeISO(form.endsAt),
        products: [{ productId: normalizeProductId(form.products?.[0]?.productId) }],
        benefits,
        conditions: metadata
          ? {
              ...(form.conditions && Object.keys(form.conditions || {}).length ? form.conditions : {}),
              metadata,
            }
          : (form.conditions && Object.keys(form.conditions || {}).length ? form.conditions : undefined),
      };

      await api.post('/admin/promotions', payload, { headers });

      setModal(false);
      // Limpia campos esenciales del form (deja vigencias y audiencia como estaban)
      setForm((prev: any) => ({
        ...prev,
        name: '',
        products: [{ productId: '' }],
        benefits: {},
        components: [],
        bundleId: '',
        xStr: '',
        yStr: '',
        triggerProductId: '',
        giftProductId: '',
        triggerQtyStr: '1',
        bannerKey: '',
        bannerImageUrl: '',
      }));

      await load();
      bus.emit('promos:updated');
    } catch (e: any) {
      const msg = e?.details?.message || e?.message || 'No pudimos crear la promoción';
      Alert.alert('Error', Array.isArray(msg) ? msg.join('\n') : String(msg));
    } finally {
      setSaving(false);
    }
  };

  // ====== TOGGLE PUBLICAR/PUBLICADO (usa active) ======
  const togglePublish = async (item: AdminPromotion) => {
    const id = String(item.id);
    const nextActive = !item.active;

    // Límite sólo al activar
    const activeCount = list.filter((p) => p.active).length;
    if (nextActive && activeCount >= MAX_PUBLISHED) {
      Alert.alert('Límite alcanzado', `Solo puedes tener ${MAX_PUBLISHED} promociones activas a la vez.`);
      return;
    }

    // Optimista: cambia active en UI
    setList((prev) => prev.map((p) => (String(p.id) === id ? { ...p, active: nextActive } : p)));

    try {
      // 1) Patch active
      await api.patch(`/admin/promotions/${id}`, { active: nextActive }, { headers });

      if (nextActive) {
        // 2) Al activar: llama publish y sube a overlay local
        await api.post(`/admin/promotions/${id}/publish`, {}, { headers });

        // Reconstruye overlay para esta promo
        const fresh = list.find((p) => String(p.id) === id) ?? item;
        const meta = (fresh as any)?.conditions?.metadata ?? {};
        const bannerKey = meta.bannerKey as string | undefined;

        // buscar imagen preferente:
        // 1) conditions.metadata.imageUrl
        // 2) candidato descubierto por bannerKey
        // 3) undefined (sin imagen)
        let imageUrl: string | undefined = meta.imageUrl;
        if (!imageUrl && bannerKey) {
          const found = bannerCandidates.find((c) => c.key.trim().toLowerCase() === bannerKey.trim().toLowerCase());
          imageUrl = found?.imageUrl;
        }

        const productId = String((fresh.products?.[0] as any)?.productId ?? '').trim();
        const price =
          typeof (fresh as any)?.benefits?.price === 'number'
            ? (fresh as any).benefits.price
            : undefined;

        if (productId) {
          const nextPub = await upsertPublished({
            id,
            name: String(fresh.name || 'Promoción'),
            productId,
            price,
            imageUrl,
            bannerKey,
            publishedAt: Date.now(),
          });
          setOverlayPublished(nextPub);
        }
      } else {
        // 3) Al desactivar: quita de overlay local
        const nextPub = await removeFromPublished(id);
        setOverlayPublished(nextPub);
      }

      // Notifica
      bus.emit('promos:updated');
      bus.emit('promos:changed');

      // Revalida lista silenciosa
      await load({ silent: true });
    } catch (e: any) {
      // Rollback visual
      setList((prev) => prev.map((p) => (String(p.id) === id ? { ...p, active: !nextActive } : p)));
      const msg = e?.details?.message || e?.message || 'No se pudo cambiar el estado';
      Alert.alert('Error', String(msg));
    }
  };

  // ====== ELIMINAR ======
  const removePromotion = (id: string | number) => {
    const idStr = String(id);
    Alert.alert(
      'Eliminar promoción',
      'Esta acción no se puede deshacer. ¿Deseas continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            // Optimista
            setList((p) => p.filter((x) => String(x.id) !== idStr));

            try {
              await api.delete(`/admin/promotions/${idStr}`, { headers });
            } catch {
              // aunque falle, seguimos con tombstone local
            }

            const nextDeleted = await addDeletedId(idStr);
            setDeletedIds(nextDeleted);

            const nextPub = await removeFromPublished(idStr);
            setOverlayPublished(nextPub);

            // Notifica al Feed
            bus.emit('promos:updated');
            bus.emit('promos:changed');

            await load({ silent: true });
          },
        },
      ],
    );
  };

  // ---- Borrar caché local (overlay/feeds) ----
  const clearLocalCaches = async () => {
    try {
      await AsyncStorage.multiRemove(CACHE_KEYS_TO_CLEAR);
      setOverlayPublished([]);
      setDeletedIds([]);
      bus.emit('promos:updated');
      bus.emit('promos:changed');
      Alert.alert('Listo', 'Caché local limpiada.');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'No se pudo limpiar la caché');
    }
  };

  const confirmClearCaches = () => {
    Alert.alert(
      'Borrar caché local',
      'Esto eliminará el overlay y el feed almacenados en este dispositivo. Úsalo solo para diagnóstico.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Borrar', style: 'destructive', onPress: clearLocalCaches },
      ],
    );
  };

  // Para el contador, usamos activas reales
  const activeCount = list.filter((p) => p.active).length;

  if (!isAdmin) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>Requiere rol ADMIN.</Text>
      </View>
    );
  }

  // ====== UI Helpers ======
  const TypePill = ({ value, active, onPress }: { value: PromoType; active: boolean; onPress: () => void }) => (
    <TouchableOpacity
      onPress={onPress}
      style={{
        backgroundColor: active ? '#111' : '#eee',
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 8,
        marginRight: 8,
      }}
    >
      <Text style={{ color: active ? '#fff' : '#111', fontWeight: '700' }}>{value}</Text>
    </TouchableOpacity>
  );

  const addComponentRow = () =>
    setForm((f: any) => ({ ...f, components: [...(f.components as ComponentRow[]), { productId: '', qtyStr: '' }] }));

  const updateComponentRow = (idx: number, patch: Partial<ComponentRow>) =>
    setForm((f: any) => ({
      ...f,
      components: (f.components as ComponentRow[]).map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    }));

  const removeComponentRow = (idx: number) =>
    setForm((f: any) => ({ ...f, components: (f.components as ComponentRow[]).filter((_, i) => i !== idx) }));

  const applyBannerCandidate = (cand: BannerCandidate) => {
    setForm((f: any) => ({
      ...f,
      bannerKey: cand.key,
      bannerImageUrl: cand.imageUrl ?? f.bannerImageUrl,
    }));
  };

  const visibleBannerCandidates = useMemo(() => bannerCandidates.slice(0, 20), [bannerCandidates]);

  const previewBannerUrl = useMemo(
    () =>
      cacheBust(
        form.bannerImageUrl ||
          visibleBannerCandidates.find((c) => c.key.trim().toLowerCase() === form.bannerKey.trim().toLowerCase())
            ?.imageUrl,
        Date.now(),
      ),
    [form.bannerImageUrl, form.bannerKey, visibleBannerCandidates],
  );

  return (
    <View style={{ flex: 1, padding: 16, paddingBottom: bottomPadding + 16 }}>
      {/* Header con “Nueva”, “Refrescar feed” y “Borrar caché” */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <Text style={{ fontSize: 22, fontWeight: '800', flexShrink: 0 }}>Promociones</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginLeft: 12, flex: 1 }}
          contentContainerStyle={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            justifyContent: 'flex-end',
            flexGrow: 1,
          }}
        >
          <TouchableOpacity
            onPress={() => load().catch(() => undefined)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#0284c7',
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 10,
              gap: 6,
            }}
          >
            <Ionicons name="refresh" size={16} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '800' }}>Refrescar feed</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={confirmClearCaches}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#dc2626', // rojo
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 10,
              gap: 6,
            }}
          >
            <Ionicons name="trash-outline" size={16} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '800' }}>Borrar caché</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setModal(true)}
            style={{
              backgroundColor: '#111',
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 10,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Nueva</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <Text style={{ marginBottom: 8, color: '#666' }}>
        Publicadas (activas): {activeCount}/{MAX_PUBLISHED} · Ocultas localmente: {deletedIds.length}
      </Text>

      <FlatList
        data={list}
        keyExtractor={(it) => String(it.id)}
        refreshing={loading}
        onRefresh={() => load().catch(() => undefined)}
        renderItem={({ item }) => {
          const isActive = !!item.active;
          const canActivate = isActive || activeCount < MAX_PUBLISHED;

          const meta = (item as any)?.conditions?.metadata ?? {};
          const bKey = meta.bannerKey as string | undefined;
          const img =
            meta.imageUrl ||
            bannerCandidates.find((c) => bKey && c.key.toLowerCase() === bKey.toLowerCase())?.imageUrl;

          return (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => navigation.navigate('PromoDetail', { promoId: String(item.id) })}
              style={{
                padding: 12,
                borderRadius: 12,
                backgroundColor: '#fff',
                marginBottom: 10,
                borderWidth: 1,
                borderColor: '#E5E7EB',
              }}
            >
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {img ? (
                  <Image
                    source={{ uri: cacheBust(img, (item as any)?.updatedAt ?? item.id) }}
                    style={{ width: 72, height: 72, borderRadius: 8, backgroundColor: '#F3F4F6' }}
                  />
                ) : (
                  <View style={{ width: 72, height: 72, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="image-outline" size={20} color="#9CA3AF" />
                  </View>
                )}

                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700' }}>{item.name}</Text>
                  <Text style={{ color: '#666' }}>
                    {item.type} · {item.audience} · prioridad {item.priority}
                  </Text>
                  {isActive && (
                    <Text style={{ marginTop: 4, color: '#059669', fontWeight: '700' }}>Publicado</Text>
                  )}
                  {bKey ? <Text style={{ color: '#6B7280', fontSize: 12 }}>bannerKey: {bKey}</Text> : null}
                </View>
              </View>

              <View style={{ flexDirection: 'row', marginTop: 12 }}>
                <TouchableOpacity
                  onPress={() => togglePublish(item)}
                  disabled={!canActivate}
                  style={{
                    backgroundColor: isActive ? '#10b981' : canActivate ? '#111' : '#9ca3af',
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                    marginRight: 8,
                    opacity: canActivate ? 1 : 0.6,
                  }}
                >
                  <Text style={{ color: '#fff' }}>
                    {isActive ? 'Publicado' : 'Publicar'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => removePromotion(item.id)}
                  style={{
                    backgroundColor: '#ef4444',
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                  }}
                >
                  <Text style={{ color: '#fff' }}>Eliminar</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        }}
        ListHeaderComponent={
          <View style={{ marginBottom: 12 }}>
            {!!feed && visibleBannerCandidates.length > 0 ? (
              <>
                <Text style={{ fontWeight: '700', marginBottom: 6 }}>Banners detectados en el feed</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 6 }}>
                  {visibleBannerCandidates.map((c) => (
                    <TouchableOpacity
                      key={`${c.source}-${c.key}`}
                      onPress={() => applyBannerCandidate(c)}
                      style={{
                        marginRight: 10,
                        borderWidth: 2,
                        borderColor: form.bannerKey.toLowerCase() === c.key.toLowerCase() ? '#111' : 'transparent',
                        borderRadius: 10,
                        overflow: 'hidden',
                        width: 140,
                      }}
                    >
                      {c.imageUrl ? (
                        <Image source={{ uri: cacheBust(c.imageUrl, 'prev') }} style={{ width: 140, height: 78 }} />
                      ) : (
                        <View style={{ width: 140, height: 78, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="image-outline" size={18} color="#9CA3AF" />
                        </View>
                      )}
                      <View style={{ padding: 6 }}>
                        <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '700' }}>{c.key}</Text>
                        <Text style={{ fontSize: 10, color: '#6B7280' }}>{c.source}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            ) : (
              <Text style={{ color: '#6B7280', marginBottom: 6 }}>
                No detectamos banners en el feed todavía. Intenta “Refrescar feed”.
              </Text>
            )}
          </View>
        }
      />

      {/* Modal crear */}
      <Modal visible={modal} animationType="slide" onRequestClose={() => setModal(false)}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
          <Text style={{ fontSize: 20, fontWeight: '800', marginBottom: 12 }}>Nueva promoción</Text>

          <Text>Nombre</Text>
          <FormInput
            value={form.name}
            onChangeText={(v: string) => setForm({ ...form, name: v })}
            placeholder="Ej: Solo hoy: Cerveza a $2.000"
          />

          <Text style={{ marginTop: 12 }}>Tipo</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 10, flexGrow: 0 }}
            contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 2 }}
          >
            {(['PRICE_OVERRIDE', 'PERCENT_OFF', 'X_FOR_Y', 'GIFT_WITH_PURCHASE'] as PromoType[]).map((t) => (
              <TypePill key={t} value={t} active={form.type === t} onPress={() => setForm({ ...form, type: t })} />
            ))}
          </ScrollView>

          {form.type === 'PRICE_OVERRIDE' && (
            <>
              <Text>Precio fijo (COP)</Text>
              <FormInput
                keyboardType="numeric"
                value={String(form.benefits?.price ?? '')}
                onChangeText={(v: string) =>
                  setForm({ ...form, benefits: { ...form.benefits, price: Number(v || 0) } })
                }
                placeholder="10000"
              />
            </>
          )}

          {form.type === 'PERCENT_OFF' && (
            <>
              <Text>% Descuento</Text>
              <FormInput
                keyboardType="numeric"
                value={String(form.benefits?.percent ?? '')}
                onChangeText={(v: string) =>
                  setForm({ ...form, benefits: { ...form.benefits, percent: Number(v || 0) } })
                }
                placeholder="15"
              />
            </>
          )}

          {form.type === 'X_FOR_Y' && (
            <>
              <Text style={{ marginTop: 8 }}>Bundle ID (SKU promo)</Text>
              <FormInput
                value={form.bundleId}
                onChangeText={(v: string) => setForm({ ...form, bundleId: v })}
                placeholder="1002"
                autoCapitalize="none"
              />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ marginTop: 8 }}>X (lleva)</Text>
                  <FormInput
                    keyboardType="numeric"
                    value={form.xStr}
                    onChangeText={(v: string) => setForm({ ...form, xStr: v })}
                    placeholder="3"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ marginTop: 8 }}>Y (paga)</Text>
                  <FormInput
                    keyboardType="numeric"
                    value={form.yStr}
                    onChangeText={(v: string) => setForm({ ...form, yStr: v })}
                    placeholder="2"
                  />
                </View>
              </View>
            </>
          )}

          {form.type === 'GIFT_WITH_PURCHASE' && (
            <>
              <Text style={{ marginTop: 8 }}>Bundle ID (SKU promo)</Text>
              <FormInput
                value={form.bundleId}
                onChangeText={(v: string) => setForm({ ...form, bundleId: v })}
                placeholder="1002"
                autoCapitalize="none"
              />
              <Text style={{ marginTop: 8 }}>Producto trigger (productId)</Text>
              <FormInput
                value={form.triggerProductId}
                onChangeText={(v: string) => setForm({ ...form, triggerProductId: v })}
                placeholder="50"
                autoCapitalize="none"
              />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ marginTop: 8 }}>Qty trigger</Text>
                  <FormInput
                    keyboardType="numeric"
                    value={form.triggerQtyStr}
                    onChangeText={(v: string) => setForm({ ...form, triggerQtyStr: v })}
                    placeholder="1"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ marginTop: 8 }}>Producto regalo (productId)</Text>
                  <FormInput
                    value={form.giftProductId}
                    onChangeText={(v: string) => setForm({ ...form, giftProductId: v })}
                    placeholder="99"
                    autoCapitalize="none"
                  />
                </View>
              </View>
            </>
          )}

          {(form.type === 'X_FOR_Y' || form.type === 'GIFT_WITH_PURCHASE') && (
            <>
              <Text style={{ marginTop: 12, marginBottom: 6, fontWeight: '700' }}>
                Componentes del bundle (opcional)
              </Text>
              {(form.components as ComponentRow[]).map((row, idx) => (
                <View
                  key={idx}
                  style={{
                    borderWidth: 1,
                    borderColor: '#E5E7EB',
                    borderRadius: 10,
                    padding: 12,
                    marginBottom: 10,
                  }}
                >
                  <Text>productId</Text>
                  <FormInput
                    value={row.productId}
                    onChangeText={(v: string) => updateComponentRow(idx, { productId: v })}
                    placeholder="p.ej. 3"
                  />
                  <Text style={{ marginTop: 8 }}>qty</Text>
                  <FormInput
                    keyboardType="numeric"
                    value={row.qtyStr}
                    onChangeText={(v: string) => updateComponentRow(idx, { qtyStr: v })}
                    placeholder="p.ej. 3"
                  />
                  <TouchableOpacity
                    onPress={() => removeComponentRow(idx)}
                    style={{
                      alignSelf: 'flex-start',
                      backgroundColor: '#ef4444',
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 8,
                      marginTop: 8,
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Eliminar</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                onPress={addComponentRow}
                style={{
                  alignSelf: 'flex-start',
                  backgroundColor: '#111',
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 10,
                  marginBottom: 8,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>+ Agregar componente</Text>
              </TouchableOpacity>
            </>
          )}

          <Text style={{ marginTop: 8 }}>Producto principal (productId numérico)</Text>
          <FormInput
            keyboardType="number-pad"
            value={String(form.products?.[0]?.productId ?? '')}
            onChangeText={(v: string) => {
              const onlyDigits = v.replace(/\D+/g, '');
              setForm({ ...form, products: [{ productId: onlyDigits }] });
            }}
            placeholder="p.ej. 2 o 1002 (bundle)"
          />

          <Text style={{ marginTop: 8 }}>Vigencia (inicio ISO)</Text>
          <FormInput
            value={form.startsAt}
            onChangeText={(v: string) => setForm({ ...form, startsAt: v })}
            placeholder="YYYY-MM-DDTHH:mm:ssZ"
            autoCapitalize="none"
          />
          <Text style={{ marginTop: 8 }}>Vigencia (fin ISO)</Text>
          <FormInput
            value={form.endsAt}
            onChangeText={(v: string) => setForm({ ...form, endsAt: v })}
            placeholder="YYYY-MM-DDTHH:mm:ssZ"
            autoCapitalize="none"
          />

          {/* ---- Selección de banner dinámica ---- */}
          <Text style={{ marginTop: 12, marginBottom: 6, fontWeight: '700' }}>Elegir banner (dinámico)</Text>
          {visibleBannerCandidates.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {visibleBannerCandidates.map((b) => {
                const active = form.bannerKey && form.bannerKey.toLowerCase() === b.key.toLowerCase();
                return (
                  <TouchableOpacity
                    key={`${b.source}-${b.key}`}
                    onPress={() => applyBannerCandidate(b)}
                    style={{
                      marginRight: 12,
                      borderWidth: 2,
                      borderColor: active ? '#111' : 'transparent',
                      borderRadius: 8,
                      overflow: 'hidden',
                      width: 140,
                    }}
                  >
                    {b.imageUrl ? (
                      <Image source={{ uri: cacheBust(b.imageUrl, 'cand') }} style={{ width: 140, height: 78 }} />
                    ) : (
                      <View style={{ width: 140, height: 78, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="image-outline" size={18} color="#9CA3AF" />
                      </View>
                    )}
                    <View style={{ padding: 6 }}>
                      <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '700' }}>{b.key}</Text>
                      <Text style={{ fontSize: 10, color: '#6B7280' }}>{b.source}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : (
            <Text style={{ color: '#6B7280' }}>No hay banners detectados en el feed.</Text>
          )}

          <Text style={{ marginTop: 12 }}>bannerKey (manual / override)</Text>
          <FormInput
            value={form.bannerKey}
            onChangeText={(v: string) => setForm({ ...form, bannerKey: v })}
            placeholder="p.ej. hero_semana_1"
            autoCapitalize="none"
          />

          <Text style={{ marginTop: 8 }}>Imagen del banner (opcional, URL pública)</Text>
          <FormInput
            value={form.bannerImageUrl}
            onChangeText={(v: string) => setForm({ ...form, bannerImageUrl: v })}
            placeholder="https://cdn.tuapp.com/hero.webp"
            autoCapitalize="none"
          />

          {/* Preview con cache-bust */}
          <View style={{ marginTop: 10 }}>
            <Text style={{ marginBottom: 6, color: '#6B7280' }}>Vista previa</Text>
            {previewBannerUrl ? (
              <Image
                source={{ uri: previewBannerUrl }}
                style={{ width: '100%', height: 160, borderRadius: 10, backgroundColor: '#F3F4F6' }}
              />
            ) : (
              <View style={{ width: '100%', height: 160, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="image-outline" size={24} color="#9CA3AF" />
              </View>
            )}
          </View>

          <View style={{ flexDirection: 'row', marginTop: 16 }}>
            <TouchableOpacity
              onPress={() => setModal(false)}
              disabled={saving}
              style={{ paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, backgroundColor: '#eee', marginRight: 8 }}
            >
              <Text>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={save}
              disabled={saving}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderRadius: 10,
                backgroundColor: '#111',
                opacity: saving ? 0.6 : 1,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>{saving ? 'Guardando…' : 'Guardar'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Modal>
    </View>
  );
}
