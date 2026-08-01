import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { hasPlusAccess } from '@shared/entitlements';
import { useAppStore } from '@/store/app-store';
import { Body, Card, Heading, Page, PremiumBadge, PrimaryButton } from '@/components/ui';
import { colors, fonts, radii } from '@/theme';

const activities = [
  ['🫧', 'Five soft breaths', 'Breathe in gently for four counts, then out for six.'],
  ['🌿', 'Tiny stretch break', 'Relax your shoulders, reach up slowly, and stop if anything hurts.'],
  ['💧', 'Water check', 'Take a few sips and notice how your body feels.'],
  ['🎒', 'School reset', 'Check your kit, choose a trusted adult, and plan your bathroom words.'],
];

export default function SelfCareScreen() {
  const { data } = useAppStore();
  const premium = hasPlusAccess(data.entitlement);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setSeconds((value) => {
      if (value >= 49) { setRunning(false); return 50; }
      return value + 1;
    }), 1000);
    return () => clearInterval(timer);
  }, [running]);
  const phase = Math.floor(seconds / 5) % 2 === 0 ? 'Breathe in' : 'Breathe out';

  return (
    <Page>
      <Card tone="aqua" style={{ alignItems: 'center' }}>
        <PremiumBadge />
        <Heading size={25}>Five soft breaths</Heading>
        <View style={{ width: 170, height: 170, borderRadius: radii.pill, backgroundColor: colors.aqua, alignItems: 'center', justifyContent: 'center', borderWidth: 14, borderColor: colors.aquaSoft }}>
          <Text selectable style={{ color: colors.ink, fontFamily: fonts.displayBold, fontSize: 23 }}>{seconds === 50 ? 'You did it 🌟' : running ? phase : 'Ready?'}</Text>
          <Text selectable style={{ color: colors.ink, fontFamily: fonts.utility, fontVariant: ['tabular-nums'] }}>{seconds}/50 sec</Text>
        </View>
        <PrimaryButton label={!premium ? 'Plus required' : running ? 'Pause' : seconds === 50 ? 'Do it again' : 'Start breathing'} disabled={!premium} onPress={() => { if (seconds === 50) setSeconds(0); setRunning((value) => !value); }} />
      </Card>
      {activities.map(([emoji, title, body]) => <Card key={title}><Text style={{ fontSize: 28 }}>{emoji}</Text><Heading size={19}>{title}</Heading><Body muted>{body}</Body></Card>)}
      <Body muted>These comfort ideas do not replace medical care. Stop an activity if it hurts, and tell a trusted grown-up about severe or worrying symptoms.</Body>
    </Page>
  );
}
