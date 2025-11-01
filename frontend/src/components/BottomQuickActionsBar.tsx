import React, { useMemo } from 'react';
import { View, Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useFavorites } from '../hooks/useFavorites';
import { useActiveOrdersCount } from '../hooks/useActiveOrders';
import { useAuth } from '../context/AuthContext';

const spacing = { sm: 12, md: 16 };
const colors = {
  bg: '#FFFFFF',
  border: '#E5E7EB',
  text: '#111827',
  iconBg: '#F3F4F6',
  badgeBg: '#ef4444',
};
const B2B_ENABLED = (process.env.EXPO_PUBLIC_FEATURE_B2B || 'false') === 'true';
const BUTTON_SIZE = 40;
const INNER_VERTICAL = spacing.sm * 0.75;
const TOP_PADDING = spacing.sm;

export const BASE_BOTTOM_QUICK_ACTION_HEIGHT = TOP_PADDING + BUTTON_SIZE + INNER_VERTICAL * 2;

export const getBottomQuickActionsPadding = (bottomInset: number) =>
  BASE_BOTTOM_QUICK_ACTION_HEIGHT + Math.max(bottomInset, spacing.sm);

const BottomQuickActionsBar = React.memo(function BottomQuickActionsBar() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { favorites } = useFavorites();
  const { data: activeOrders = 0 } = useActiveOrdersCount();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const buttons = useMemo(() => {
    const base: Array<{
      key: string;
      icon: React.ComponentProps<typeof Ionicons>['name'];
      color?: string;
      onPress: () => void;
      accessibilityLabel: string;
      badge?: string | null;
    }> = [
      {
        key: 'home',
        icon: 'home',
        onPress: () => navigation.navigate('Dashboard'),
        accessibilityLabel: 'Ir al inicio',
      },
      {
        key: 'favorites',
        icon: (favorites.length > 0 ? 'heart' : 'heart-outline') as React.ComponentProps<typeof Ionicons>['name'],
        color: favorites.length > 0 ? '#ef4444' : colors.text,
        onPress: () => navigation.navigate('Favorites'),
        accessibilityLabel: 'Mis favoritos',
      },
      {
        key: 'orders',
        icon: 'receipt-outline',
        onPress: () => navigation.navigate('MyOrders'),
        accessibilityLabel: 'Mis pedidos',
        badge: activeOrders > 0 ? (activeOrders > 99 ? '99+' : String(activeOrders)) : null,
      },
      {
        key: 'profile',
        icon: 'person-circle-outline',
        onPress: () => navigation.navigate('Profile'),
        accessibilityLabel: 'Mi perfil',
      },
    ];

    if (!isAdmin) return base;

    base.push(
      {
        key: 'admin-promos',
        icon: 'pricetags-outline',
        onPress: () => navigation.navigate('AdminPromotions'),
        accessibilityLabel: 'Promociones (admin)',
      },
      {
        key: 'admin-b2c',
        icon: 'pricetag-outline',
        onPress: () => navigation.navigate('AdminPriceListB2C'),
        accessibilityLabel: 'Lista de precios B2C',
      },
      {
        key: 'admin-b2b',
        icon: 'pricetags-outline',
        onPress: () => navigation.navigate('AdminPriceListB2B'),
        accessibilityLabel: 'Lista de precios B2B',
      },
      {
        key: 'admin-orders',
        icon: 'clipboard-outline',
        onPress: () => navigation.navigate('AdminOrders'),
        accessibilityLabel: 'Pedidos (admin)',
      },
    );

    if (B2B_ENABLED) {
      base.push({
        key: 'admin-apps',
        icon: 'briefcase-outline',
        onPress: () => navigation.navigate('AdminBusinessApplications'),
        accessibilityLabel: 'Solicitudes B2B',
      });
    }

    return base;
  }, [navigation, favorites.length, activeOrders, isAdmin]);

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingTop: TOP_PADDING,
        paddingBottom: Math.max(insets.bottom, spacing.sm),
        paddingHorizontal: spacing.md,
        backgroundColor: 'rgba(255,255,255,0.95)',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.sm,
          paddingHorizontal: spacing.sm * 0.75,
          paddingVertical: INNER_VERTICAL,
          borderRadius: 24,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bg,
        }}
      >
        {buttons.map((btn) => (
          <CircleIconButton
            key={btn.key}
            icon={btn.icon}
            color={btn.color}
            onPress={btn.onPress}
            accessibilityLabel={btn.accessibilityLabel}
            badge={btn.badge}
          />
        ))}
      </View>
    </View>
  );
});

function CircleIconButton({
  icon,
  color = colors.text,
  onPress,
  accessibilityLabel,
  badge,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color?: string;
  onPress: () => void;
  accessibilityLabel: string;
  badge?: string | null;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({
        paddingHorizontal: 4,
        paddingVertical: 4,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: BUTTON_SIZE,
          height: BUTTON_SIZE,
          borderRadius: BUTTON_SIZE / 2,
          backgroundColor: colors.iconBg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={20} color={color} />
        {badge ? (
          <View
            style={{
              position: 'absolute',
              top: -4,
              right: -2,
              backgroundColor: colors.badgeBg,
              borderRadius: 999,
              minWidth: 16,
              height: 16,
              paddingHorizontal: 3,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: '#fff',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{badge}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export default BottomQuickActionsBar;
