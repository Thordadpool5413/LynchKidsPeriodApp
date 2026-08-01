import React, { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { CycleEventKind, Flow, ISODate, Symptom } from '@shared/types';
import { periodDaysForMonth, predictNextPeriod } from '@shared/cycle';
import { useAppStore } from '@/store/app-store';
import { todayISO, monthTitle } from '@/utils/date';
import { Body, Card, ChoiceChip, Divider, EmptyState, Heading, Page, PrimaryButton, SecondaryButton } from '@/components/ui';
import { colors, fonts, radii } from '@/theme';

const flows: { value: Flow; label: string }[] = [
  { value: 'spotting', label: 'Spotting' }, { value: 'light', label: 'Light' }, { value: 'medium', label: 'Medium' }, { value: 'heavy', label: 'Heavy' },
];
const symptoms: { value: Symptom; label: string; emoji: string }[] = [
  { value: 'cramps', label: 'Cramps', emoji: '🫶' }, { value: 'headache', label: 'Headache', emoji: '🌧️' },
  { value: 'bloating', label: 'Bloated', emoji: '🎈' }, { value: 'backache', label: 'Backache', emoji: '🌿' },
];

export default function CalendarScreen() {
  const { data, saveCycleDay, deleteCycleDay } = useAppStore();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<ISODate>(todayISO());
  const existing = data.cycleEvents.find((item) => item.date === selectedDate && !item.deletedAt);
  const [kind, setKind] = useState<CycleEventKind>(existing?.kind ?? 'period-day');
  const [flow, setFlow] = useState<Flow>(existing?.flow ?? 'medium');
  const [selectedSymptoms, setSelectedSymptoms] = useState<Symptom[]>(existing?.symptoms ?? []);
  const [note, setNote] = useState(existing?.note ?? '');
  const periodDays = useMemo(() => periodDaysForMonth(data.cycleEvents, year, month), [data.cycleEvents, year, month]);
  const prediction = useMemo(() => predictNextPeriod(data.cycleEvents, todayISO()), [data.cycleEvents]);
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)];

  const selectDay = (day: number) => {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` as ISODate;
    const found = data.cycleEvents.find((item) => item.date === date && !item.deletedAt);
    setSelectedDate(date);
    setKind(found?.kind ?? 'period-day');
    setFlow(found?.flow ?? 'medium');
    setSelectedSymptoms(found?.symptoms ?? []);
    setNote(found?.note ?? '');
  };

  const moveMonth = (direction: -1 | 1) => {
    const next = new Date(year, month - 1 + direction, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth() + 1);
  };

  return (
    <Page>
      <Card tone="lavender">
        <Heading size={20}>{prediction.message}</Heading>
        <Body muted>{prediction.confidence === 'pattern-based' ? `Recent average: about ${prediction.averageCycleLength} days.` : 'Track more starts to make the estimate more personal.'}</Body>
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => moveMonth(-1)} style={{ padding: 10 }}><Text style={{ color: colors.ink, fontSize: 24 }}>‹</Text></Pressable>
          <Heading size={22}>{monthTitle(year, month)}</Heading>
          <Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => moveMonth(1)} style={{ padding: 10 }}><Text style={{ color: colors.ink, fontSize: 24 }}>›</Text></Pressable>
        </View>
        <View style={{ flexDirection: 'row' }}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <Text key={`${day}-${index}`} style={{ width: '14.285%', textAlign: 'center', color: colors.inkMuted, fontFamily: fonts.utility, fontSize: 12 }}>{day}</Text>)}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {cells.map((day, index) => {
            if (!day) return <View key={`blank-${index}`} style={{ width: '14.285%', aspectRatio: 1 }} />;
            const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const selected = date === selectedDate;
            const isPeriod = periodDays.has(day);
            return (
              <Pressable key={date} accessibilityRole="button" accessibilityLabel={`${monthTitle(year, month)} ${day}${isPeriod ? ', period day' : ''}`} onPress={() => selectDay(day)} style={{ width: '14.285%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 38, height: 38, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? colors.lavender : isPeriod ? colors.coralSoft : 'transparent', borderWidth: isPeriod && !selected ? 2 : 0, borderColor: colors.coral }}>
                  <Text style={{ color: selected ? '#FFFFFF' : colors.ink, fontFamily: fonts.bodyBold, fontSize: 14, fontVariant: ['tabular-nums'] }}>{day}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        <View style={{ gap: 4 }}>
          <Heading size={21}>Edit {selectedDate}</Heading>
          <Body muted>Only add what you want to remember.</Body>
        </View>
        <Divider />
        <Text style={{ color: colors.ink, fontFamily: fonts.bodyBold }}>What happened?</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <ChoiceChip label="Period started" selected={kind === 'period-start'} onPress={() => setKind('period-start')} />
          <ChoiceChip label="Period day" selected={kind === 'period-day'} onPress={() => setKind('period-day')} />
          <ChoiceChip label="Period ended" selected={kind === 'period-end'} onPress={() => setKind('period-end')} />
          <ChoiceChip label="Not on period" selected={kind === 'not-on-period'} onPress={() => setKind('not-on-period')} />
        </View>
        {kind !== 'not-on-period' ? (
          <>
            <Text style={{ color: colors.ink, fontFamily: fonts.bodyBold }}>Flow</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {flows.map((item) => <ChoiceChip key={item.value} label={item.label} selected={flow === item.value} onPress={() => setFlow(item.value)} />)}
            </View>
            <Text style={{ color: colors.ink, fontFamily: fonts.bodyBold }}>Symptoms</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {symptoms.map((item) => <ChoiceChip key={item.value} label={item.label} emoji={item.emoji} selected={selectedSymptoms.includes(item.value)} onPress={() => setSelectedSymptoms((current) => current.includes(item.value) ? current.filter((value) => value !== item.value) : [...current, item.value])} />)}
            </View>
          </>
        ) : null}
        <TextInput value={note} onChangeText={setNote} placeholder="Private note (optional)" placeholderTextColor={colors.inkMuted} multiline style={{ minHeight: 88, textAlignVertical: 'top', borderWidth: 1.5, borderColor: colors.line, borderRadius: radii.small, padding: 13, color: colors.ink, fontFamily: fonts.body, fontSize: 15 }} />
        <PrimaryButton label="Save this day" onPress={() => saveCycleDay(selectedDate, kind, kind === 'not-on-period' ? undefined : flow, selectedSymptoms, note.trim() || undefined)} />
        {existing ? <SecondaryButton label="Remove this entry" destructive onPress={() => deleteCycleDay(selectedDate)} /> : null}
      </Card>

      {data.cycleEvents.filter((item) => !item.deletedAt).length === 0 ? <EmptyState emoji="🌱" title="Your calendar starts here" body="Mark a period start when it happens. Glitter will never guess before you do." /> : null}
    </Page>
  );
}
