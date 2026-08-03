import React from 'react';
import { Image } from 'expo-image';
import { Text, View } from 'react-native';
import { colors, fonts, radii } from '@/theme';

export function BrandMark({ compact = false }: { compact?: boolean }) {
  const size = compact ? 46 : 72;
  return (
    <View accessible accessibilityLabel="AvaCado" style={{ flexDirection: 'row', alignItems: 'center', gap: compact ? 10 : 14 }}>
      <Image
        source={require('../../assets/brand/avacado-app-icon.png')}
        accessibilityElementsHidden
        contentFit="cover"
        style={{ width: size, height: size, borderRadius: compact ? 15 : radii.medium }}
      />
      <View>
        <Text style={{ color: colors.ink, fontFamily: fonts.displayBold, fontSize: compact ? 22 : 30, lineHeight: compact ? 25 : 34 }}>AvaCado</Text>
        <Text style={{ color: colors.coral, fontFamily: fonts.utility, fontSize: compact ? 11 : 13, letterSpacing: 0.4 }}>YOUR GLITTER GARDEN</Text>
      </View>
    </View>
  );
}
