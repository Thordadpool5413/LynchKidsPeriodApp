import React, { useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { predictNextPeriod } from '@shared/cycle';
import { hasPlusAccess } from '@shared/entitlements';
import { useAppStore } from '@/store/app-store';
import { todayISO } from '@/utils/date';
import { Body, Card, Divider, Heading, Page, PremiumBadge, PrimaryButton, SharedBanner } from '@/components/ui';
import { colors, fonts, radii } from '@/theme';

export default function ParentScreen() {
  const { data } = useAppStore();
  const [answer, setAnswer] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const prediction = useMemo(() => predictNextPeriod(data.cycleEvents, todayISO()), [data.cycleEvents]);
  const premium = hasPlusAccess(data.entitlement);
  const sharedEntries = data.journalEntries.filter((entry) => !entry.deletedAt && data.shareGrants.some((grant) => grant.resourceType === 'journal' && grant.resourceId === entry.id && !grant.revokedAt));
  const recentMoods = data.checkIns.filter((item) => !item.deletedAt).slice(-7);
  const cramps = recentMoods.filter((item) => item.symptoms.includes('cramps')).length;

  if (!unlocked) return (
    <Page>
      <Card tone="butter">
        <Heading size={25}>Grown-ups only</Heading>
        <Body>This simple task prevents accidental entry by a child. Production accounts also require verified parent authentication and consent.</Body>
        <Text style={{ color: colors.ink, fontFamily: fonts.bodyBold }}>What is 7 + 5?</Text>
        <TextInput accessibilityLabel="Adult gate answer" keyboardType="number-pad" value={answer} onChangeText={setAnswer} style={{ minHeight: 50, borderWidth: 1.5, borderColor: colors.line, borderRadius: radii.small, paddingHorizontal: 14, color: colors.ink, fontFamily: fonts.body, fontSize: 18 }} />
        <PrimaryButton label="Enter grown-up space" disabled={answer !== '12'} onPress={() => setUnlocked(true)} />
      </Card>
    </Page>
  );

  return (
    <Page>
      <View style={{ gap: 5 }}><Heading>Support dashboard</Heading><Body muted>One linked child · prototype data on this device</Body></View>
      {data.profile.cloudSyncEnabled ? <SharedBanner /> : null}
      {!premium ? <Card tone="lavender"><PremiumBadge /><Heading size={20}>Parent Support Hub is a Plus benefit</Heading><Body>Consent and privacy controls remain available without Plus. Start the local preview to see the full dashboard.</Body></Card> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, opacity: premium ? 1 : 0.45 }}>
        <Card style={{ flexGrow: 1, flexBasis: 210 }}><Text style={{ fontSize: 26 }}>🌸</Text><Heading size={18}>Cycle outlook</Heading><Body>{prediction.message}</Body></Card>
        <Card style={{ flexGrow: 1, flexBasis: 210 }}><Text style={{ fontSize: 26 }}>🫶</Text><Heading size={18}>Recent cramps</Heading><Text selectable style={{ color: colors.lavender, fontFamily: fonts.displayBold, fontSize: 34, fontVariant: ['tabular-nums'] }}>{cramps}</Text><Body muted>check-ins in the recent view</Body></Card>
        <Card style={{ flexGrow: 1, flexBasis: 210 }}><Text style={{ fontSize: 26 }}>🌈</Text><Heading size={18}>Lessons completed</Heading><Text selectable style={{ color: colors.lavender, fontFamily: fonts.displayBold, fontSize: 34, fontVariant: ['tabular-nums'] }}>{data.educationProgress.length}</Text></Card>
      </View>
      <Card>
        <Heading size={21}>Shared journal pages</Heading>
        <Body muted>Only pages the child deliberately shares appear here.</Body>
        <Divider />
        {sharedEntries.length ? sharedEntries.map((entry) => <View key={entry.id} style={{ gap: 5 }}><Heading size={17}>{entry.title}</Heading><Body>{entry.body}</Body></View>) : <Body>No journal pages have been shared.</Body>}
      </Card>
      <Card tone="aqua">
        <Heading size={21}>Conversation starter</Heading>
        <Body>“What would make period days at school feel easier? We can make a small plan together.”</Body>
      </Card>
      <Body muted>Dashboard insights are supportive summaries, not medical diagnoses. Seek professional care for concerning symptoms.</Body>
    </Page>
  );
}
