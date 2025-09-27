import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  name: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  badge?: number | 'dot'; // number = contador, 'dot' = puntico, undefined = sin badge
  size?: number;
};

export default function HeaderIcon({ name, onPress, badge, size = 22 }: Props) {
  return (
    <TouchableOpacity onPress={onPress} hitSlop={{ top:8, bottom:8, left:8, right:8 }} style={s.btn}>
      <Ionicons name={name} size={size} color="#111" />
      {badge === 'dot' && <View style={s.dot} />}
      {typeof badge === 'number' && badge > 0 && (
        <View style={s.badge}>
          <Text style={s.badgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  btn: {
    backgroundColor: '#fff',
    padding: 6,
    borderRadius: 18,
    marginHorizontal: 6,
    position: 'relative',     // ⬅️ ancla para el badge
  },
  dot: {
    position: 'absolute',
    right: 1, top: 1,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#16a34a', zIndex: 2,
  },
  badge: {
    position: 'absolute',
    right: -2, top: -2,
    minWidth: 16, height: 16, borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: '#111',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 2,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});
