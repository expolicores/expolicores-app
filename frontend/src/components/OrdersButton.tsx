import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useActiveOrdersCount } from '../hooks/useActiveOrders';

type Props = { color?: string };

export default function OrdersButton({ color = '#111' }: Props) {
  const navigation = useNavigation<any>();
  const { data: count = 0 } = useActiveOrdersCount();

  return (
    <Pressable
      onPress={() => navigation.navigate('MyOrders')}
      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }, styles.wrap]}
      accessibilityLabel="Mis pedidos"
    >
      <View style={styles.iconWrap}>
        <Ionicons name="receipt-outline" size={22} color={color} />
        {count > 0 && <View style={styles.dot} />}
      </View>
      {/* opcional: numerito */}
      {count > 0 && <Text style={styles.countText}>{count}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 6, flexDirection: 'row', alignItems: 'center' },
  iconWrap: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dot: {
    position: 'absolute', right: 0, top: 0,
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#0E8A3A', // verde Boyacá
    borderWidth: 1, borderColor: '#fff',
  },
  countText: { marginLeft: 4, fontSize: 12, fontWeight: '700', color: '#0E8A3A' },
});
