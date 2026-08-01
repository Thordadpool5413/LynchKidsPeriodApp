import React, { useState } from 'react';
import { Redirect, router } from 'expo-router';
import { Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppStore } from '@/store/app-store';
import { Body, Card, ChoiceChip, Heading, PrimaryButton } from '@/components/ui';
import { colors, fonts, radii } from '@/theme';

const slides = [
  {
    emoji: '🌸',
    title: 'Welcome to Glitter',
    body: 'A private place to learn about periods, notice how you feel, and grow at your own pace.',
  },
  {
    emoji: '🗓️',
    title: 'Estimates, not promises',
    body: 'Glitter can make a gentle guess after you track period starts. New periods can be irregular, and that is common.',
  },
  {
    emoji: '🔒',
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
    <LinearGradient colors={[colors.canvas, colors.lavenderSoft, colors.coralSoft]} style={{ flex: 1 }}>
      <View style={{ flex: 1, width: '100%', maxWidth: 620, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 70, paddingBottom: 34, justifyContent: 'space-between', gap: 24 }}>
        <View style={{ flexDirection: 'row', gap: 7 }}>
          {slides.map((_, index) => <View key={index} style={{ flex: 1, height: 6, borderRadius: radii.pill, backgroundColor: index <= step ? colors.lavender : 'rgba(140,115,217,0.18)' }} />)}
        </View>
        <Card style={{ alignItems: 'center', paddingVertical: 38, paddingHorizontal: 24 }}>
          <Text style={{ fontSize: 68 }}>{current.emoji}</Text>
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
              <ChoiceChip label="I can change this later" emoji="✨" onPress={() => undefined} />
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
      </View>
    </LinearGradient>
  );
}
