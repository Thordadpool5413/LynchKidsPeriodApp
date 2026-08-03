import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import type { CareRequest, CareRequestItemCode } from '@shared/types';
import { apiClient } from '@/services/api-client';
import { readCloudSession, saveCloudSession, type CloudSession } from '@/services/cloud-session';
import { createId } from '@/utils/id';
import { Body, Card, ChoiceChip, Heading, Page, PremiumBadge, PrimaryButton, SecondaryButton } from '@/components/ui';
import { GardenGlyph } from '@/components/garden-glyph';
import { colors, fonts, radii } from '@/theme';

const PENDING_KEY = 'glitter.pending-care-request.v1';
const groups: { title: string; items: { code: CareRequestItemCode; label: string }[] }[] = [
  { title: 'Supplies', items: [['pads', 'Pads'], ['liners', 'Liners'], ['period-underwear', 'Period underwear'], ['spare-underwear', 'Spare underwear'], ['wipes', 'Skin-safe wipes'], ['heat-pack', 'Heat pack'], ['school-kit-refill', 'Refill my school kit']].map(([code, label]) => ({ code: code as CareRequestItemCode, label })) },
  { title: 'Food and drinks', items: [['water', 'Water'], ['warm-drink', 'A warm drink'], ['parent-approved-snack', 'A snack from our approved list']].map(([code, label]) => ({ code: code as CareRequestItemCode, label })) },
  { title: 'Comfort', items: [['quiet-time', 'Quiet time'], ['rest', 'Time to rest'], ['comfort-item', 'My comfort item']].map(([code, label]) => ({ code: code as CareRequestItemCode, label })) },
  { title: 'School help', items: [['bathroom-plan', 'Bathroom plan'], ['nurse-help', 'Help from the nurse'], ['teacher-note', 'A note for my teacher'], ['pickup', 'Please pick me up'], ['check-on-me', 'Please check on me']].map(([code, label]) => ({ code: code as CareRequestItemCode, label })) },
];

export default function CareRequestScreen() {
  const [session, setSession] = useState<CloudSession | null>(null);
  const [linkCode, setLinkCode] = useState('');
  const [items, setItems] = useState<CareRequestItemCode[]>([]);
  const [note, setNote] = useState('');
  const [history, setHistory] = useState<CareRequest[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingOpen, setEditingOpen] = useState(false);
  const openRequest = useMemo(() => history.find((item) => item.status === 'open' && !item.urgentSafety), [history]);

  const refresh = async (active: CloudSession) => {
    const result = await apiClient.careRequests(active.token);
    setHistory(result.requests);
  };

  useEffect(() => {
    void readCloudSession().then(async (active) => {
      if (active?.role !== 'child') return;
      setSession(active);
      await refresh(active).catch(() => undefined);
      const pending = localStorage.getItem(PENDING_KEY);
      if (pending) {
        try {
          await apiClient.createCareRequest(active.token, JSON.parse(pending));
          localStorage.removeItem(PENDING_KEY);
          setMessage('Your saved garden note was sent.');
          await refresh(active);
        } catch { /* remains queued */ }
      }
    });
  }, []);

  const connect = async () => {
    setBusy(true); setMessage('');
    try {
      const result = await apiClient.linkChild(linkCode);
      const active: CloudSession = { token: result.token, role: 'child', childProfileId: result.childProfileId, expiresAt: result.expiresAt };
      await saveCloudSession(active); setSession(active); setMessage('Your device is linked privately.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'That code did not work.'); }
    finally { setBusy(false); }
  };

  const send = async () => {
    if (!session || !items.length || (openRequest && !editingOpen)) return;
    setBusy(true); setMessage('');
    const payload = { clientRequestId: createId('care'), items, ...(note.trim() ? { note: note.trim() } : {}) };
    try {
      if (openRequest && editingOpen) await apiClient.updateCareRequest(session.token, openRequest.id, { action: 'edit', items, note: note.trim() || undefined });
      else await apiClient.createCareRequest(session.token, payload);
      localStorage.removeItem(PENDING_KEY); setItems([]); setNote(''); setMessage('Your garden note was sent.'); await refresh(session);
      setEditingOpen(false);
    } catch (error) {
      const text = error instanceof Error ? error.message : 'The note could not be sent.';
      if (/offline|network|fetch/i.test(text)) { localStorage.setItem(PENDING_KEY, JSON.stringify(payload)); setMessage('Saved on this device. AvaCado will try again when you return here online.'); }
      else setMessage(text);
    } finally { setBusy(false); }
  };

  const tellGrownUpNow = async () => {
    if (!session) return;
    setBusy(true); setMessage('');
    try {
      await apiClient.createCareRequest(session.token, { clientRequestId: createId('urgent'), items: ['check-on-me'], urgentSafety: true });
      setMessage('Your private check-on-me signal was sent. Please also speak to a nearby trusted grown-up now.');
      await refresh(session);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'The signal could not be sent. Please speak to a nearby grown-up now.'); }
    finally { setBusy(false); }
  };

  if (!session) return <Page>
    <Card tone="lavender"><PremiumBadge /><GardenGlyph name="care" size={42} /><Heading size={25}>Connect to your grown-up</Heading><Body>Ask your grown-up for the six-digit code from their private AvaCado space. Codes work once and expire after ten minutes.</Body></Card>
    <Card><TextInput accessibilityLabel="Six-digit link code" keyboardType="number-pad" maxLength={6} value={linkCode} onChangeText={(value) => setLinkCode(value.replace(/\D/g, ''))} placeholder="000000" placeholderTextColor={colors.inkMuted} style={{ minHeight: 54, borderWidth: 2, borderColor: colors.lavender, borderRadius: radii.small, paddingHorizontal: 16, color: colors.ink, fontFamily: fonts.displayBold, fontSize: 24, letterSpacing: 8, textAlign: 'center' }} /><PrimaryButton label={busy ? 'Connecting…' : 'Connect privately'} disabled={busy || linkCode.length !== 6} onPress={connect} />{message ? <Body>{message}</Body> : null}</Card>
    <Card tone="coral"><Heading size={20}>Need help right now?</Heading><Body>Urgent help is always free. Tell a trusted grown-up now if you feel faint, have severe pain, feel unsafe, or are bleeding through a pad every hour.</Body><PrimaryButton tone="coral" label="Tell my grown-up" onPress={() => Alert.alert('Please tell a grown-up now', 'Show them this screen or say: “I need help with something happening to my body.” If you are in immediate danger in the U.S., call 911.')} /></Card>
  </Page>;

  return <Page>
    <Card tone="lavender"><PremiumBadge /><GardenGlyph name="care" size={44} /><Heading size={26}>Send a garden note</Heading><Body>Choose what might help. Your notification stays private; your grown-up sees the details only after signing in.</Body></Card>
    {openRequest ? <Card tone="butter"><Heading size={21}>Your note is waiting</Heading><Body>{openRequest.responseCode ? `Your grown-up replied: ${openRequest.responseCode}.` : 'Sent. Your grown-up has not answered yet.'}</Body><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><SecondaryButton label={editingOpen ? 'Stop editing' : 'Edit this note'} onPress={() => { setEditingOpen((value) => !value); setItems(openRequest.items); setNote(openRequest.note ?? ''); }} /><SecondaryButton label="Cancel this note" onPress={() => void apiClient.updateCareRequest(session.token, openRequest.id, { action: 'cancel' }).then(() => refresh(session))} /></View></Card> : null}
    {(!openRequest || editingOpen) ? groups.map((group) => <Card key={group.title}><Heading size={20}>{group.title}</Heading><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>{group.items.map((item) => <ChoiceChip key={item.code} label={item.label} selected={items.includes(item.code)} onPress={() => setItems((current) => current.includes(item.code) ? current.filter((code) => code !== item.code) : [...current, item.code])} />)}</View></Card>) : null}
    {(!openRequest || editingOpen) ? <Card><Heading size={20}>Anything else? (optional)</Heading><TextInput accessibilityLabel="Short note to my grown-up" multiline maxLength={120} value={note} onChangeText={setNote} placeholder="One short private note…" placeholderTextColor={colors.inkMuted} style={{ minHeight: 96, textAlignVertical: 'top', borderWidth: 1.5, borderColor: colors.line, borderRadius: radii.small, padding: 14, color: colors.ink, fontFamily: fonts.body, fontSize: 16 }} /><Text selectable style={{ color: colors.inkMuted, fontFamily: fonts.utility, textAlign: 'right', fontVariant: ['tabular-nums'] }}>{note.length}/120</Text><PrimaryButton label={busy ? 'Saving…' : editingOpen ? 'Save note changes' : 'Send garden note'} disabled={busy || !items.length} onPress={send} /></Card> : null}
    {message ? <Body>{message}</Body> : null}
    <Card tone="coral"><Heading size={20}>Urgent help stays free</Heading><Body>For fainting, severe pain, feeling unsafe, or very heavy bleeding, tell a trusted grown-up now. AvaCado sends only when you tap this button; it never alerts anyone secretly.</Body><PrimaryButton tone="coral" label={busy ? 'Sending…' : 'Tell my grown-up now'} disabled={busy} onPress={() => Alert.alert('Send a private check-on-me signal?', 'The lock-screen message stays generic. Please also speak to a nearby trusted grown-up now.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Send', onPress: () => void tellGrownUpNow() }])} /></Card>
  </Page>;
}
