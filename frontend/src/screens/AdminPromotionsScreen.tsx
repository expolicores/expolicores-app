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
import { api, fetchAdminPromotions, type AdminPromotion } from '../lib/api';
import { bus } from '../lib/bus';

type PromoType = 'PRICE_OVERRIDE' | 'PERCENT_OFF' | 'X_FOR_Y' | 'GIFT_WITH_PURCHASE';

const MAX_PUBLISHED = 3;

// Banners mock (provisional)
const BANNERS = [
  { key: 'slotA', url: 'https://cdn.expressapp.net/p/vino-malbec-400.webp' },
  { key: 'slotB', url: 'https://cdn.expressapp.net/p/ron-1l-400.webp' },
  { key: 'slotC', url: 'https://cdn.expressapp.net/p/hero-b2c-week.webp' },
];

// Overlay local “publicadas”
const OVERLAY_PUBLISHED_KEY = 'published_promos_overlay_v1';
// “Tombstones” locales para eliminadas
const OVERLAY_DELETED_KEY = 'deleted_promos_overlay_v1';

// Claves de caché que podemos limpiar
const CACHE_KEYS_TO_CLEAR = ['published_promos_overlay_v1', 'feed:last', 'feed:last:v2'];

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
    bannerKey: 'slotA' as 'slotA' | 'slotB' | 'slotC' | 'none',
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

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = !!opts?.silent;
      if (!silent) setLoading(true);
      try {
        const res = await fetchAdminPromotions(headers);

        const savedPublished = await readPublished();
        const savedDeleted = await readDeletedIds();
        setOverlayPublished(savedPublished);
        setDeletedIds(savedDeleted);

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

        // Mantén published (solo UI) para compat con overlay local; pero el toggle usará "active"
        const publishedIds = new Set(savedPublished.map((s) => String(s.id)));
        const merged = cleaned.map((p: any) => ({
          ...p,
          published: !!p.published || publishedIds.has(String(p.id)),
        })) as AdminPromotion[];

        setList(merged);
        return merged;
      } catch (e: any) {
        if (!silent) Alert.alert('No pudimos cargar', e?.message ?? 'Intenta de nuevo');
        throw e;
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [headers],
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
        conditions:
          form.bannerKey === 'none'
            ? form.conditions && Object.keys(form.conditions || {}).length
              ? form.conditions
              : undefined
            : {
                ...(form.conditions && Object.keys(form.conditions || {}).length ? form.conditions : {}),
                metadata: { bannerKey: form.bannerKey },
              },
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
        const bannerKey =
          (fresh as any)?.conditions?.metadata?.bannerKey ??
          (item as any)?.conditions?.metadata?.bannerKey ??
          'slotA';
        const imageUrl = BANNERS.find((b) => b.key === bannerKey)?.url;
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

  return (
    <View style={{ flex: 1, padding: 16, paddingBottom: bottomPadding + 16 }}>
      {/* Header con “Nueva” y “Borrar caché” */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <Text style={{ fontSize: 22, fontWeight: '800' }}>Promociones</Text>

        <View style={{ flexDirection: 'row', gap: 8 }}>
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
        </View>
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
              <Text style={{ fontWeight: '700' }}>{item.name}</Text>
              <Text style={{ color: '#666' }}>
                {item.type} · {item.audience} · prioridad {item.priority}
              </Text>
              {isActive && (
                <Text style={{ marginTop: 4, color: '#059669', fontWeight: '700' }}>Publicado</Text>
              )}

              <View style={{ flexDirection: 'row', marginTop: 8 }}>
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

          <Text style={{ marginTop: 12, marginBottom: 6 }}>Imagen provisional (elige 1 de 3)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {BANNERS.map((b) => {
              const active = form.bannerKey === b.key;
              return (
                <TouchableOpacity
                  key={b.key}
                  onPress={() => setForm({ ...form, bannerKey: b.key })}
                  style={{ marginRight: 12, borderWidth: 2, borderColor: active ? '#111' : 'transparent', borderRadius: 8 }}
                >
                  <Image source={{ uri: b.url }} style={{ width: 120, height: 80, borderRadius: 6 }} />
                  <Text style={{ textAlign: 'center', marginTop: 4 }}>{b.key}</Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              onPress={() => setForm({ ...form, bannerKey: 'none' })}
              style={{
                justifyContent: 'center',
                alignItems: 'center',
                width: 100,
                borderWidth: 1,
                borderColor: '#E5E7EB',
                borderRadius: 8,
                marginLeft: 12,
              }}
            >
              <Text style={{ color: '#6B7280', textAlign: 'center' }}>Sin banner</Text>
            </TouchableOpacity>
          </ScrollView>

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
