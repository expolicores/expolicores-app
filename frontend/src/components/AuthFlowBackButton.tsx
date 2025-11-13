// frontend/src/components/AuthFlowBackButton.tsx
import React from 'react';
import { TouchableOpacity, Text, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  onPress: () => void;
  label?: string;
  style?: StyleProp<ViewStyle>;
};

export default function AuthFlowBackButton({ onPress, label = 'Volver', style }: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 4,
          marginBottom: 16,
        },
        style,
      ]}
    >
      <Ionicons name="chevron-back" size={24} color="#111827" />
      <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginLeft: 4 }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

