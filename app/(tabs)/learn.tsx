import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { EDUCATION_CONTENT } from '@shared/content';
import { hasPlusAccess } from '@shared/entitlements';
import { useAppStore } from '@/store/app-store';
import { Body, Card, ChoiceChip, Heading, Page, PremiumBadge, PrimaryButton } from '@/components/ui';
import { colors, fonts, radii } from '@/theme';

const categories = ['all', 'basics', 'body', 'school', 'feelings', 'safety', 'self-care'] as const;

export default function LearnScreen() {
  const { data, completeLesson } = useAppStore();
  const [category, setCategory] = useState<(typeof categories)[number]>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const premium = hasPlusAccess(data.entitlement);
  const items = useMemo(
    () => EDUCATION_CONTENT.filter(
      (item) => item.reviewerStatus === 'clinician-reviewed' && (category === 'all' || item.category === category)
    ),
    [category]
  );

  return (
    <Page>
      <Card tone="butter">
        <Heading size={24}>No weird words. No scary guesses.</Heading>
        <Body>Short, honest answers written for growing bodies. Content is published once it has passed clinician review.</Body>
      </Card>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {categories.map((item) => <ChoiceChip key={item} label={item === 'all' ? 'Everything' : item[0].toUpperCase() + item.slice(1)} selected={category === item} onPress={() => setCategory(item)} />)}
      </View>
      {items.length === 0 && (
        <Card tone="butter">
          <Body muted>No articles are available in this category yet. Check back soon—our team is finishing clinician review.</Body>
        </Card>
      )}
      {items.map((item) => {
        const locked = item.premium && !premium;
        const completed = data.educationProgress.some((progress) => progress.contentId === item.id && progress.completedAt);
        const open = openId === item.id;
        return (
          <Pressable key={item.id} accessibilityRole="button" onPress={() => !locked && setOpenId(open ? null : item.id)} style={{ opacity: locked ? 0.7 : 1 }}>
            <Card tone={item.category === 'safety' ? 'coral' : 'white'}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <View style={{ flex: 1, gap: 5 }}>
                  {item.premium ? <PremiumBadge /> : null}
                  <Heading size={20}>{item.title}</Heading>
                  <Body muted>{item.summary}</Body>
                </View>
                <Text style={{ fontSize: 24 }}>{completed ? '🌟' : locked ? '🔒' : open ? '−' : '+'}</Text>
              </View>
              {open && !locked ? (
                <View style={{ gap: 12, paddingTop: 7 }}>
                  <Body>{item.body}</Body>
                  <PrimaryButton label={completed ? 'Lesson complete ✓' : 'I finished this'} tone="coral" onPress={() => completeLesson(item.id)} />
                </View>
              ) : null}
              {locked ? <Text selectable style={{ color: colors.lavender, fontFamily: fonts.bodyBold }}>Available with Glitter Plus</Text> : null}
            </Card>
          </Pressable>
        );
      })}
    </Page>
  );
}
