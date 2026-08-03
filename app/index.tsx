import React, { useState } from 'react';
import { Redirect, router } from 'expo-router';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useAppStore } from '@/store/app-store';
import { Body, Card, ChoiceChip, Heading, PrimaryButton } from '@/components/ui';
import { colors, fonts, radii } from '@/theme';
import { GardenGlyph, type GardenGlyphName } from '@/components/garden-glyph';
import { BrandMark } from '@/components/brand-mark';

const slides = [
  {
    icon: 'flower' as GardenGlyphName,
    title: 'Welcome to AvaCado',
    body: 'A private place to learn about your Glitter, notice how you feel, and grow at your own pace.',
  },
  {
    icon: 'calendar' as GardenGlyphName,
    title: 'Estimates, not promises',
    body: 'AvaCado can make a gentle guess after you track Glitter starts. A new Glitter can be irregular, and that is common.',
  },
  {
    icon: 'lock' as GardenGlyphName,
    title: 'You stay in control',
    body: 'Your free journal stays on this device. A grown-up can only see a journal entry when you choose to share that entry.',
  },
];

export default function WelcomeScreen() {
  const { data, hydrated, completeOnboarding } = useAppStore();
  const [step, setStep] = useState(0);
  const [nickname, setNickname] = useState('');
  if (!hydrated) return null;
  if (data.onboardingComplete) return <Redirect href="/(tabs)" />;

  const current = slides[step];
  return (
    <LinearGradient colors={[colors.canvas, colors.butterSoft, colors.aquaSoft]} style={{ flex: 1 }}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ flexGrow: 1, width: '100%', maxWidth: 620, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 42, paddingBottom: 34, justifyContent: 'space-between', gap: 24 }}>
        <View style={{ flexDirection: 'row', gap: 7 }}>
          {slides.map((_, index) => <View key={index} style={{ flex: 1, height: 6, borderRadius: radii.pill, backgroundColor: index <= step ? colors.lavender : 'rgba(140,115,217,0.18)' }} />)}
        </View>
        <BrandMark />
        <Card style={{ alignItems: 'center', paddingVertical: 28, paddingHorizontal: 24 }}>
          {step === 0 ? <Image source={require('../assets/brand/avacado-garden-hero.png')} accessibilityLabel="AvaCado standing in her Glitter Garden beside a private school pouch" contentFit="cover" style={{ width: '100%', aspectRatio: 1.5, borderRadius: radii.medium }} /> : <GardenGlyph name={current.icon} size={62} />}
          <Heading size={32}>{current.title}</Heading>
          <Body center>{current.body}</Body>
          {step === slides.length - 1 ? (
            <View style={{ width: '100%', gap: 9, paddingTop: 8 }}>
              <Text style={{ color: colors.ink, fontFamily: fonts.bodyBold, fontSize: 14 }}>What should we call you? (optional)</Text>
              <TextInput
                accessibilityLabel="Nickname"
                value={nickname}
                onChangeText={setNickname}
                maxLength={24}
                placeholder="A nickname"
                placeholderTextColor={colors.inkMuted}
                style={{ minHeight: 50, borderWidth: 1.5, borderColor: colors.line, borderRadius: radii.small, backgroundColor: '#FFFFFF', color: colors.ink, fontFamily: fonts.body, fontSize: 16, paddingHorizontal: 15 }}
              />
              <ChoiceChip label="I can change this later" onPress={() => undefined} />
            </View>
          ) : null}
        </Card>
        <PrimaryButton
          label={step === slides.length - 1 ? 'Start my garden' : 'Next'}
          onPress={() => {
            if (step < slides.length - 1) setStep((value) => value + 1);
            else {
              completeOnboarding(nickname);
              router.replace('/(tabs)');
            }
          }}
        />
      </ScrollView>
    </LinearGradient>
  );
}
