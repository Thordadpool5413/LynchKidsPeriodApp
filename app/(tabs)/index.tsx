import React, { useMemo, useState } from 'react';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import type { Mood, Symptom } from '@shared/types';
import { predictNextPeriod } from '@shared/cycle';
import { hasPlusAccess } from '@shared/entitlements';
import { useAppStore } from '@/store/app-store';
import { todayISO } from '@/utils/date';
import { BloomRing } from '@/components/bloom-ring';
import { Body, Card, ChoiceChip, Eyebrow, Heading, Page, PremiumBadge, PrimaryButton, SharedBanner } from '@/components/ui';
import { colors, fonts, radii } from '@/theme';

const moods: { value: Mood; label: string; emoji: string }[] = [
  { value: 'good', label: 'Good', emoji: '😊' },
  { value: 'calm', label: 'Calm', emoji: '😌' },
  { value: 'tired', label: 'Tired', emoji: '🥱' },
  { value: 'emotional', label: 'Emotional', emoji: '🥹' },
  { value: 'worried', label: 'Worried', emoji: '😟' },
];

export default function HomeScreen() {
  const { data, addCheckIn, saveCycleDay } = useAppStore();
  const [mood, setMood] = useState<Mood | null>(null);
  const [cramps, setCramps] = useState(false);
  const [saved, setSaved] = useState(false);
  const today = todayISO();
  const prediction = useMemo(() => predictNextPeriod(data.cycleEvents, today), [data.cycleEvents, today]);
  const premium = hasPlusAccess(data.entitlement);
  const todayPeriod = data.cycleEvents.find((event) => event.date === today && !event.deletedAt && event.kind !== 'not-on-period');
  const greeting = data.profile.nickname ? `Hey ${data.profile.nickname}, how are you feeling?` : 'Hey girl, how are you feeling?';

  const saveFeeling = () => {
    if (!mood) return;
    const symptoms: Symptom[] = cramps ? ['cramps'] : [];
    addCheckIn(mood, symptoms);
    setSaved(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={{ height: 12, backgroundColor: colors.lavenderSoft }} />
      <Page>
        {data.profile.cloudSyncEnabled ? <SharedBanner /> : null}
        <View style={{ gap: 5 }}>
          <Eyebrow>Today in your garden</Eyebrow>
          <Heading>{greeting}</Heading>
        </View>

        <Card tone="lavender" style={{ paddingVertical: 22 }}>
          <BloomRing prediction={prediction} reducedMotion={data.reducedMotion} />
        </Card>

        <Card>
          <Heading size={21}>Quick check-in</Heading>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
            {moods.map((item) => <ChoiceChip key={item.value} label={item.label} emoji={item.emoji} selected={mood === item.value} onPress={() => { setMood(item.value); setSaved(false); }} />)}
            <ChoiceChip label="Cramps" emoji="🫶" selected={cramps} onPress={() => { setCramps((value) => !value); setSaved(false); }} />
          </View>
          <PrimaryButton label={saved ? 'Feeling saved ✓' : 'Save how I feel'} disabled={!mood} onPress={saveFeeling} />
        </Card>

        <Card tone={todayPeriod ? 'coral' : 'aqua'}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <View style={{ flex: 1, gap: 5 }}>
              <Heading size={20}>{todayPeriod ? 'You marked today as a period day' : 'Are you on your period today?'}</Heading>
              <Body muted>You can always change this later in Calendar.</Body>
            </View>
            <Text style={{ fontSize: 38 }}>{todayPeriod ? '🌺' : '🌱'}</Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
            <ChoiceChip label="It started today" selected={todayPeriod?.kind === 'period-start'} onPress={() => saveCycleDay(today, 'period-start', 'medium')} />
            <ChoiceChip label="I'm on it" selected={todayPeriod?.kind === 'period-day'} onPress={() => saveCycleDay(today, 'period-day', 'medium')} />
            <ChoiceChip label="Not today" selected={!todayPeriod} onPress={() => saveCycleDay(today, 'not-on-period')} />
          </View>
        </Card>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          <Link href="/ask-bloom" asChild>
            <Pressable style={({ pressed }) => ({ flexGrow: 1, flexBasis: 250, minHeight: 126, backgroundColor: colors.butterSoft, borderRadius: radii.medium, padding: 18, gap: 8, opacity: pressed ? 0.8 : 1 })}>
              <PremiumBadge />
              <Text style={{ color: colors.ink, fontFamily: fonts.display, fontSize: 20 }}>Ask Glitter 💬</Text>
              <Body muted>{premium ? 'Ask a private, age-appropriate question.' : 'Preview safe answers and Plus support.'}</Body>
            </Pressable>
          </Link>
          <Link href="/self-care" asChild>
            <Pressable style={({ pressed }) => ({ flexGrow: 1, flexBasis: 250, minHeight: 126, backgroundColor: colors.aquaSoft, borderRadius: radii.medium, padding: 18, gap: 8, opacity: pressed ? 0.8 : 1 })}>
              <Text style={{ fontSize: 25 }}>🧘🏽‍♀️</Text>
              <Text style={{ color: colors.ink, fontFamily: fonts.display, fontSize: 20 }}>Feel-better studio</Text>
              <Body muted>Breathing, stretches, and school-day calm.</Body>
            </Pressable>
          </Link>
        </View>
      </Page>
    </View>
  );
}
