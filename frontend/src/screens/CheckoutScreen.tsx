import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, TextInput, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useCart } from '../context/CartContext';
import type { CreateOrderDto } from '../types/order';

export default function CheckoutScreen() {
  const navigation = useNavigation<any>();
  const { items: cartItems, subtotal, clear } = useCart();

  // Direcciones
  const { data: addresses, isLoading: loadingAddrs } = useQuery({
    queryKey: ['addresses'],
    queryFn: async () => (await api.get('/addresses')).data as any[],
  });
  const defaultAddress = React.useMemo(
    () => addresses?.find(a => a.isDefault) ?? addresses?.[0],
    [addresses]
  );

  const [notes, setNotes] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false); // 👈 anti multi-tap

  // Mutación: crear orden
  const createOrderMutation = useMutation({
    mutationFn: async (payload: CreateOrderDto) => (await api.post('/orders', payload)).data,
    onSuccess: (order: any) => {
      clear();
      navigation.replace('OrderSuccess', { orderId: order.id, total: order.total });
    },
    onError: (err: any) => {
      const code = err?.response?.data?.code as string | undefined;
      if (code?.startsWith?.('OUT_OF_STOCK')) Alert.alert('Sin stock', 'Algún producto está sin stock.');
      else if (code === 'COVERAGE_OUT_OF_RANGE') Alert.alert('Fuera de cobertura', 'Cambia tu dirección.');
      else if (code === 'ADDRESS_MISSING_GEO') Alert.alert('Dirección', 'Faltan coordenadas (lat/lng).');
      else if (code === 'ADDRESS_NOT_FOUND') Alert.alert('Dirección', 'No encontramos tu dirección.');
      else if (code === 'EMPTY_CART') Alert.alert('Carrito', 'Tu carrito está vacío.');
      else Alert.alert('Error', 'No pudimos crear la orden.');
    },
    onSettled: () => setIsSubmitting(false), // 👈 libera el botón pase lo que pase
  });

  const confirmDisabled =
    loadingAddrs ||
    !defaultAddress ||
    cartItems.length === 0 ||
    createOrderMutation.isLoading ||
    isSubmitting; // 👈

  const handleConfirm = () => {
    if (confirmDisabled) return; // 👈 corta taps si ya está deshabilitado
    if (!defaultAddress) {
      Alert.alert('Dirección', 'Elige o crea una dirección de entrega.');
      return;
    }
    setIsSubmitting(true); // 👈 deshabilita inmediatamente el botón

    const payload: CreateOrderDto = {
      addressId: defaultAddress.id,
      items: cartItems.map(it => ({ productId: it.productId, quantity: it.qty })), // usa productId/qty
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

  return (
    <ScrollView style={{ flex: 1, padding: 16 }}>
      {/* Dirección */}
      <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16, elevation: 2 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 6 }}>Dirección</Text>
        {defaultAddress ? (
          <>
            <Text style={{ fontSize: 14 }}>
              {defaultAddress.label} — {defaultAddress.line1}
              {defaultAddress.city ? `, ${defaultAddress.city}` : ''}
            </Text>
            <TouchableOpacity style={{ marginTop: 10 }} onPress={() => navigation.navigate('Addresses')}>
              <Text style={{ color: '#2563eb', fontWeight: '600' }}>Cambiar</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={{ color: '#6b7280' }}>No tienes dirección por defecto</Text>
            <TouchableOpacity style={{ marginTop: 10 }} onPress={() => navigation.navigate('Addresses')}>
              <Text style={{ color: '#2563eb', fontWeight: '600' }}>Agregar dirección</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Tu pedido — sin FlatList para evitar warning de listas anidadas */}
      <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16, elevation: 2 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 10 }}>Tu pedido</Text>
        {cartItems.map((item) => {
          const lineTotal = (Number(item.price) || 0) * (Number(item.qty) || 0);
          return (
            <View key={String(item.productId)} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
              <Text style={{ flex: 1 }} numberOfLines={1}>
                {item.name} × {item.qty}
              </Text>
              <Text style={{ fontWeight: '600' }}>
                {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(lineTotal)}
              </Text>
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
        <Row label="Subtotal" value={subtotal} />
        <Row label="Envío" value={'— se calcula al confirmar —'} isString />
        <View style={{ height: 8 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>
          El total final (subtotal + envío) se mostrará al confirmar. El envío se calcula por distancia.
        </Text>
      </View>

      {/* Confirmar */}
      <TouchableOpacity
        onPress={handleConfirm}
        disabled={confirmDisabled}
        style={{
          backgroundColor: confirmDisabled ? '#9ca3af' : '#16a34a',
          opacity: confirmDisabled ? 0.6 : 1,
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
  );
}

function Row({ label, value, isString }: { label: string; value: number | string; isString?: boolean }) {
  const display = isString
    ? String(value)
    : new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value as number);
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
      <Text style={{ color: '#374151' }}>{label}</Text>
      <Text style={{ fontWeight: '700' }}>{display}</Text>
    </View>
  );
}
