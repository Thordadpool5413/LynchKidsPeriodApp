import React, { useEffect, useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import type { CareRequest, CareRequestResponseCode } from '@shared/types';
import { apiClient } from '@/services/api-client';
import { clearCloudSession, readCloudSession, saveCloudSession, type CloudSession } from '@/services/cloud-session';
import { Body, Card, Divider, Heading, Page, PrimaryButton, SecondaryButton } from '@/components/ui';
import { GardenGlyph } from '@/components/garden-glyph';
import { enableParentAlerts } from '@/services/parent-alerts';
import { colors, fonts, radii } from '@/theme';

const responseLabels: Record<CareRequestResponseCode, string> = { 'got-it': 'Got it', 'help-soon': 'I can help soon', 'lets-talk': "Let's talk", 'not-right-now': "I can't get that right now" };

export default function ParentScreen() {
  const params = useLocalSearchParams<{ magicToken?: string; checkout?: string }>();
  const [email, setEmail] = useState('');
  const [session, setSession] = useState<CloudSession | null>(null);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState('');
  const [dashboard, setDashboard] = useState<{ linked: boolean; forecast: { estimatedDate: string; confidence: string } | null; careRequests: CareRequest[] } | null>(null);
  const [linkCode, setLinkCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [alertsEnabled, setAlertsEnabled] = useState(false);

  const refresh = async (active: CloudSession) => setDashboard(await apiClient.parentDashboard(active.token));

  useEffect(() => {
    void (async () => {
      const existing = await readCloudSession();
      if (existing?.role === 'parent') {
        setSession(existing);
        await refresh(existing).catch((error) => setMessage(error instanceof Error ? error.message : 'Dashboard unavailable.'));
        await apiClient.reminderPreference(existing.token).then((result) => setAlertsEnabled(result.preference.enabled)).catch(() => undefined);
        if (params.checkout === 'success') setMessage('Payment received. Glitter is confirming the subscription now.');
        return;
      }
      if (params.magicToken) {
        try {
          const verified = await apiClient.verifyParentLink(params.magicToken);
          const active: CloudSession = { token: verified.token, role: 'parent', expiresAt: verified.expiresAt };
          await saveCloudSession(active); setSession(active); await refresh(active);
        } catch (error) { setMessage(error instanceof Error ? error.message : 'This sign-in link did not work.'); }
      }
    })();
  }, [params.magicToken, params.checkout]);

  const requestLink = async () => {
    setMessage('');
    try { await apiClient.requestParentLink(email); setSent(true); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'The sign-in link could not be requested.'); }
  };

  const createCode = async () => {
    if (!session) return;
    try { setLinkCode(await apiClient.createLinkCode(session.token)); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'A link code could not be created.'); }
  };

  const reply = async (request: CareRequest, responseCode: CareRequestResponseCode) => {
    if (!session) return;
    await apiClient.updateCareRequest(session.token, request.id, { action: 'acknowledge', responseCode });
    await refresh(session);
  };

  if (!session) return <Page maxWidth={720}>
    <Card tone="butter"><GardenGlyph name="lock" size={46} /><Heading size={27}>Grown-up sign in</Heading><Body>Glitter sends a private, one-time link to your email. No child name, health detail, or request appears in the email.</Body></Card>
    <Card><Text style={{ color: colors.ink, fontFamily: fonts.bodyBold }}>Parent email</Text><TextInput accessibilityLabel="Parent email" autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={colors.inkMuted} style={{ minHeight: 52, borderWidth: 1.5, borderColor: colors.line, borderRadius: radii.small, paddingHorizontal: 14, color: colors.ink, fontFamily: fonts.body, fontSize: 16 }} /><PrimaryButton label={sent ? 'Check your email' : 'Email my private link'} disabled={sent || !email.includes('@')} onPress={requestLink} />{sent ? <Body>The link expires in 15 minutes. You can close this screen and open the email on this device.</Body> : null}{message ? <Body>{message}</Body> : null}</Card>
    <Body muted>Verified parental consent is a separate step after sign-in. Email authentication alone does not enable child cloud data or alerts.</Body>
  </Page>;

  return <Page maxWidth={1180}>
    <View style={{ gap: 5 }}><Heading>Support dashboard</Heading><Body muted>Authenticated parent space · private details never appear in push previews</Body></View>
    {message ? <Card tone="coral"><Body>{message}</Body></Card> : null}
    {!dashboard?.linked ? <Card tone="lavender"><Heading size={22}>Finish verified consent</Heading><Body>A legally approved consent provider must verify the parent before a cloud child profile or device link can be created. Production remains safely paused until that provider is enabled.</Body><PrimaryButton label="Start verified consent" onPress={() => Alert.alert('Consent provider required', 'Connect and legally approve the verifiable-parental-consent provider before production activation.')} /></Card> : <>
      <Card tone="aqua"><Heading size={22}>Link the child device</Heading><Body>Create a six-digit code only when the child has their device ready. It expires in ten minutes and works once.</Body>{linkCode ? <Text selectable style={{ color: colors.ink, fontFamily: fonts.displayBold, fontSize: 36, letterSpacing: 8, textAlign: 'center', fontVariant: ['tabular-nums'] }}>{linkCode.code}</Text> : <PrimaryButton label="Create one-time code" onPress={createCode} />}</Card>
      <Card tone="lavender"><Heading size={22}>Discreet parent alerts</Heading><Body>Forecast alerts arrive about five days and one day before an estimate. Lock-screen text only says, “A garden moment may be getting closer.”</Body><PrimaryButton label={alertsEnabled ? 'Private alerts enabled' : 'Enable private alerts'} disabled={alertsEnabled} onPress={() => session && void enableParentAlerts(session.token).then(() => setAlertsEnabled(true)).catch((error) => setMessage(error instanceof Error ? error.message : 'Alerts could not be enabled.'))} /></Card>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
        <Card style={{ flexGrow: 1, flexBasis: 300 }}><GardenGlyph name="flower" size={34} /><Heading size={20}>Cycle outlook</Heading><Body>{dashboard?.forecast ? `The next garden moment may be around ${dashboard.forecast.estimatedDate}. Confidence: ${dashboard.forecast.confidence}.` : 'Glitter needs more tracked starts before showing an estimate.'}</Body></Card>
        <Card style={{ flexGrow: 1, flexBasis: 300 }}><GardenGlyph name="care" size={34} /><Heading size={20}>Garden notes</Heading><Text selectable style={{ color: colors.lavender, fontFamily: fonts.displayBold, fontSize: 36, fontVariant: ['tabular-nums'] }}>{dashboard?.careRequests.filter((item) => item.status === 'open').length ?? 0}</Text><Body muted>waiting for a response</Body></Card>
      </View>
      <Heading size={23}>Recent garden notes</Heading>
      {dashboard?.careRequests.length ? dashboard.careRequests.map((item) => <Card key={item.id} tone={item.urgentSafety ? 'coral' : item.status === 'open' ? 'butter' : 'white'}><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}><Heading size={19}>{item.urgentSafety ? 'Check on them now' : item.status === 'open' ? 'Needs a response' : 'Answered'}</Heading><Body muted>{new Date(item.createdAt).toLocaleString()}</Body></View><Body>{item.urgentSafety ? 'The child tapped the free urgent check-on-me action. Contact them now and follow the fixed safety guidance in Glitter.' : item.items.join(' · ')}</Body>{item.note ? <><Divider /><Body>“{item.note}”</Body></> : null}{item.status === 'open' ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{(Object.keys(responseLabels) as CareRequestResponseCode[]).map((code) => <SecondaryButton key={code} label={responseLabels[code]} onPress={() => void reply(item, code)} />)}</View> : null}</Card>) : <Card><Body>No garden notes yet.</Body></Card>}
    </>}
    <Card><Heading size={20}>Account and privacy</Heading><Body>Exports exclude journal entries unless the child individually shared them. Unlinking revokes consent, child sessions, and notification devices.</Body><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><SecondaryButton label="Export approved data" onPress={() => session && void apiClient.exportAccount(session.token).then((data) => Alert.alert('Export prepared', JSON.stringify(data).slice(0, 500)))} /><SecondaryButton label="Sign out" onPress={() => void clearCloudSession().then(() => setSession(null))} /></View></Card>
    <Body muted>Glitter provides supportive information, not diagnosis, telehealth, or emergency monitoring.</Body>
  </Page>;
}
