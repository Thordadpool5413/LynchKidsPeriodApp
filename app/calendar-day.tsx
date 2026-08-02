import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { CycleEventKind, Flow, ISODate, Symptom } from '@shared/types';
import { useAppStore } from '@/store/app-store';
import { Body, Card, ChoiceChip, Heading, Page, PrimaryButton, SecondaryButton } from '@/components/ui';
import { colors, fonts, radii } from '@/theme';

const flows: { value: Flow; label: string }[] = [{ value: 'spotting', label: 'Spotting' }, { value: 'light', label: 'Light' }, { value: 'medium', label: 'Medium' }, { value: 'heavy', label: 'Heavy' }];
const symptoms: { value: Symptom; label: string }[] = [{ value: 'cramps', label: 'Cramps' }, { value: 'headache', label: 'Headache' }, { value: 'bloating', label: 'Bloated' }, { value: 'backache', label: 'Backache' }];

export default function CalendarDayScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const date = (params.date ?? new Date().toISOString().slice(0, 10)) as ISODate;
  const { data, saveCycleDay, deleteCycleDay } = useAppStore();
  const existing = data.cycleEvents.find((item) => item.date === date && !item.deletedAt);
  const [kind, setKind] = useState<CycleEventKind>(existing?.kind ?? 'period-day');
  const [flow, setFlow] = useState<Flow>(existing?.flow ?? 'medium');
  const [selectedSymptoms, setSelectedSymptoms] = useState<Symptom[]>(existing?.symptoms ?? []);
  const [note, setNote] = useState(existing?.note ?? '');
  return <Page maxWidth={680}>
    <Card tone="lavender"><Heading size={24}>Edit {date}</Heading><Body>Only add what you want to remember. Estimates are never promises.</Body></Card>
    <Card><Text style={{ color: colors.ink, fontFamily: fonts.bodyBold }}>What happened?</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><ChoiceChip label="Period started" selected={kind === 'period-start'} onPress={() => setKind('period-start')} /><ChoiceChip label="Period day" selected={kind === 'period-day'} onPress={() => setKind('period-day')} /><ChoiceChip label="Period ended" selected={kind === 'period-end'} onPress={() => setKind('period-end')} /><ChoiceChip label="Not on period" selected={kind === 'not-on-period'} onPress={() => setKind('not-on-period')} /></View>
      {kind !== 'not-on-period' ? <><Text style={{ color: colors.ink, fontFamily: fonts.bodyBold }}>Flow</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{flows.map((item) => <ChoiceChip key={item.value} label={item.label} selected={flow === item.value} onPress={() => setFlow(item.value)} />)}</View><Text style={{ color: colors.ink, fontFamily: fonts.bodyBold }}>Symptoms</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{symptoms.map((item) => <ChoiceChip key={item.value} label={item.label} selected={selectedSymptoms.includes(item.value)} onPress={() => setSelectedSymptoms((current) => current.includes(item.value) ? current.filter((value) => value !== item.value) : [...current, item.value])} />)}</View></> : null}
      <TextInput accessibilityLabel="Private note for this day" value={note} onChangeText={setNote} placeholder="Private note (optional)" placeholderTextColor={colors.inkMuted} multiline style={{ minHeight: 88, textAlignVertical: 'top', borderWidth: 1.5, borderColor: colors.line, borderRadius: radii.small, padding: 13, color: colors.ink, fontFamily: fonts.body, fontSize: 15 }} />
      <PrimaryButton label="Save this day" onPress={() => { saveCycleDay(date, kind, kind === 'not-on-period' ? undefined : flow, selectedSymptoms, note.trim() || undefined); router.back(); }} />
      {existing ? <SecondaryButton label="Remove this entry" destructive onPress={() => { deleteCycleDay(date); router.back(); }} /> : null}
    </Card>
  </Page>;
}
