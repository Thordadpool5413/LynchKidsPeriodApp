import React from 'react';
import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { hasPlusAccess } from '@shared/entitlements';
import { useAppStore } from '@/store/app-store';
import { Body, Card, Heading, Page, PremiumBadge, PrimaryButton, SecondaryButton } from '@/components/ui';
import { colors, fonts, radii } from '@/theme';

const features = [
  ['💬', 'Ask Glitter', 'Private, age-appropriate answers from reviewed Glitter lessons.'],
  ['🧘🏽‍♀️', 'Self-Care Studio', 'Breathing, gentle movement, comfort, and school-day calm.'],
  ['📊', 'Pattern insights', 'Notice repeating feelings and symptoms without diagnosis.'],
  ['🎒', 'School toolkit', 'Kit lists, private plans, and words to use when asking for help.'],
  ['🌟', 'Monthly quests', 'Fresh lessons, confidence activities, stickers, and themes.'],
  ['☁️', 'Secure backup', 'Keep approved devices in sync after grown-up consent.'],
  ['🤝', 'Grown-up hub', 'Support summaries, conversation guides, and priority product help.'],
];

export default function PlusScreen() {
  const { data, enablePremiumPreview } = useAppStore();
  const premium = hasPlusAccess(data.entitlement);
  return (
    <Page>
      <LinearGradient colors={[colors.lavenderSoft, colors.coralSoft, colors.butterSoft]} style={{ borderRadius: radii.large, padding: 24, gap: 12, alignItems: 'center' }}>
        <PremiumBadge />
        <Heading size={31}>A little more support for every bloom</Heading>
        <Body center>Core tracking, journaling, safety help, privacy, export, and deletion always stay free.</Body>
      </LinearGradient>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {features.map(([emoji, title, body]) => (
          <Card key={title} style={{ flexGrow: 1, flexBasis: 260 }}>
            <Text style={{ fontSize: 28 }}>{emoji}</Text>
            <Heading size={19}>{title}</Heading>
            <Body muted>{body}</Body>
          </Card>
        ))}
      </View>

      <Card tone="lavender">
        <Text style={{ color: colors.ink, fontFamily: fonts.displayBold, fontSize: 28 }}>$39.99 <Text style={{ fontFamily: fonts.body, fontSize: 15 }}>/ year</Text></Text>
        <Body>Seven days free, then $39.99 yearly. Cancel anytime in subscription settings. Monthly option: $4.99.</Body>
        <Body muted>This local build uses a clearly labeled preview entitlement. App Store and Stripe checkout activate only after production credentials and review configuration are added.</Body>
        <PrimaryButton label={premium ? 'Plus preview active ✓' : 'Start 7-day preview'} disabled={premium} onPress={enablePremiumPreview} />
        <SecondaryButton label="Restore purchases (setup required)" onPress={() => undefined} />
      </Card>

      <Body muted>Subscriptions renew automatically unless canceled at least 24 hours before the current period ends. Production purchase screens will link to the Privacy Policy and Terms of Use.</Body>
    </Page>
  );
}
