// frontend/src/screens/OrderSuccessScreen.tsx
import React from 'react';
import { View, Text, TouchableOpacity, Linking, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';

export default function OrderSuccessScreen() {
  const { params } = useRoute<any>();
  const navigation = useNavigation<any>();

  const orderId: number | undefined = params?.orderId;
  const total: number = params?.total ?? 0;

  const openWhatsApp = async () => {
    const message = encodeURIComponent(`Hola 👋, consulto por mi pedido #${orderId ?? ''}.`);
    const waUrl = `whatsapp://send?text=${message}`;
    const waWeb = `https://wa.me/?text=${message}`;
    try {
      const canOpen = await Linking.canOpenURL('whatsapp://send');
      if (canOpen) await Linking.openURL(waUrl);
      else await Linking.openURL(waWeb);
    } catch {
      Alert.alert('No se pudo abrir WhatsApp', 'Revisa que tengas WhatsApp instalado o intenta de nuevo.');
    }
  };

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Text style={{ fontSize: 20, fontWeight: '800', marginBottom: 8 }}>¡Pedido creado!</Text>
      <Text style={{ marginBottom: 16 }}>Orden #{orderId ?? '—'}</Text>
      <Text style={{ marginBottom: 24, color: '#6b7280', textAlign: 'center' }}>
        Te enviamos la confirmación por WhatsApp al número de tu perfil.
      </Text>

      <Text style={{ marginBottom: 8, fontWeight: '600' }}>
        Total pagado: ${total.toLocaleString('es-CO')}
      </Text>

      <TouchableOpacity
        onPress={() => navigation.navigate('MyOrders')}
        style={{
          backgroundColor: '#111827',
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderRadius: 8,
          width: '100%',
          marginTop: 16,
        }}
      >
        <Text style={{ color: 'white', textAlign: 'center', fontWeight: '700' }}>
          Ver mis pedidos
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={openWhatsApp}
        style={{
          backgroundColor: '#10b981',
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderRadius: 8,
          width: '100%',
          marginTop: 12,
        }}
      >
        <Text style={{ color: 'white', textAlign: 'center', fontWeight: '700' }}>
          Contactar por WhatsApp
        </Text>
      </TouchableOpacity>
    </View>
  );
}
