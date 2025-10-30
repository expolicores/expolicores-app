// frontend/src/screens/CheckoutScreen.tsx
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  ScrollView,
  Modal,
  FlatList,
  Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useCart } from '../context/CartContext';
import type { CreateOrderDto, OrderSuccess } from '../types/order';
import { validateGeo } from '../lib/api.geo';
import { useAuth } from '../context/AuthContext';
import { useSelectedAddress } from '../hooks/useSelectedAddress';
import type { Address } from '../types/address';

export default function CheckoutScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const role = user?.role as 'ADMIN' | 'B2B' | 'B2C' | undefined;
  const isB2BPriceUser = role === 'ADMIN' || role === 'B2B';

  const { items: cartItems, clear, remove } = useCart();

  // === precios consistentes según rol ===
  const getUnitPriceForItem = (item: any) => {
    const base = Number(item?.price) || 0;
    const b2b = Number(item?.b2bPrice);
    if (isB2BPriceUser && Number.isFinite(b2b) && b2b > 0) return b2b;
    return base;
  };

  const computedSubtotal = React.useMemo(() => {
    return cartItems.reduce((sum, it) => {
      const unit = getUnitPriceForItem(it);
      const qty = Number(it?.qty) || 0;
      return sum + unit * qty;
    }, 0);
  }, [cartItems, isB2BPriceUser]);

  // === Direcciones ===
  const { data: addresses, isLoading: loadingAddrs } = useQuery({
    queryKey: ['addresses'],
    queryFn: async () => (await api.get('/addresses')).data as Address[],
  });

  // Dirección seleccionada compartida con AddressList
  const { selectedAddress, setSelectedAddress } = useSelectedAddress(addresses ?? []);
  const [pickerOpen, setPickerOpen] = React.useState(false);

  // === Envío ===
  const [notes, setNotes] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [shippingInfo, setShippingInfo] = React.useState<{ cost: number; distanceKm: number } | null>(null);
  const [shippingLoading, setShippingLoading] = React.useState(false);
  const [shippingError, setShippingError] = React.useState<string | null>(null);

  // Recalcula envío cuando cambia la dirección seleccionada
  React.useEffect(() => {
    if (!selectedAddress) {
      setShippingInfo(null);
      setShippingError(null);
      setShippingLoading(false);
      return;
    }

    const lat = typeof selectedAddress.lat === 'number' ? selectedAddress.lat : null;
    const lng = typeof selectedAddress.lng === 'number' ? selectedAddress.lng : null;

    if (lat == null || lng == null) {
      setShippingInfo(null);
      setShippingError('Dirección sin coordenadas');
      setShippingLoading(false);
      return;
    }

    let cancelled = false;
    setShippingLoading(true);
    setShippingError(null);
    setShippingInfo(null);

    validateGeo({ lat, lng })
      .then((resp) => {
        if (cancelled) return;
        if (!resp.inCoverage) {
          setShippingInfo(null);
          setShippingError('Fuera de cobertura');
          return;
        }
        setShippingInfo({ cost: resp.shippingCost, distanceKm: resp.distanceKm });
        setShippingError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setShippingInfo(null);
        setShippingError('No se pudo calcular el envío');
      })
      .finally(() => {
        if (cancelled) return;
        setShippingLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedAddress?.id, selectedAddress?.lat, selectedAddress?.lng]);

  // === Mutación: crear orden ===
  const createOrderMutation = useMutation({
    mutationFn: async (payload: CreateOrderDto) => (await api.post('/orders', payload)).data,
    onSuccess: (order: OrderSuccess) => {
      clear();
      navigation.replace('OrderSuccess', {
        orderId: order.id,
        total: order.total,
        subtotal: order.subtotal,
        shipping: order.shipping,
      });
    },
    onError: (err: any) => {
      const payload = err?.response?.data ?? {};
      const code =
        typeof payload?.code === 'string'
          ? payload.code
          : typeof payload?.message === 'string'
          ? payload.message
          : undefined;

      if (code?.startsWith?.('OUT_OF_STOCK')) {
        Alert.alert('Sin stock', 'Algún producto está sin stock.');
      } else if (code === 'COVERAGE_OUT_OF_RANGE') {
        Alert.alert('Fuera de cobertura', 'Cambia tu dirección.');
      } else if (code === 'ADDRESS_MISSING_GEO') {
        Alert.alert('Dirección', 'Faltan coordenadas (lat/lng).');
      } else if (code === 'ADDRESS_NOT_FOUND') {
        Alert.alert('Dirección', 'No encontramos tu dirección.');
      } else if (code === 'EMPTY_CART') {
        Alert.alert('Carrito', 'Tu carrito está vacío.');
      } else if (code === 'PRODUCT_NOT_FOUND') {
        const missing = Array.isArray((payload as any)?.missing) ? (payload as any).missing : [];
        if (missing.length) {
          const missingNames = cartItems.filter((it) => missing.includes(it.productId)).map((it) => it.name);
          missing.forEach((id: number) => remove(id));
          const label = missingNames.length ? missingNames.join(', ') : 'Algunos productos';
          Alert.alert('Producto no disponible', `${label} ya no está disponible y fue removido de tu carrito.`);
        } else {
          Alert.alert('Producto no disponible', 'Un producto ya no está disponible.');
        }
      } else if (typeof payload?.message === 'string') {
        Alert.alert('Error', payload.message);
      } else {
        Alert.alert('Error', 'No pudimos crear la orden.');
      }
    },
    onSettled: () => setIsSubmitting(false),
  });

  const confirmDisabled =
    loadingAddrs ||
    !selectedAddress ||
    cartItems.length === 0 ||
    createOrderMutation.isLoading ||
    isSubmitting ||
    shippingLoading ||
    !!shippingError ||
    !shippingInfo;

  const handleConfirm = () => {
    if (confirmDisabled) return;
    if (!selectedAddress) {
      Alert.alert('Dirección', 'Elige o crea una dirección de entrega.');
      return;
    }
    if (!shippingInfo) {
      Alert.alert('Envío', shippingError ?? 'Calculando envío. Intenta en unos segundos.');
      return;
    }
    setIsSubmitting(true);

    const payload: CreateOrderDto = {
      addressId: selectedAddress.id, // ← usa la dirección elegida en el modal
      items: cartItems.map((it) => ({ productId: it.productId, quantity: it.qty })),
      notes: notes.trim() || undefined,
      paymentMethod: 'COD',
    };

    createOrderMutation.mutate(payload);
  };

  if (loadingAddrs) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Cargando dirección…</Text>
      </View>
    );
  }

  const currency = (v: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v || 0);

  return (
    <>
      <ScrollView style={{ flex: 1, padding: 16 }}>
        {/* Dirección */}
        <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16, elevation: 2 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 6 }}>Dirección</Text>
          {selectedAddress ? (
            <>
              <Text style={{ fontSize: 14 }}>
                {selectedAddress.label ?? 'Dirección'} — {selectedAddress.line1}
                {selectedAddress.city ? `, ${selectedAddress.city}` : ''}
              </Text>
              <TouchableOpacity style={{ marginTop: 10 }} onPress={() => setPickerOpen(true)}>
                <Text style={{ color: '#2563eb', fontWeight: '600' }}>Cambiar</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={{ color: '#6b7280' }}>No tienes direcciones</Text>
              <TouchableOpacity style={{ marginTop: 10 }} onPress={() => navigation.navigate('Addresses')}>
                <Text style={{ color: '#2563eb', fontWeight: '600' }}>Agregar dirección</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Tu pedido */}
        <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16, elevation: 2 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 10 }}>Tu pedido</Text>
          {cartItems.map((item) => {
            const unit = getUnitPriceForItem(item);
            const qty = Number(item.qty) || 0;
            const lineTotal = unit * qty;
            return (
              <View
                key={String(item.productId)}
                style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}
              >
                <Text style={{ flex: 1 }} numberOfLines={1}>
                  {item.name} × {qty}
                </Text>
                <Text style={{ fontWeight: '600' }}>{currency(lineTotal)}</Text>
              </View>
            );
          })}
        </View>

        {/* Notas */}
        <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16, elevation: 2 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 8 }}>Notas (opcional)</Text>
          <TextInput
            placeholder="Ej: Recepción en portería. Llamar al llegar."
            value={notes}
            onChangeText={setNotes}
            multiline
            style={{
              minHeight: 80,
              borderWidth: 1,
              borderColor: '#e5e7eb',
              borderRadius: 10,
              padding: 10,
              textAlignVertical: 'top',
            }}
          />
        </View>

        {/* Resumen */}
        <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 24, elevation: 2 }}>
          <Row label="Subtotal" value={computedSubtotal} />
          <Row
            label="Envío"
            value={
              shippingInfo
                ? shippingInfo.cost
                : shippingLoading
                ? 'Calculando...'
                : shippingError ?? 'Selecciona una dirección con cobertura'
            }
            isString={!shippingInfo}
          />
          {shippingInfo ? <Row label="Total" value={computedSubtotal + shippingInfo.cost} /> : null}
          <View style={{ height: 8 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>
            {shippingInfo
              ? `Envío estimado para ${shippingInfo.distanceKm.toFixed(1)} km.`
              : shippingError
              ? `${shippingError}. Actualiza tu dirección para continuar.`
              : 'El envío se calcula por distancia. Edita tu dirección para estimarlo.'}
          </Text>
        </View>

        {/* Confirmar */}
        <TouchableOpacity
          onPress={handleConfirm}
          disabled={
            loadingAddrs ||
            !selectedAddress ||
            cartItems.length === 0 ||
            createOrderMutation.isLoading ||
            isSubmitting ||
            shippingLoading ||
            !!shippingError ||
            !shippingInfo
          }
          style={{
            backgroundColor:
              loadingAddrs ||
              !selectedAddress ||
              cartItems.length === 0 ||
              createOrderMutation.isLoading ||
              isSubmitting ||
              shippingLoading ||
              !!shippingError ||
              !shippingInfo
                ? '#9ca3af'
                : '#16a34a',
            opacity:
              loadingAddrs ||
              !selectedAddress ||
              cartItems.length === 0 ||
              createOrderMutation.isLoading ||
              isSubmitting ||
              shippingLoading ||
              !!shippingError ||
              !shippingInfo
                ? 0.6
                : 1,
            paddingVertical: 14,
            borderRadius: 12,
            alignItems: 'center',
            marginBottom: 40,
          }}
        >
          {createOrderMutation.isLoading || isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Confirmar pedido</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* ===== MODAL: Selector de direcciones ===== */}
      <AddressPickerModal
        visible={pickerOpen}
        addresses={addresses ?? []}
        selectedId={selectedAddress?.id ?? null}
        onClose={() => setPickerOpen(false)}
        onSelect={(addr) => {
          setSelectedAddress(addr);
          setPickerOpen(false);
        }}
        onManage={() => {
          setPickerOpen(false);
          navigation.navigate('Addresses');
        }}
      />
    </>
  );
}

function Row({ label, value, isString }: { label: string; value: number | string; isString?: boolean }) {
  const display = isString
    ? String(value)
    : new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(
        value as number
      );
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
      <Text style={{ color: '#374151' }}>{label}</Text>
      <Text style={{ fontWeight: '700' }}>{display}</Text>
    </View>
  );
}

/** Modal simple para elegir dirección sin tocar isDefault */
function AddressPickerModal(props: {
  visible: boolean;
  addresses: Address[];
  selectedId: number | null;
  onSelect: (a: Address) => void;
  onClose: () => void;
  onManage: () => void;
}) {
  const { visible, addresses, selectedId, onSelect, onClose, onManage } = props;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.35)',
          justifyContent: 'flex-end',
        }}
      >
        <View
          style={{
            backgroundColor: '#fff',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: '70%',
            paddingBottom: 16,
          }}
        >
          <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
            <Text style={{ fontSize: 16, fontWeight: '700' }}>Elegir dirección de entrega</Text>
          </View>

          <FlatList
            data={addresses}
            keyExtractor={(a) => String(a.id)}
            renderItem={({ item }) => {
              const isSelected = item.id === selectedId;
              return (
                <Pressable
                  onPress={() => onSelect(item)}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: isSelected ? '#f0f9ff' : '#fff',
                  }}
                >
                  <View
                    style={{
                      height: 18,
                      width: 18,
                      borderRadius: 9,
                      borderWidth: 2,
                      borderColor: isSelected ? '#0ea5e9' : '#9ca3af',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    {isSelected ? (
                      <View style={{ height: 10, width: 10, borderRadius: 5, backgroundColor: '#0ea5e9' }} />
                    ) : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '600' }}>{item.label ?? 'Dirección'}</Text>
                    <Text numberOfLines={2} style={{ color: '#6b7280' }}>
                      {item.line1}
                      {item.city ? `, ${item.city}` : ''}
                    </Text>
                  </View>
                  {item.isDefault ? (
                    <Text style={{ marginLeft: 8, color: '#10b981', fontWeight: '600' }}>Pred.</Text>
                  ) : null}
                </Pressable>
              );
            }}
            ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#eee' }} />}
            ListEmptyComponent={
              <View style={{ padding: 16 }}>
                <Text style={{ color: '#6b7280' }}>No tienes direcciones guardadas.</Text>
              </View>
            }
            style={{ maxHeight: 360 }}
          />

          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            <TouchableOpacity
              onPress={onManage}
              style={{
                backgroundColor: '#111827',
                paddingVertical: 12,
                borderRadius: 10,
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>Administrar direcciones</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onClose}
              style={{
                backgroundColor: '#e5e7eb',
                paddingVertical: 12,
                borderRadius: 10,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontWeight: '700' }}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
