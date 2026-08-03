import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { ISODate } from '@shared/types';
import { periodDaysForMonth, predictNextPeriod } from '@shared/cycle';
import { useAppStore } from '@/store/app-store';
import { todayISO, monthTitle } from '@/utils/date';
import { Body, Card, EmptyState, Heading, Page } from '@/components/ui';
import { colors, fonts, radii } from '@/theme';

export default function CalendarScreen() {
  const { data } = useAppStore();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<ISODate>(todayISO());
  const periodDays = useMemo(() => periodDaysForMonth(data.cycleEvents, year, month), [data.cycleEvents, year, month]);
  const prediction = useMemo(() => predictNextPeriod(data.cycleEvents, todayISO()), [data.cycleEvents]);
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)];

  const selectDay = (day: number) => {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` as ISODate;
    setSelectedDate(date);
    router.push({ pathname: '/calendar-day', params: { date } });
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
              <Pressable key={date} accessibilityRole="button" accessibilityLabel={`${monthTitle(year, month)} ${day}${isPeriod ? ', Glitter day' : ''}`} onPress={() => selectDay(day)} style={{ width: '14.285%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 38, height: 38, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? colors.lavender : isPeriod ? colors.coralSoft : 'transparent', borderWidth: isPeriod && !selected ? 2 : 0, borderColor: colors.coral }}>
                  <Text style={{ color: selected ? '#FFFFFF' : colors.ink, fontFamily: fonts.bodyBold, fontSize: 14, fontVariant: ['tabular-nums'] }}>{day}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Body muted>Select any date to edit it in a private sheet.</Body>
      {data.cycleEvents.filter((item) => !item.deletedAt).length === 0 ? <EmptyState title="Your Glitter calendar starts here" body="Mark a Glitter start when it happens. AvaCado will never guess before you do." /> : null}
    </Page>
  );
}
