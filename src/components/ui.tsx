import React from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View, type PressableProps, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { colors, fonts, radii, shadows } from '@/theme';

export function Page({ children, gap = 18 }: { children: React.ReactNode; gap?: number }) {
  const { width } = useWindowDimensions();
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: colors.canvas }}
      contentContainerStyle={{
        width: '100%',
        maxWidth: 920,
        alignSelf: 'center',
        paddingHorizontal: width < 520 ? 18 : 28,
        paddingTop: 18,
        paddingBottom: 120,
        gap,
      }}
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children, tone = 'white', style }: {
  children: React.ReactNode;
  tone?: 'white' | 'lavender' | 'coral' | 'aqua' | 'butter';
  style?: ViewStyle;
}) {
  const backgrounds = {
    white: colors.card,
    lavender: colors.lavenderSoft,
    coral: colors.coralSoft,
    aqua: colors.aquaSoft,
    butter: colors.butterSoft,
  };
  return (
    <View style={{ backgroundColor: backgrounds[tone], borderRadius: radii.medium, borderCurve: 'continuous', padding: 18, gap: 12, boxShadow: shadows.card, ...style }}>
      {children}
    </View>
  );
}

export function Heading({ children, size = 26 }: { children: React.ReactNode; size?: number }) {
  return <Text selectable style={{ color: colors.ink, fontFamily: fonts.displayBold, fontSize: size, lineHeight: size * 1.12 }}>{children}</Text>;
}

export function Body({ children, muted = false, center = false }: { children: React.ReactNode; muted?: boolean; center?: boolean }) {
  return <Text selectable style={{ color: muted ? colors.inkMuted : colors.ink, fontFamily: fonts.body, fontSize: 16, lineHeight: 23, textAlign: center ? 'center' : 'left' }}>{children}</Text>;
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <Text selectable style={{ color: colors.lavender, fontFamily: fonts.utility, fontSize: 12, letterSpacing: 1.1, textTransform: 'uppercase' }}>{children}</Text>;
}

export function PrimaryButton({ label, onPress, disabled, tone = 'lavender', accessibilityHint }: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'lavender' | 'coral' | 'ink';
  accessibilityHint?: string;
}) {
  const tones = { lavender: colors.lavender, coral: colors.coral, ink: colors.ink };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      disabled={disabled}
      onPress={() => {
        if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => ({
        minHeight: 50,
        borderRadius: radii.pill,
        backgroundColor: tones[tone],
        opacity: disabled ? 0.45 : pressed ? 0.84 : 1,
        paddingHorizontal: 22,
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      <Text style={{ color: '#FFFFFF', fontFamily: fonts.bodyBold, fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, destructive = false }: { label: string; onPress: () => void; destructive?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 46,
        borderRadius: radii.pill,
        borderWidth: 1.5,
        borderColor: destructive ? colors.danger : colors.line,
        backgroundColor: pressed ? colors.lavenderSoft : '#FFFFFF',
        paddingHorizontal: 18,
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      <Text style={{ color: destructive ? colors.danger : colors.ink, fontFamily: fonts.bodyBold, fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

export function ChoiceChip({ label, emoji, selected, onPress }: { label: string; emoji?: string; selected?: boolean; onPress: PressableProps['onPress'] }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 46,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        paddingHorizontal: 15,
        borderRadius: radii.pill,
        borderWidth: 1.5,
        borderColor: selected ? colors.lavender : colors.line,
        backgroundColor: selected ? colors.lavenderSoft : pressed ? colors.butterSoft : '#FFFFFF',
      })}
    >
      {emoji ? <Text style={{ fontSize: 19 }}>{emoji}</Text> : null}
      <Text style={{ color: colors.ink, fontFamily: fonts.bodyBold, fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

export function SharedBanner() {
  return (
    <View accessibilityRole="text" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: colors.aquaSoft, borderRadius: radii.pill, paddingVertical: 7, paddingHorizontal: 11 }}>
      <Text style={{ fontSize: 14 }}>☁️</Text>
      <Text selectable style={{ color: colors.ink, fontFamily: fonts.utility, fontSize: 12 }}>Tracking shared with your grown-up</Text>
    </View>
  );
}

export function PremiumBadge() {
  return (
    <LinearGradient colors={[colors.lavender, colors.orchid]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ alignSelf: 'flex-start', borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 5 }}>
      <Text style={{ color: '#FFFFFF', fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 0.5 }}>PLUS ✦</Text>
    </LinearGradient>
  );
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.line }} />;
}

export function EmptyState({ emoji, title, body }: { emoji: string; title: string; body: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 8, paddingVertical: 22, paddingHorizontal: 16 }}>
      <Text style={{ fontSize: 38 }}>{emoji}</Text>
      <Text selectable style={{ color: colors.ink, fontFamily: fonts.display, fontSize: 20, textAlign: 'center' }}>{title}</Text>
      <Body muted center>{body}</Body>
    </View>
  );
}
