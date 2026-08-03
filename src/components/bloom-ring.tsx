import React, { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import type { CyclePrediction } from '@shared/cycle';
import { colors, fonts, radii } from '@/theme';
import { GardenGlyph } from './garden-glyph';

export function BloomRing({ prediction, reducedMotion }: { prediction: CyclePrediction; reducedMotion: boolean }) {
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: -5, duration: 1600, useNativeDriver: true }),
      Animated.timing(float, { toValue: 0, duration: 1600, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [float, reducedMotion]);

  const center = prediction.daysUntil === undefined ? '—' : Math.max(prediction.daysUntil, 0).toString();
  const label = prediction.daysUntil === undefined ? 'starts tracked' : prediction.daysUntil === 0 ? 'around today' : 'days to Glitter';

  return (
    <View accessible accessibilityLabel={`${center} ${label}. ${prediction.message}`} style={{ alignItems: 'center', gap: 14 }}>
      <Animated.View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ transform: [{ translateY: float }] }}>
        <View style={{ width: 188, height: 188, alignItems: 'center', justifyContent: 'center' }}>
          {[0, 1, 2, 3, 4, 5].map((index) => {
            const angle = (Math.PI * 2 * index) / 6;
            return (
              <View key={index} style={{ position: 'absolute', transform: [{ translateX: Math.cos(angle) * 80 }, { translateY: Math.sin(angle) * 80 }, { rotate: index % 2 ? '45deg' : '0deg' }] }}>
                {index % 2 ? <View style={{ width: 9, height: 9, backgroundColor: colors.lavender }} /> : <GardenGlyph name="flower" color={index === 2 ? colors.coral : colors.success} size={24} />}
              </View>
            );
          })}
          <View style={{ width: 142, height: 142, borderRadius: radii.pill, borderWidth: 10, borderColor: colors.lavenderSoft, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', boxShadow: '0 12px 30px rgba(105, 75, 153, 0.18)' }}>
            <Text selectable style={{ color: colors.lavender, fontFamily: fonts.displayBold, fontSize: 48, lineHeight: 52, fontVariant: ['tabular-nums'] }}>{center}</Text>
            <Text selectable style={{ color: colors.inkMuted, fontFamily: fonts.utility, fontSize: 12 }}>{label}</Text>
          </View>
        </View>
      </Animated.View>
      <Text selectable style={{ maxWidth: 330, color: colors.ink, fontFamily: fonts.bodyBold, fontSize: 17, lineHeight: 24, textAlign: 'center' }}>{prediction.message}</Text>
      <Text selectable style={{ color: colors.inkMuted, fontFamily: fonts.body, fontSize: 12, textAlign: 'center' }}>
        {prediction.confidence === 'pattern-based' ? 'Based on your recent pattern—not a promise.' : 'Early estimate. A new Glitter often takes time to find a pattern.'}
      </Text>
    </View>
  );
}
