import React, { useEffect, useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { predictNextPeriod } from '@shared/cycle';
import { hasPlusAccess } from '@shared/entitlements';
import { useAppStore } from '@/store/app-store';
import { apiClient } from '@/services/api-client';
import { clearParentToken, getStoredParentToken, requestSignInLink, verifyAndStoreToken } from '@/services/session';
import { normalizeEntitlement } from '@shared/entitlements';
import { todayISO } from '@/utils/date';
import { Body, Card, Divider, Heading, Page, PremiumBadge, PrimaryButton, SecondaryButton, SharedBanner } from '@/components/ui';
import { colors, fonts, radii } from '@/theme';

export default function ParentScreen() {
  const { data, setEntitlement } = useAppStore();
  const router = useRouter();
  const [answer, setAnswer] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [checkoutBanner, setCheckoutBanner] = useState<'success' | 'cancelled' | null>(null);
  // null = polling not started, true = confirmed active/trialing, false = timed out
  const [checkoutConfirmed, setCheckoutConfirmed] = useState<boolean | null>(null);

  // Sign-in state
  const [parentToken, setParentToken] = useState<string | null>(null);
  const [signInEmail, setSignInEmail] = useState('');
  const [signInState, setSignInState] = useState<'idle' | 'sending' | 'sent' | 'verifying' | 'error'>('idle');
  const [signInError, setSignInError] = useState<string | null>(null);

  const prediction = useMemo(() => predictNextPeriod(data.cycleEvents, todayISO()), [data.cycleEvents]);
  const premium = hasPlusAccess(data.entitlement);
  const sharedEntries = data.journalEntries.filter((entry) => !entry.deletedAt && data.shareGrants.some((grant) => grant.resourceType === 'journal' && grant.resourceId === entry.id && !grant.revokedAt));
  const recentMoods = data.checkIns.filter((item) => !item.deletedAt).slice(-7);
  const cramps = recentMoods.filter((item) => item.symptoms.includes('cramps')).length;

  const params = useLocalSearchParams<{ checkout?: string; magic?: string }>();

  // Handle magic-link token on load (e.g. user clicked the email link).
  useEffect(() => {
    const magicToken = params.magic;
    if (!magicToken) {
      // No magic token — check if a session is already stored.
      setParentToken(getStoredParentToken());
      return;
    }
    setUnlocked(true); // Skip the grown-up gate for link clicks.
    setSignInState('verifying');
    (async () => {
      try {
        const token = await verifyAndStoreToken(magicToken);
        setParentToken(token);
        setSignInState('idle');
        // Remove the magic token from the URL so a page refresh doesn't replay it.
        router.replace('/parent');
      } catch (err) {
        setSignInError(err instanceof Error ? err.message : 'Sign-in link is invalid or has expired.');
        setSignInState('error');
        router.replace('/parent');
      }
    })();
  }, [params.magic]);

  // Refresh entitlement from the server on each visit once a parent session is available.
  useEffect(() => {
    if (!parentToken) return;
    (async () => {
      try {
        const result = await apiClient.entitlement(parentToken);
        setEntitlement(result.entitlement);
      } catch {
        // Non-fatal: store value stays as-is if the network call fails.
      }
    })();
  }, [parentToken]);

  // Detect Stripe redirect, then poll until the webhook has granted entitlement.
  // Stripe fires webhooks asynchronously — the first fetch after redirect often
  // still returns 'free'. We retry up to 6 times (≈12 s) before giving up.
  useEffect(() => {
    const status = params.checkout;
    if (!status) return;
    setCheckoutBanner(status === 'success' ? 'success' : 'cancelled');
    // Replace the URL immediately so navigating away and back doesn't re-trigger the banner.
    router.replace('/parent');
    if (status !== 'success') return;
    setUnlocked(true);
    setCheckoutConfirmed(null); // polling in progress
    (async () => {
      try {
        const token = getStoredParentToken();
        if (!token) { setCheckoutConfirmed(false); return; }
        const MAX_TRIES = 6;
        const DELAY_MS = 2000;
        for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
          if (attempt > 0) await new Promise<void>((resolve) => setTimeout(resolve, DELAY_MS));
          const result = await apiClient.entitlement(token);
          if (result.entitlement.status === 'active' || result.entitlement.status === 'trialing') {
            setEntitlement(result.entitlement);
            setCheckoutConfirmed(true);
            return;
          }
        }
        // Webhook hasn't landed within the polling window.
        setCheckoutConfirmed(false);
      } catch {
        setCheckoutConfirmed(false);
      }
    })();
  }, [params.checkout]);

  function handleSignOut() {
    clearParentToken();
    setParentToken(null);
    setSignInEmail('');
    setSignInState('idle');
    setSignInError(null);
    // Reset entitlement to free so the UI reflects the signed-out state immediately.
    setEntitlement(normalizeEntitlement({ status: 'free' }));
  }

  async function handleRequestLink() {
    if (!signInEmail.trim()) return;
    setSignInState('sending');
    setSignInError(null);
    try {
      await requestSignInLink(signInEmail.trim());
      setSignInState('sent');
    } catch (err) {
      setSignInError(err instanceof Error ? err.message : 'Could not send sign-in link. Try again.');
      setSignInState('error');
    }
  }

  if (!unlocked) return (
    <Page>
      {checkoutBanner === 'cancelled' ? (
        <Card tone="butter">
          <Body>Checkout was cancelled — no charge was made. You can try again from the Plus screen whenever you're ready.</Body>
        </Card>
      ) : null}
      <Card tone="butter">
        <Heading size={25}>Grown-ups only</Heading>
        <Body>This simple task prevents accidental entry by a child. Production accounts also require verified parent authentication and consent.</Body>
        <Text style={{ color: colors.ink, fontFamily: fonts.bodyBold }}>What is 7 + 5?</Text>
        <TextInput accessibilityLabel="Adult gate answer" keyboardType="number-pad" value={answer} onChangeText={setAnswer} style={{ minHeight: 50, borderWidth: 1.5, borderColor: colors.line, borderRadius: radii.small, paddingHorizontal: 14, color: colors.ink, fontFamily: fonts.body, fontSize: 18 }} />
        <PrimaryButton label="Enter grown-up space" disabled={answer !== '12'} onPress={() => setUnlocked(true)} />
      </Card>
    </Page>
  );

  // Show sign-in form when there is no valid parent session.
  if (!parentToken) return (
    <Page>
      {signInState === 'verifying' ? (
        <Card tone="lavender">
          <Body>Verifying your sign-in link…</Body>
        </Card>
      ) : signInState === 'sent' ? (
        <Card tone="lavender">
          <Text style={{ fontSize: 24 }}>📬</Text>
          <Heading size={20}>Check your email</Heading>
          <Body>A sign-in link has been sent to <Text style={{ fontFamily: fonts.bodyBold }}>{signInEmail}</Text>. Tap the link in the email to continue.</Body>
          <Body muted>The link expires in 15 minutes. Check your spam folder if it doesn't arrive.</Body>
          <SecondaryButton label="Use a different email" onPress={() => { setSignInState('idle'); setSignInEmail(''); }} />
        </Card>
      ) : (
        <Card tone="butter">
          <Heading size={25}>Sign in to your parent account</Heading>
          <Body>Enter your email address and we'll send you a secure sign-in link. No password required.</Body>
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
        </Card>
      )}
    </Page>
  );

  return (
    <Page>
      {checkoutBanner === 'success' ? (
        <Card tone="lavender">
          {checkoutConfirmed === true ? (
            <>
              <Text style={{ fontSize: 24 }}>🎉</Text>
              <Heading size={20}>Welcome to Glitter Plus!</Heading>
              <Body>Your subscription is active. All Plus features are now unlocked.</Body>
            </>
          ) : checkoutConfirmed === false ? (
            <>
              <Text style={{ fontSize: 24 }}>✓</Text>
              <Heading size={20}>Payment received</Heading>
              <Body>Your subscription is being set up — this usually takes just a moment. Reload this screen to check your status.</Body>
            </>
          ) : (
            <>
              <Text style={{ fontSize: 24 }}>⏳</Text>
              <Heading size={20}>Confirming your subscription…</Heading>
              <Body>Payment completed. Checking your subscription status — this takes just a few seconds.</Body>
            </>
          )}
        </Card>
      ) : null}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ gap: 5, flex: 1 }}>
          <Heading>Support dashboard</Heading>
          <Body muted>One linked child · prototype data on this device</Body>
        </View>
        <SecondaryButton label="Sign out" onPress={handleSignOut} />
      </View>
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
        <Body>"What would make period days at school feel easier? We can make a small plan together."</Body>
      </Card>
      <Body muted>Dashboard insights are supportive summaries, not medical diagnoses. Seek professional care for concerning symptoms.</Body>
    </Page>
  );
}
