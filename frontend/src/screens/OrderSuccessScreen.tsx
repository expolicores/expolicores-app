import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';

export default function OrderSuccessScreen() {
  const { params } = useRoute<any>();
  const navigation = useNavigation<any>();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Text style={{ fontSize: 20, fontWeight: '800', marginBottom: 8 }}>¡Pedido creado!</Text>
      <Text style={{ marginBottom: 16 }}>Orden #{params?.orderId}</Text>
      <Text style={{ marginBottom: 24 }}>
        Total:{' '}
        {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(params?.total ?? 0)}
      </Text>
      <TouchableOpacity
        onPress={() => navigation.navigate('MyOrders')} // Orders list
        style={{ backgroundColor: '#2563eb', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10 }}
      >
        <Text style={{ color: '#fff', fontWeight: '700' }}>Ver mis pedidos</Text>
      </TouchableOpacity>
    </View>
  );
}
