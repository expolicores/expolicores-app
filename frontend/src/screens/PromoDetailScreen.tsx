// frontend/src/screens/PromoDetailScreen.tsx
import React from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import formatCurrency from '../lib/formatCurrency';
import { useCart } from '../context/CartContext';

export default function PromoDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { promoItem } = route.params || {};
  const { addItem, addToCart } = useCart?.() || ({} as any);
  const addFn = addItem || addToCart; // soportar nombre distinto del contexto

  if (!promoItem) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>No pudimos cargar la promoción.</Text>
      </View>
    );
  }

  const handleAdd = async () => {
    try {
      if (addFn) {
        await addFn({ productId: promoItem.productId, qty: 1 });
      }
    } catch (e) {
      // opcional: toast de error
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#fff' }} contentContainerStyle={{ paddingBottom: 24 }}>
      <Image source={{ uri: promoItem.image }} style={{ width: '100%', height: 260 }} resizeMode="cover" />
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 20, fontWeight: '800' }}>{promoItem.title}</Text>
        {typeof promoItem.priceB2C === 'number' && (
          <Text style={{ marginTop: 8, fontSize: 18, fontWeight: '700' }}>
            {formatCurrency(promoItem.priceB2C)}
          </Text>
        )}
        {!!promoItem.description && (
          <Text style={{ marginTop: 12, color: '#555' }}>{promoItem.description}</Text>
        )}

        <TouchableOpacity
          onPress={handleAdd}
          style={{
            marginTop: 20,
            backgroundColor: '#111',
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
