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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

type OverlayPublished = {
  id: string;
  name: string;
  productId: string; // numeric string
  price?: number;
  imageUrl?: string;
  bannerKey?: string;
  publishedAt: number;
};

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
  const [list, setList] = useState<AdminPromotion[]>([]);
  const [overlayPublished, setOverlayPublished] = useState<OverlayPublished[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<any>({
    name: '',
    type: 'PRICE_OVERRIDE' as PromoType,
    audience: 'B2C',
    priority: 100,
    stacking: false,
    startsAt: new Date().toISOString(),
    endsAt: new Date(Date.now() + 86400000).toISOString(),
    products: [{ productId: '' }],
    benefits: {},
    conditions: {},
    bannerKey: 'slotA',
  });

  const isAdmin = user?.role === 'ADMIN';

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

  const validateForm = () => {
    const msgs: string[] = [];
    if (!form.name?.trim()) msgs.push('Falta el nombre');
    if (!['PRICE_OVERRIDE', 'PERCENT_OFF'].includes(form.type))
      msgs.push('Tipo inválido (usa PRICE_OVERRIDE o PERCENT_OFF por ahora)');
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
    return msgs;
  };

  const save = async () => {
    const errors = validateForm();
    if (errors.length) {
      Alert.alert('Revisa el formulario', errors.join('\n'));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: String(form.name).trim(),
        type: form.type as 'PRICE_OVERRIDE' | 'PERCENT_OFF',
        audience: form.audience ?? 'B2C',
        priority: Number(form.priority ?? 100),
        stacking: !!form.stacking,
        startsAt: normalizeISO(form.startsAt),
        endsAt: normalizeISO(form.endsAt),
        products: [{ productId: normalizeProductId(form.products?.[0]?.productId) }],
        benefits: form.benefits ?? {},
        conditions: {
          ...(form.conditions && Object.keys(form.conditions).length ? form.conditions : {}),
          metadata: { bannerKey: form.bannerKey },
        },
      };
      await api.post('/admin/promotions', payload, { headers });
      setModal(false);
      setForm((prev: any) => ({ ...prev, name: '', benefits: {} }));
      await load();
    } catch (e: any) {
      const msg = e?.details?.message || e?.message || 'No pudimos crear la promoción';
      Alert.alert('Error', Array.isArray(msg) ? msg.join('\n') : String(msg));
    } finally {
      setSaving(false);
    }
  };

  const publish = async (id: string) => {
    const publishedNow = new Set([
      ...list.filter((p) => p.published).map((p) => String(p.id)),
      ...overlayPublished.map((o) => String(o.id)),
    ]);
    const isAlready = publishedNow.has(String(id));
    if (!isAlready && publishedNow.size >= MAX_PUBLISHED) {
      Alert.alert('Límite alcanzado', `Solo puedes tener ${MAX_PUBLISHED} promociones publicadas a la vez.`);
      return;
    }

    try {
      // Optimista
      setList((prev) => prev.map((p) => (String(p.id) === String(id) ? { ...p, published: true } : p)));

      // Backend
      await api.post(`/admin/promotions/${id}/publish`, {}, { headers });

      // Persist overlay
      const promo = list.find((p) => String(p.id) === String(id));
      if (promo) {
        const bannerKey =
          (promo as any)?.conditions?.metadata?.bannerKey ?? form.bannerKey ?? 'slotA';
        const imageUrl = BANNERS.find((b) => b.key === bannerKey)?.url;
        const productId = String((promo.products?.[0] as any)?.productId ?? '').trim();
        const price =
          typeof (promo as any)?.benefits?.price === 'number'
            ? (promo as any).benefits.price
            : undefined;

        const nextPub = await upsertPublished({
          id: String(promo.id),
          name: String(promo.name || 'Promoción'),
          productId,
          price,
          imageUrl,
          bannerKey,
          publishedAt: Date.now(),
        });
        setOverlayPublished(nextPub);

        // Notifica al Feed (en ambos nombres por compat)
        bus.emit('promos:updated');
        bus.emit('promos:changed');
      }

      await load({ silent: true });
    } catch (e: any) {
      // rollback
      setList((prev) => prev.map((p) => (String(p.id) === String(id) ? { ...p, published: false } : p)));
      await removeFromPublished(String(id));
      const msg = e?.details?.message || e?.message || 'No pudimos publicar';
      Alert.alert('Error', String(msg));
    }
  };

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
            } catch (e: any) {
              // aunque falle, seguimos con tombstone local
            }

            const nextDeleted = await addDeletedId(idStr);
            setDeletedIds(nextDeleted);

            const nextPub = await removeFromPublished(idStr);
            setOverlayPublished(nextPub);

            // Notifica al Feed (ambos eventos)
            bus.emit('promos:updated');
            bus.emit('promos:changed');

            await load({ silent: true });
          },
        },
      ],
    );
  };

  const publishedCount = new Set([
    ...list.filter((p) => p.published).map((p) => String(p.id)),
    ...overlayPublished.map((o) => String(o.id)),
  ]).size;

  if (!isAdmin) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>Requiere rol ADMIN.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: '800' }}>Promociones</Text>
        <TouchableOpacity
          onPress={() => setModal(true)}
          style={{ backgroundColor: '#111', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 }}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>Nueva</Text>
        </TouchableOpacity>
      </View>

      <Text style={{ marginBottom: 8, color: '#666' }}>
        Publicadas: {publishedCount}/{MAX_PUBLISHED} · Ocultas localmente: {deletedIds.length}
      </Text>

      <FlatList
        data={list}
        keyExtractor={(it) => String(it.id)}
        refreshing={loading}
        onRefresh={() => load().catch(() => undefined)}
        renderItem={({ item }) => {
          const isPublished = !!item.published;
          const canPublish = isPublished || publishedCount < MAX_PUBLISHED;

          return (
            <View style={{ padding: 12, borderRadius: 12, backgroundColor: '#fff', marginBottom: 10 }}>
              <Text style={{ fontWeight: '700' }}>{item.name}</Text>
              <Text style={{ color: '#666' }}>
                {item.type} · {item.audience} · prioridad {item.priority}
              </Text>
              {isPublished && (
                <Text style={{ marginTop: 4, color: '#059669', fontWeight: '700' }}>Publicado</Text>
              )}

              <View style={{ flexDirection: 'row', marginTop: 8 }}>
                <TouchableOpacity
                  onPress={() => publish(String(item.id))}
                  disabled={!canPublish}
                  style={{
                    backgroundColor: isPublished ? '#10b981' : canPublish ? '#111' : '#9ca3af',
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                    marginRight: 8,
                    opacity: canPublish ? 1 : 0.6,
                  }}
                >
                  <Text style={{ color: '#fff' }}>
                    {isPublished ? 'Publicado' : 'Publicar'}
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
            </View>
          );
        }}
      />

      {/* Modal crear */}
      <Modal visible={modal} animationType="slide" onRequestClose={() => setModal(false)}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
          <Text style={{ fontSize: 20, fontWeight: '800', marginBottom: 12 }}>Nueva promoción</Text>

          <Text>Nombre</Text>
          <TextInput
            value={form.name}
            onChangeText={(v) => setForm({ ...form, name: v })}
            placeholder="Ej: Solo hoy: Cerveza a $2.000"
            style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginBottom: 10 }}
          />

          <Text>Tipo</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 10, flexGrow: 0 }}
            contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 2 }}
          >
            {(['PRICE_OVERRIDE', 'PERCENT_OFF'] as PromoType[]).map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => setForm({ ...form, type: t })}
                style={{
                  backgroundColor: form.type === t ? '#111' : '#eee',
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  borderRadius: 8,
                  marginRight: 8,
                  flexShrink: 0,
                }}
              >
                <Text style={{ color: form.type === t ? '#fff' : '#111' }}>{t}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {form.type === 'PRICE_OVERRIDE' && (
            <>
              <Text>Precio fijo (COP)</Text>
              <TextInput
                keyboardType="numeric"
                value={String(form.benefits?.price ?? '')}
                onChangeText={(v) => setForm({ ...form, benefits: { ...form.benefits, price: Number(v || 0) } })}
                style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginBottom: 10 }}
              />
            </>
          )}

          {form.type === 'PERCENT_OFF' && (
            <>
              <Text>% Descuento</Text>
              <TextInput
                keyboardType="numeric"
                value={String(form.benefits?.percent ?? '')}
                onChangeText={(v) => setForm({ ...form, benefits: { ...form.benefits, percent: Number(v || 0) } })}
                style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginBottom: 10 }}
              />
            </>
          )}

          <Text>Producto principal (productId numérico)</Text>
          <TextInput
            keyboardType="number-pad"
            value={String(form.products?.[0]?.productId ?? '')}
            onChangeText={(v) => {
              const onlyDigits = v.replace(/\D+/g, '');
              setForm({ ...form, products: [{ productId: onlyDigits }] });
            }}
            placeholder="p.ej. 2"
            style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginBottom: 10 }}
          />

          <Text>Vigencia</Text>
          <TextInput
            value={form.startsAt}
            onChangeText={(v) => setForm({ ...form, startsAt: v })}
            placeholder="YYYY-MM-DDTHH:mm:ssZ"
            style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginBottom: 10 }}
          />
          <TextInput
            value={form.endsAt}
            onChangeText={(v) => setForm({ ...form, endsAt: v })}
            placeholder="YYYY-MM-DDTHH:mm:ssZ"
            style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginBottom: 10 }}
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
              style={{ paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, backgroundColor: '#111', opacity: saving ? 0.6 : 1 }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>{saving ? 'Guardando…' : 'Guardar'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Modal>
    </View>
  );
}
