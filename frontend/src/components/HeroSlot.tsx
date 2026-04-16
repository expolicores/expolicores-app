// frontend/src/components/HeroSlot.tsx
import React, { memo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';

type Props = {
  title: string;
  subtitle?: string;
  image: string;
  onPress?: () => void;
  /** opcional: sobreescribe el texto del botón */
  ctaLabel?: string;
};

const spacing = { sm: 12, md: 16 };
const radius = { lg: 16 };
const colors = {
  text: '#111',
  textMuted: '#666',
  pillBg: 'rgba(0,0,0,0.7)',
};

function HeroSlotBase({ title, subtitle, image, onPress, ctaLabel = 'Ver todo' }: Props) {
  const uri = (image ?? '').trim();
  const hasImage = uri.length > 0;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} accessibilityRole="button">
      <View style={{ paddingHorizontal: spacing.md }}>
        {/* Imagen */}
        {hasImage ? (
          <Image
            source={{ uri }}
            style={{
              width: '100%',
              height: 200,
              borderRadius: radius.lg,
              backgroundColor: '#F6F7F8',
            }}
            contentFit="cover"
            transition={150}
            cachePolicy="memory-disk"
            onError={(e) => {
              console.log('[HeroSlot] image error', uri, e?.nativeEvent);
            }}
          />
        ) : (
          <View
            style={{
              width: '100%',
              height: 200,
              borderRadius: radius.lg,
              backgroundColor: '#F6F7F8',
              borderWidth: 1,
              borderColor: '#E5E7EB',
            }}
          />
        )}

        {/* Overlay de textos + CTA */}
        <View style={{ position: 'absolute', left: spacing.md + 8, right: spacing.md + 8, bottom: spacing.md + 8 }}>
          {!!title && (
            <Text style={{ color: 'white', fontWeight: '800', fontSize: 22 }} numberOfLines={2}>
              {title}
            </Text>
          )}
          {!!subtitle && (
            <Text style={{ color: 'white', opacity: 0.9, marginTop: 2 }} numberOfLines={2}>
              {subtitle}
            </Text>
          )}

          {/* Botón CTA: Ver todo */}
          <View
            style={{
              marginTop: 10,
              alignSelf: 'flex-start',
              backgroundColor: colors.pillBg,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
            }}
          >
            <Text style={{ color: 'white', fontWeight: '700' }}>{ctaLabel}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default memo(HeroSlotBase);
