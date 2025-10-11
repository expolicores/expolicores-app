import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { useFavorites } from '../hooks/useFavorites';

export default function FavoritesButton({ color = '#111' }: { color?: string }) {
  const navigation = useNavigation<any>();
  const { favorites } = useFavorites();
  const hasFavorites = favorites.length > 0;

  const iconName = hasFavorites ? 'heart' : 'heart-outline';
  const iconColor = hasFavorites ? '#ef4444' : color;

  return (
    <Pressable
      onPress={() => navigation.navigate('Favorites')}
      accessibilityRole="button"
      accessibilityLabel="Mis favoritos"
      style={styles.wrap}
    >
      <View style={styles.iconWrap}>
        <Ionicons name={iconName as any} size={22} color={iconColor} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 6, justifyContent: 'center', alignItems: 'center' },
  iconWrap: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
