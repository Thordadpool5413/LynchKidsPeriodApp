import React from 'react';
import { Text, View } from 'react-native';
import { hasPlusAccess } from '@shared/entitlements';
import { useAppStore } from '@/store/app-store';
import { Body, Card, Heading, Page, PremiumBadge } from '@/components/ui';
import { colors, fonts, radii } from '@/theme';

const catalog: Record<string, { title: string; body: string; sticker: string }> = {
  'first-checkin': { title: 'Feeling finder', body: 'Save your first mood check-in.', sticker: '🌼' },
  'first-bloom': { title: 'First bloom', body: 'Track a period start.', sticker: '🌺' },
  'three-lessons': { title: 'Curious mind', body: 'Finish three learning cards.', sticker: '🌈' },
  'school-ready': { title: 'School ready', body: 'Finish your school kit checklist.', sticker: '🎒' },
};

export default function AchievementsScreen() {
  const { data } = useAppStore();
  const premium = hasPlusAccess(data.entitlement);
  const earned = data.achievements.filter((item) => item.earnedAt).length;
  return (
    <Page>
      <Card tone="butter" style={{ alignItems: 'center' }}>
        <Text style={{ fontSize: 58 }}>🏵️</Text>
        <Heading size={27}>Your sticker garden</Heading>
        <Body center>{earned} of {data.achievements.length} everyday stickers collected. There are no streaks and nothing is lost when you take a break.</Body>
      </Card>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {data.achievements.map((achievement) => {
          const item = catalog[achievement.code];
          const complete = Boolean(achievement.earnedAt);
          return (
            <Card key={achievement.id} style={{ flexGrow: 1, flexBasis: 230, alignItems: 'center', opacity: complete ? 1 : 0.58 }}>
              <View style={{ width: 82, height: 82, borderRadius: radii.pill, backgroundColor: complete ? colors.coralSoft : colors.line, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 42 }}>{complete ? item.sticker : '❔'}</Text></View>
              <Heading size={19}>{item.title}</Heading>
              <Body muted center>{item.body}</Body>
              <Text selectable style={{ color: colors.lavender, fontFamily: fonts.bodyBold, fontVariant: ['tabular-nums'] }}>{achievement.progress}/{achievement.target}</Text>
            </Card>
          );
        })}
      </View>
      <Card tone="lavender">
        <PremiumBadge />
        <Heading size={20}>Big sticker collections</Heading>
        <Body>{premium ? 'Your Plus preview unlocks seasonal flower, rainbow, ocean, and starlight collections as monthly quests arrive.' : 'Plus members collect monthly themed sets and a big completion sticker.'}</Body>
      </Card>
    </Page>
  );
}
