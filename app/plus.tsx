import React, { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { hasPlusAccess } from '@shared/entitlements';
import { useAppStore } from '@/store/app-store';
import { apiClient } from '@/services/api-client';
import { getOrCreateDevParentToken } from '@/services/session';
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
  const [checkoutLoading, setCheckoutLoading] = useState<'monthly' | 'annual' | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  async function startCheckout(plan: 'monthly' | 'annual') {
    setCheckoutError(null);
    setCheckoutLoading(plan);
    try {
      const token = await getOrCreateDevParentToken();
      const { url } = await apiClient.checkout(token, plan);
      if (Platform.OS === 'web') {
        window.location.href = url;
      } else {
        const { Linking } = await import('react-native');
        await Linking.openURL(url);
      }
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Checkout could not start. Try again.');
    } finally {
      setCheckoutLoading(null);
    }
  }

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
        <Body>Seven days free, then $39.99 yearly. Cancel anytime in subscription settings.</Body>

        {checkoutError ? <Body muted>{checkoutError}</Body> : null}

        {premium ? (
          <PrimaryButton label="Glitter Plus active ✓" onPress={() => undefined} disabled />
        ) : (
          <View style={{ gap: 10 }}>
            <PrimaryButton
              label={checkoutLoading === 'annual' ? 'Opening checkout…' : 'Start 7-day free trial — $39.99/yr'}
              disabled={checkoutLoading !== null}
              onPress={() => startCheckout('annual')}
            />
            {checkoutLoading !== 'monthly' ? (
              <SecondaryButton
                label="Monthly — $4.99/mo"
                onPress={() => startCheckout('monthly')}
              />
            ) : null}
          </View>
        )}

        <Body muted>Developer preview: the button below grants a local trial without a real purchase. Stripe checkout above is the real purchase path.</Body>
        {premium ? null : <SecondaryButton label="Enable local preview (no charge)" onPress={enablePremiumPreview} />}
        <SecondaryButton label="Restore purchases" onPress={() => undefined} />
      </Card>

      <Body muted>Subscriptions renew automatically unless canceled at least 24 hours before the current period ends. Purchase screens link to the Privacy Policy and Terms of Use.</Body>
    </Page>
  );
}
