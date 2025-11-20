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
import type {
  CreateOrderDto,
  OrderSuccess,
  PaymentMethod,
} from '../types/order';
import { validateGeo } from '../lib/api.geo';
import { useAuth } from '../context/AuthContext';
import { useSelectedAddress } from '../hooks/useSelectedAddress';
import type { Address } from '../types/address';
// ⬇️ NUEVO: helpers de notificaciones (local) y permiso
import { presentLocalNotification } from '../lib/notifications';
import { useNotifications } from '../context/NotificationsContext';

// Etiquetas amigables para UI según método de pago
const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Efectivo',
  TRANSFER: 'Transferencia',
  CARD: 'Tarjeta',
  CREDIT: 'Crédito',
};

export default function CheckoutScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const role = user?.role as 'ADMIN' | 'B2B' | 'B2C' | undefined;
  const isB2BPriceUser = role === 'ADMIN' || role === 'B2B';
  const isBusinessUser = role === 'ADMIN' || role === 'B2B';

  const { items: cartItems, clear, remove } = useCart();

  // Notifs (permiso best-effort para locales)
  const { status: notifStatus, ensurePermission } = useNotifications();

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
  const { selectedAddress, setSelectedAddress } = useSelectedAddress(
    addresses ?? null,
  );
  const [pickerOpen, setPickerOpen] = React.useState(false);

  // === Envío ===
  const [notes, setNotes] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [shippingInfo, setShippingInfo] =
    React.useState<{ cost: number; distanceKm: number } | null>(null);
  const [shippingLoading, setShippingLoading] = React.useState(false);
  const [shippingError, setShippingError] =
    React.useState<string | null>(null);

  // Forma de pago (default: efectivo)
  const [paymentMethod, setPaymentMethod] =
    React.useState<PaymentMethod>('CASH');

  // Ajuste defensivo: si deja de ser negocio y tenía Crédito, volvemos a Efectivo
  React.useEffect(() => {
    if (!isBusinessUser && paymentMethod === 'CREDIT') {
      setPaymentMethod('CASH');
    }
  }, [isBusinessUser, paymentMethod]);

  // NUEVO: modal de confirmación de mayoría de edad
  const [ageModalVisible, setAgeModalVisible] = React.useState(false);

  // Recalcula envío cuando cambia la dirección seleccionada
  React.useEffect(() => {
    if (!selectedAddress) {
      setShippingInfo(null);
      setShippingError(null);
      setShippingLoading(false);
      return;
    }

    const lat =
      typeof selectedAddress.lat === 'number' ? selectedAddress.lat : null;
    const lng =
      typeof selectedAddress.lng === 'number' ? selectedAddress.lng : null;

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
        setShippingInfo({
          cost: resp.shippingCost,
          distanceKm: resp.distanceKm,
        });
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

  const currency = (v: number) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(v || 0);

  // === Mutación: crear orden ===
  const createOrderMutation = useMutation({
    mutationFn: async (payload: CreateOrderDto) =>
      (await api.post('/orders', payload)).data,
    onSuccess: async (order: OrderSuccess) => {
      // Local inmediata (best-effort). Intentamos permiso si aún no está otorgado.
      try {
        if (notifStatus !== 'granted') {
          await ensurePermission().catch(() => {});
        }
        await presentLocalNotification(
          'Pedido creado',
          `Recibimos tu pedido #${order.id} por ${currency(order.total)}`,
        );
      } catch {
        // noop: no bloquea el flujo si falla la local
      }

      // Limpia carrito y navega a éxito
      clear();
      navigation.replace('OrderSuccess' as never, {
        orderId: order.id,
        total: order.total,
        subtotal: order.subtotal,
        shipping: order.shipping,
      } as never);
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
        const missing = Array.isArray((payload as any)?.missing)
          ? (payload as any).missing
          : [];
        if (missing.length) {
          const missingNames = cartItems
            .filter((it) => missing.includes(it.productId))
            .map((it) => it.name);
          missing.forEach((id: number) => remove(id));
          const label = missingNames.length
            ? missingNames.join(', ')
            : 'Algunos productos';
          Alert.alert(
            'Producto no disponible',
            `${label} ya no está disponible y fue removido de tu carrito.`,
          );
        } else {
          Alert.alert(
            'Producto no disponible',
            'Un producto ya no está disponible.',
          );
        }
      } else if (code === 'PAYMENT_METHOD_CREDIT_NOT_ALLOWED') {
        Alert.alert(
          'Forma de pago',
          'El método de pago Crédito solo está disponible para negocios.',
        );
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

  // Lógica real de creación de la orden (se llama solo DESPUÉS de confirmar mayoría de edad)
  const proceedCreateOrder = () => {
    if (confirmDisabled) return;

    if (!selectedAddress) {
      Alert.alert('Dirección', 'Elige o crea una dirección de entrega.');
      return;
    }

    if (!shippingInfo) {
      Alert.alert(
        'Envío',
        shippingError ?? 'Calculando envío.\nIntenta en unos segundos.',
      );
      return;
    }

    setIsSubmitting(true);

    const payload: CreateOrderDto = {
      addressId: selectedAddress.id, // ← usa la dirección elegida en el modal
      items: cartItems.map((it) => ({
        productId: it.productId,
        quantity: it.qty,
      })),
      notes: notes.trim() || undefined,
      // Enviamos el método de pago real seleccionado
      paymentMethod,
    };

    createOrderMutation.mutate(payload);
  };

  // Handler del botón "Confirmar pedido"
  const handleConfirm = () => {
    if (confirmDisabled) return;
    // Para este release, siempre mostramos el popup de mayoría de edad antes de crear la orden
    setAgeModalVisible(true);
  };

  if (loadingAddrs) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={{ marginTop: 12, color: '#6B7280' }}>
          Cargando dirección…
        </Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: '#ffffff' }}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
      >
        {/* Dirección */}
        <View
          style={{
            marginBottom: 16,
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#e5e7eb',
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 4 }}>
            Dirección
          </Text>

          {selectedAddress ? (
            <>
              <Text style={{ color: '#111827', marginBottom: 4 }}>
                {selectedAddress.label ?? 'Dirección'} —{' '}
                {selectedAddress.line1}
                {selectedAddress.city ? `, ${selectedAddress.city}` : ''}
              </Text>
              <TouchableOpacity
                onPress={() => setPickerOpen(true)}
                style={{ paddingVertical: 4 }}
              >
                <Text
                  style={{
                    color: '#2563EB',
                    textDecorationLine: 'underline',
                  }}
                >
                  Cambiar
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={{ color: '#6B7280', marginBottom: 4 }}>
                No tienes direcciones seleccionadas.
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('Addresses' as never)}
                style={{ paddingVertical: 4 }}
              >
                <Text
                  style={{
                    color: '#2563EB',
                    textDecorationLine: 'underline',
                  }}
                >
                  Agregar dirección
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Forma de pago */}
        <View
          style={{
            marginBottom: 16,
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#e5e7eb',
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 8 }}>
            Forma de pago
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {[
              { key: 'CASH', label: 'Efectivo' },
              { key: 'TRANSFER', label: 'Transferencia' },
              { key: 'CARD', label: 'Tarjeta' },
              // Crédito solo para B2B / ADMIN
              ...(isBusinessUser
                ? [{ key: 'CREDIT', label: 'Crédito' }]
                : []),
            ].map((opt) => {
              const isSelected = paymentMethod === (opt.key as PaymentMethod);
              return (
                <Pressable
                  key={opt.key}
                  onPress={() =>
                    setPaymentMethod(opt.key as PaymentMethod)
                  }
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: isSelected ? '#10B981' : '#e5e7eb',
                    backgroundColor: isSelected ? '#ECFDF5' : '#ffffff',
                    marginRight: 8,
                    marginBottom: 8,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '500',
                      color: isSelected ? '#065F46' : '#111827',
                    }}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Tu pedido */}
        <View
          style={{
            marginBottom: 16,
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#e5e7eb',
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 8 }}>
            Tu pedido
          </Text>
          {cartItems.map((item) => {
            const unit = getUnitPriceForItem(item);
            const qty = Number(item.qty) || 0;
            const lineTotal = unit * qty;
            return (
              <View
                key={item.productId}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginBottom: 4,
                }}
              >
                <Text style={{ color: '#111827' }}>
                  {item.name} × {qty}
                </Text>
                <Text style={{ color: '#111827', fontWeight: '600' }}>
                  {currency(lineTotal)}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Notas */}
        <View
          style={{
            marginBottom: 16,
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#e5e7eb',
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 4 }}>
            Notas (opcional)
          </Text>
          <TextInput
            multiline
            placeholder="Ej: Dejar en portería, llamar al llegar..."
            value={notes}
            onChangeText={setNotes}
            style={{
              minHeight: 60,
              textAlignVertical: 'top',
              padding: 8,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: '#e5e7eb',
            }}
          />
        </View>

        {/* Resumen */}
        <View
          style={{
            marginBottom: 16,
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#e5e7eb',
            gap: 4,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 8 }}>
            Resumen
          </Text>

          <Row label="Subtotal" value={computedSubtotal} />

          {shippingInfo ? (
            <>
              <Row label="Envío" value={shippingInfo.cost} />
              <Row
                label="Total"
                value={computedSubtotal + shippingInfo.cost}
              />
              <Row
                label="Forma de pago"
                value={PAYMENT_LABELS[paymentMethod]}
                isString
              />
            </>
          ) : null}

          <Text
            style={{
              marginTop: 8,
              color: '#6B7280',
              fontSize: 12,
            }}
          >
            {shippingInfo
              ? `Envío estimado para ${shippingInfo.distanceKm.toFixed(
                  1,
                )} km.`
              : shippingError
              ? `${shippingError}.\nActualiza tu dirección para continuar.`
              : 'El envío se calcula por distancia. Edita tu dirección para estimarlo.'}
          </Text>
        </View>

        {/* Confirmar */}
        <View style={{ marginTop: 8 }}>
          {createOrderMutation.isLoading || isSubmitting ? (
            <View
              style={{
                backgroundColor: '#10B981',
                padding: 16,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
              }}
            >
              <ActivityIndicator color="#ffffff" />
              <Text
                style={{
                  color: '#ffffff',
                  fontWeight: '700',
                  fontSize: 16,
                  marginLeft: 8,
                }}
              >
                Creando pedido...
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              disabled={confirmDisabled}
              onPress={handleConfirm}
              style={{
                backgroundColor: confirmDisabled ? '#9CA3AF' : '#10B981',
                padding: 16,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  color: '#ffffff',
                  fontWeight: '700',
                  fontSize: 16,
                }}
              >
                Confirmar pedido
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* ===== MODAL: Confirmación mayoría de edad ===== */}
      <Modal
        visible={ageModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setAgeModalVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
          }}
        >
          <View
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 16,
              padding: 20,
              width: '100%',
              maxWidth: 400,
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: '800',
                marginBottom: 8,
                color: '#111827',
              }}
            >
              Confirmación de edad
            </Text>
            <Text style={{ color: '#374151', marginBottom: 16 }}>
              Para continuar con tu pedido, confirma que eres mayor de 18 años.
              El consumo de alcohol es exclusivo para adultos.
            </Text>

            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'flex-end',
                marginTop: 8,
              }}
            >
              <TouchableOpacity
                onPress={() => setAgeModalVisible(false)}
                style={{ paddingVertical: 8, paddingHorizontal: 12 }}
              >
                <Text style={{ color: '#374151' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setAgeModalVisible(false);
                  proceedCreateOrder();
                }}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 16,
                  borderRadius: 999,
                  backgroundColor: '#10B981',
                  marginLeft: 8,
                }}
              >
                <Text
                  style={{
                    color: '#ffffff',
                    fontWeight: '700',
                  }}
                >
                  Soy mayor de 18 años
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
          navigation.navigate('Addresses' as never);
        }}
      />
    </>
  );
}

function Row({
  label,
  value,
  isString,
}: {
  label: string;
  value: number | string;
  isString?: boolean;
}) {
  const display = isString
    ? String(value)
    : new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0,
      }).format(value as number);

  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 2,
      }}
    >
      <Text style={{ color: '#4B5563' }}>{label}</Text>
      <Text style={{ color: '#111827', fontWeight: '600' }}>{display}</Text>
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
  const { visible, addresses, selectedId, onSelect, onClose, onManage } =
    props;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <View
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 16,
            padding: 16,
            maxHeight: '80%',
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: '700',
              marginBottom: 12,
              color: '#111827',
            }}
          >
            Elegir dirección de entrega
          </Text>

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
                  {isSelected ? (
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        backgroundColor: '#0EA5E9',
                        marginRight: 8,
                      }}
                    />
                  ) : null}
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontWeight: '600',
                        color: '#111827',
                      }}
                    >
                      {item.label ?? 'Dirección'}
                    </Text>
                    <Text style={{ color: '#4B5563' }}>
                      {item.line1}
                      {item.city ? `, ${item.city}` : ''}
                    </Text>
                    {item.isDefault ? (
                      <Text
                        style={{
                          color: '#10B981',
                          fontSize: 12,
                          marginTop: 2,
                        }}
                      >
                        Predeterminada
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            }}
            ItemSeparatorComponent={() => (
              <View
                style={{
                  height: 1,
                  backgroundColor: '#e5e7eb',
                  marginHorizontal: 16,
                }}
              />
            )}
            ListEmptyComponent={
              <View style={{ paddingVertical: 16 }}>
                <Text style={{ color: '#6B7280' }}>
                  No tienes direcciones guardadas.
                </Text>
              </View>
            }
            style={{ maxHeight: 360 }}
          />

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginTop: 16,
            }}
          >
            <TouchableOpacity onPress={onManage}>
              <Text
                style={{
                  color: '#2563EB',
                  textDecorationLine: 'underline',
                }}
              >
                Administrar direcciones
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ color: '#374151' }}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
