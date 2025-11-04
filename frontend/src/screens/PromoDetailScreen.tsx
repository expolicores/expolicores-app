// frontend/src/screens/PromoDetailScreen.tsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  Platform,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import formatCurrency from '../lib/formatCurrency';
import { useCart } from '../context/CartContext';
import { bus } from '../lib/bus';
import {
  getPromotionById,
  updatePromotion,
  type PromotionDTO,
} from '../lib/api';

const colors = {
  text: '#111',
  muted: '#6B7280',
  border: '#E5E7EB',
  bg: '#fff',
  primary: '#0EA5E9',
  danger: '#ef4444',
  dark: '#111',
};

type RouteParams =
  | { promoId: string }
  | { promo?: PromotionDTO }
  | { promoItem?: any }
  | undefined;

export default function PromoDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const params = (route?.params ?? {}) as RouteParams;

  // ======== MODO ADMIN (edición por ID) ========
  const promoId = (params as any)?.promoId ?? (params as any)?.promo?.id ?? null;

  const [loading, setLoading] = useState<boolean>(!!promoId);
  const [saving, setSaving] = useState(false);
  const [promo, setPromo] = useState<PromotionDTO | null>((params as any)?.promo ?? null);

  // campos editables (ADMIN)
  const [name, setName] = useState('');
  const [priceStr, setPriceStr] = useState(''); // para PRICE_OVERRIDE
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  // ⬇️ NUEVO: producto asociado que usará el overlay/feed
  const [linkedProductId, setLinkedProductId] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!promoId) return;
        setLoading(true);
        const p = await getPromotionById(String(promoId));
        if (!mounted) return;

        setPromo(p);
        setName(p.name ?? '');

        // Precio (si exists en benefitsJson.price)
        const price = (p.benefitsJson as any)?.price;
        setPriceStr(typeof price === 'number' ? String(price) : '');

        // Ventana de tiempo
        setStartsAt(p.startsAt?.slice(0, 19) ?? '');
        setEndsAt(p.endsAt?.slice(0, 19) ?? '');

        // Producto asociado: intentamos en varios campos comunes
        const initialLinked =
          (p as any)?.benefitsJson?.productId ??
          (p as any)?.benefitsJson?.bundleId ??
          (p as any)?.productId ??
          (Array.isArray((p as any)?.products) && (p as any).products[0]?.productId) ??
          '';
        setLinkedProductId(initialLinked ? String(initialLinked) : '');
      } catch (e: any) {
        Alert.alert('Error', e?.message ?? 'No se pudo cargar la promoción');
        navigation.goBack();
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [promoId, navigation]);

  const canSave = useMemo(() => {
    if (!promo) return false;
    if (!name.trim()) return false;
    if (promo.type === 'PRICE_OVERRIDE') {
      const n = Number(priceStr);
      if (!Number.isFinite(n) || n < 0) return false;
    }
    // linkedProductId es opcional: hay promos de banner sin add-to-cart
    return true;
  }, [promo, name, priceStr]);

  const onSave = useCallback(async () => {
    try {
      if (!promo) return;
      setSaving(true);

      // Mantenemos compat: benefits (para price) + benefitsJson (para productId)
      const nextBenefitsJson = {
        ...(promo.benefitsJson ?? {}),
        // solo seteamos si hay valor
        ...(linkedProductId?.trim() ? { productId: String(linkedProductId).trim() } : {}),
      };

      const payload: any = {
        name: name.trim(),
        startsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
        endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
        benefits: { ...(promo.benefitsJson || {}) },
        benefitsJson: nextBenefitsJson,
      };

      if (promo.type === 'PRICE_OVERRIDE') {
        payload.benefits.price = Number(priceStr);
      }

      const updated = await updatePromotion(promo.id, payload);
      setPromo(updated);
      bus.emit('promos:updated');
      Alert.alert('Guardado', 'Promoción actualizada');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }, [promo, name, startsAt, endsAt, priceStr, linkedProductId, navigation]);

  // ======== MODO LECTOR (desde feed: promoItem) ========
  const promoItem = (params as any)?.promoItem;
  const productImage = promoItem?.image || promoItem?.img || null;
  const productTitle = promoItem?.title || promoItem?.subtitle || 'Promoción';
  const productPriceB2C =
    typeof promoItem?.promoPriceOverride === 'number'
      ? promoItem.promoPriceOverride
      : promoItem?.priceB2C;

  // Cart (lector)
  const cartCtx: any = (useCart() as any) ?? {};
  const addItem = cartCtx.addItem || cartCtx.addToCart || cartCtx.add;
  const handleAdd = async () => {
    try {
      const pidStr = String(promoItem?.productId ?? promoItem?.id ?? '').trim();
      if (!pidStr) throw new Error('Producto inválido');

      const attempts: Array<() => any> = [
        () => addItem?.(Number(pidStr), 1),
        () => addItem?.(pidStr, 1),
        () => addItem?.({ id: Number(pidStr) }, 1),
        () => addItem?.({ productId: Number(pidStr) }, 1),
      ];
      for (const f of attempts) {
        try {
          const r = f?.();
          if (r?.then) await r;
          return;
        } catch {}
      }
      throw new Error('No se pudo agregar al carrito');
    } catch (e: any) {
      Alert.alert('Ups', e?.message ?? 'No se pudo agregar');
    }
  };

  // ======== RENDER ========
  // 1) ADMIN (cuando hay promoId o promo)
  if (promoId) {
    if (loading) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      );
    }
    if (!promo) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text>No pudimos cargar la promoción.</Text>
        </View>
      );
    }

    return (
      <ScrollView contentContainerStyle={{ padding: 16, backgroundColor: colors.bg }}>
        <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 8 }}>
          Editar promoción
        </Text>
        <Text style={{ color: colors.muted, marginBottom: 16 }}>ID: {promo.id}</Text>

        {/* Nombre */}
        <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 6 }}>Nombre</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Nombre de la promo"
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: Platform.OS === 'ios' ? 12 : 8,
            marginBottom: 14,
            color: colors.text,
          }}
        />

        {/* Precio override (si aplica) */}
        {promo.type === 'PRICE_OVERRIDE' ? (
          <>
            <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 6 }}>
              Precio (override)
            </Text>
            <TextInput
              value={priceStr}
              onChangeText={setPriceStr}
              keyboardType="numeric"
              placeholder="Ej: 10000"
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: Platform.OS === 'ios' ? 12 : 8,
                marginBottom: 14,
                color: colors.text,
              }}
            />
          </>
        ) : null}

        {/* Fechas */}
        <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 6 }}>
          Inicio (ISO)
        </Text>
        <TextInput
          value={startsAt}
          onChangeText={setStartsAt}
          placeholder="2025-11-01T05:10:33.378Z"
          autoCapitalize="none"
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: Platform.OS === 'ios' ? 12 : 8,
            marginBottom: 14,
            color: colors.text,
          }}
        />
        <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 6 }}>
          Fin (ISO)
        </Text>
        <TextInput
          value={endsAt}
          onChangeText={setEndsAt}
          placeholder="2025-11-02T05:10:33.378Z"
          autoCapitalize="none"
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: Platform.OS === 'ios' ? 12 : 8,
            marginBottom: 14,
            color: colors.text,
          }}
        />

        {/* ⬇️ NUEVO: producto asociado */}
        <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 6 }}>
          Producto asociado (ID o bundleId)
        </Text>
        <TextInput
          value={linkedProductId}
          onChangeText={setLinkedProductId}
          keyboardType="number-pad"
          placeholder="Ej: 2, 11, 1009…"
          autoCapitalize="none"
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: Platform.OS === 'ios' ? 12 : 8,
            marginBottom: 6,
            color: colors.text,
          }}
        />
        <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 14 }}>
          Este ID se usará para agregar al carrito desde el feed/overlay.
        </Text>

        {/* Guardar */}
        <TouchableOpacity
          onPress={onSave}
          disabled={!canSave || saving}
          activeOpacity={0.9}
          style={{
            backgroundColor: canSave ? colors.primary : '#9CA3AF',
            paddingVertical: 12,
            borderRadius: 12,
            alignItems: 'center',
          }}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontWeight: '800' }}>Guardar cambios</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 24 }} />

        {/* Datos técnicos */}
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          Tipo: {promo.type} · Audiencia: {promo.audience} · Priority: {promo.priority}
        </Text>
      </ScrollView>
    );
  }

  // 2) LECTOR (cuando llega desde el feed con promoItem)
  if (promoItem) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {productImage ? (
          <Image
            source={{ uri: productImage }}
            style={{ width: '100%', height: 260, backgroundColor: '#F3F4F6' }}
            resizeMode="cover"
          />
        ) : null}

        <View style={{ padding: 16 }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>{productTitle}</Text>

          {typeof productPriceB2C === 'number' ? (
            <Text style={{ marginTop: 8, fontSize: 18, fontWeight: '700', color: colors.text }}>
              {formatCurrency(productPriceB2C)}
            </Text>
          ) : null}

          {!!promoItem?.description && (
            <Text style={{ marginTop: 12, color: colors.muted }}>{promoItem.description}</Text>
          )}

          <TouchableOpacity
            onPress={handleAdd}
            style={{
              marginTop: 20,
              backgroundColor: colors.dark,
              padding: 14,
              borderRadius: 12,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Agregar al carrito</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // 3) Sin parámetros
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
      <Text>No pudimos cargar la promoción.</Text>
    </View>
  );
}
