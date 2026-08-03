import React from 'react';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { colors, fonts, radii } from '@/theme';
import { Body, PremiumBadge } from './ui';

export function PremiumGate({ children, locked = true }: { children: React.ReactNode; locked?: boolean }) {
  if (!locked) return <>{children}</>;
  return (
    <View style={{ overflow: 'hidden', borderRadius: radii.medium, borderCurve: 'continuous' }}>
      <View pointerEvents="none" style={{ opacity: 0.22 }}>{children}</View>
      <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 18, backgroundColor: 'rgba(255,249,254,0.90)' }}>
        <PremiumBadge />
        <Body center>AvaCado Plus adds this extra support.</Body>
        <Link href="/plus" asChild>
          <Pressable accessibilityRole="button" style={{ backgroundColor: colors.ink, borderRadius: radii.pill, paddingHorizontal: 17, paddingVertical: 10 }}>
            <Text style={{ color: '#FFFFFF', fontFamily: fonts.bodyBold }}>See Plus</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}
