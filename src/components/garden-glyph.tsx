import React from 'react';
import { View } from 'react-native';
import { colors, radii } from '@/theme';

export type GardenGlyphName = 'flower' | 'calendar' | 'journal' | 'learn' | 'more' | 'care' | 'calm' | 'lock';

export function GardenGlyph({ name, color = colors.lavender, size = 26 }: { name: GardenGlyphName; color?: string; size?: number }) {
  const unit = size / 26;
  if (name === 'flower') return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
      {[[8, 1], [15, 3], [16, 11], [9, 16], [2, 11], [1, 4]].map(([left, top], index) => <View key={index} style={{ position: 'absolute', left: left * unit, top: top * unit, width: 10 * unit, height: 10 * unit, borderRadius: radii.pill, backgroundColor: color, opacity: 0.82 }} />)}
      <View style={{ position: 'absolute', left: 8 * unit, top: 8 * unit, width: 10 * unit, height: 10 * unit, borderRadius: radii.pill, backgroundColor: colors.butter }} />
    </View>
  );
  if (name === 'more') return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' }}>{[0, 1, 2].map((key) => <View key={key} style={{ width: 5 * unit, height: 5 * unit, borderRadius: radii.pill, backgroundColor: color }} />)}</View>;
  if (name === 'calm') return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size, borderWidth: 3 * unit, borderColor: color, borderRadius: radii.pill, opacity: 0.9 }} />;
  if (name === 'care') return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size, backgroundColor: colors.coralSoft, borderRadius: 8 * unit, borderWidth: 2 * unit, borderColor: color }}><View style={{ position: 'absolute', width: 10 * unit, height: 3 * unit, backgroundColor: color, left: 6 * unit, top: 10 * unit }} /><View style={{ position: 'absolute', width: 3 * unit, height: 10 * unit, backgroundColor: color, left: 9.5 * unit, top: 6.5 * unit }} /></View>;
  if (name === 'lock') return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 20 * unit, height: 16 * unit, marginTop: 8 * unit, marginLeft: 3 * unit, borderRadius: 5 * unit, backgroundColor: color }}><View style={{ position: 'absolute', width: 12 * unit, height: 12 * unit, left: 4 * unit, top: -8 * unit, borderWidth: 3 * unit, borderColor: color, borderRadius: radii.pill }} /></View>;
  const bookLike = name === 'journal' || name === 'learn';
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size, borderWidth: 2 * unit, borderColor: color, borderRadius: bookLike ? 5 * unit : 7 * unit, backgroundColor: bookLike ? colors.butterSoft : colors.lavenderSoft }}>
    {name === 'calendar' ? <><View style={{ height: 6 * unit, backgroundColor: color }} /><View style={{ margin: 4 * unit, flex: 1, borderTopWidth: unit, borderLeftWidth: unit, borderColor: color }} /></> : null}
    {bookLike ? <View style={{ position: 'absolute', left: 6 * unit, top: 4 * unit, bottom: 4 * unit, width: unit, backgroundColor: color }} /> : null}
  </View>;
}
