import React, { useState } from 'react';
import { Platform, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { hasPlusAccess } from '@shared/entitlements';
import type { EntitlementStatus } from '@shared/types';
import { useAppStore } from '@/store/app-store';
import { apiClient } from '@/services/api-client';
import { readCloudSession } from '@/services/cloud-session';
import { Body, Card, Heading, Page, PremiumBadge, PrimaryButton, SecondaryButton } from '@/components/ui';
import { colors, fonts, radii } from '@/theme';

function statusLabel(status: EntitlementStatus): string {
  switch (status) {
    case 'trialing': return 'Free trial';
    case 'active': return 'Active';
    case 'grace_period': return 'Active (grace period)';
    case 'billing_retry': return 'Past due — update payment';
    case 'expired': return 'Expired';
    default: return status;
  }
}

function statusColor(status: EntitlementStatus): string {
  if (status === 'trialing' || status === 'active' || status === 'grace_period') return colors.lavender;
  if (status === 'billing_retry') return '#c0392b';
  return colors.ink;
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

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
  const entitlement = data.entitlement;
  // Show billing info for any subscriber state that implies an existing Stripe record.
  const hasSubscriptionRecord = entitlement.status !== 'free';
  const [checkoutLoading, setCheckoutLoading] = useState<'monthly' | 'annual' | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  // Sign-in-before-checkout flow
  const [showSignIn, setShowSignIn] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<'monthly' | 'annual' | null>(null);
  const [signInEmail, setSignInEmail] = useState('');
  const [signInState, setSignInState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [signInError, setSignInError] = useState<string | null>(null);

  async function startCheckout(plan: 'monthly' | 'annual') {
    setCheckoutError(null);

    // Check for a stored session token first.
    const session = await readCloudSession();
    if (!session || session.role !== 'parent') {
      // No session — prompt for sign-in before checkout.
      setPendingPlan(plan);
      setShowSignIn(true);
      return;
    }

    setCheckoutLoading(plan);
    try {
      const { url } = await apiClient.checkout(session.token, plan);
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

  async function openPortal() {
    const session = await readCloudSession();
    if (!session || session.role !== 'parent') {
      setPortalError('Sign in to your parent account to manage your subscription.');
      return;
    }
    setPortalLoading(true);
    setPortalError(null);
    try {
      const { url } = await apiClient.billingPortal(session.token);
      if (Platform.OS === 'web') {
        window.location.href = url;
      } else {
        const { Linking } = await import('react-native');
        await Linking.openURL(url);
      }
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : 'Could not open billing portal. Try again.');
    } finally {
      setPortalLoading(false);
    }
  }

  async function handleRequestLink() {
    if (!signInEmail.trim()) return;
    setSignInState('sending');
    setSignInError(null);
    try {
      await apiClient.requestParentLink(signInEmail.trim());
      setSignInState('sent');
    } catch (err) {
      setSignInError(err instanceof Error ? err.message : 'Could not send sign-in link. Try again.');
      setSignInState('error');
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

        {hasSubscriptionRecord ? (
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
              <Body muted>Status</Body>
              <Text style={{ fontFamily: fonts.bodyBold, color: statusColor(entitlement.status) }}>{statusLabel(entitlement.status)}</Text>
            </View>
            {entitlement.plan ? (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
                <Body muted>Plan</Body>
                <Text style={{ fontFamily: fonts.bodyBold, color: colors.ink }}>{entitlement.plan === 'annual' ? 'Annual' : 'Monthly'}</Text>
              </View>
            ) : null}
            {entitlement.status === 'trialing' && entitlement.trialEndsAt ? (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
                <Body muted>Trial ends</Body>
                <Text style={{ fontFamily: fonts.bodyBold, color: colors.ink }}>{formatDate(entitlement.trialEndsAt)}</Text>
              </View>
            ) : (entitlement.status === 'active' || entitlement.status === 'grace_period') && entitlement.currentPeriodEndsAt ? (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
                <Body muted>Renews</Body>
                <Text style={{ fontFamily: fonts.bodyBold, color: colors.ink }}>{formatDate(entitlement.currentPeriodEndsAt)}</Text>
              </View>
            ) : null}
            {portalError ? <Body muted>{portalError}</Body> : null}
            <SecondaryButton
              label={portalLoading ? 'Opening portal…' : 'Manage subscription'}
              onPress={openPortal}
            />
          </View>
        ) : null}

        {showSignIn ? (
          signInState === 'sent' ? (
            <>
              <Text style={{ fontSize: 24 }}>📬</Text>
              <Heading size={20}>Check your email</Heading>
              <Body>A sign-in link has been sent to <Text style={{ fontFamily: fonts.bodyBold }}>{signInEmail}</Text>. Tap the link to sign in, then come back here to complete your purchase.</Body>
              <Body muted>The link expires in 15 minutes.</Body>
              <SecondaryButton label="Use a different email" onPress={() => { setSignInState('idle'); setSignInEmail(''); }} />
            </>
          ) : (
            <>
              <Heading size={20}>Sign in to continue</Heading>
              <Body>Enter your parent email to receive a secure sign-in link. Then come back here to complete your purchase{pendingPlan ? ` (${pendingPlan})` : ''}.</Body>
              {signInState === 'error' && signInError ? <Body muted>{signInError}</Body> : null}
              <TextInput
                accessibilityLabel="Email address"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={signInEmail}
                onChangeText={setSignInEmail}
                placeholder="your@email.com"
                placeholderTextColor={colors.ink + '66'}
                style={{ minHeight: 50, borderWidth: 1.5, borderColor: colors.line, borderRadius: radii.small, paddingHorizontal: 14, color: colors.ink, fontFamily: fonts.body, fontSize: 18 }}
              />
              <PrimaryButton
                label={signInState === 'sending' ? 'Sending link…' : 'Send sign-in link'}
                disabled={signInState === 'sending' || !signInEmail.trim()}
                onPress={handleRequestLink}
              />
              <SecondaryButton label="Cancel" onPress={() => { setShowSignIn(false); setPendingPlan(null); setSignInState('idle'); }} />
            </>
          )
        ) : premium ? (
          <PrimaryButton label="Glitter Plus active ✓" onPress={() => undefined} disabled />
        ) : !hasSubscriptionRecord ? (
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
        ) : null}

        {__DEV__ ? <Body muted>Developer preview: the button below grants a local trial without a real purchase. Stripe checkout above is the real purchase path.</Body> : null}
        {__DEV__ && !hasSubscriptionRecord ? <SecondaryButton label="Enable local preview (no charge)" onPress={enablePremiumPreview} /> : null}
        <SecondaryButton label="Restore purchases" onPress={() => undefined} />
      </Card>

      <Body muted>Subscriptions renew automatically unless canceled at least 24 hours before the current period ends. Purchase screens link to the Privacy Policy and Terms of Use.</Body>
    </Page>
  );
}
