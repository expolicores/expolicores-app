import React from 'react';
import { View, Text } from 'react-native';
import { statusColor, statusLabel } from '../lib/orderStatus';
import { OrderStatus } from '../types/order';

export default function StatusBadge({ status }: { status: OrderStatus }) {
  const bg = statusColor[status];
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
      <Text style={{ color: 'white', fontWeight: '600', fontSize: 12 }}>{statusLabel[status]}</Text>
    </View>
  );
}
