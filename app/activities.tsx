import React, { useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useAppStore } from '@/store/app-store';
import { Body, Card, ChoiceChip, Heading, Page, PremiumBadge, PrimaryButton } from '@/components/ui';
import { GardenGlyph } from '@/components/garden-glyph';
import { colors, fonts, radii } from '@/theme';

type Activity = 'garden' | 'comfort' | 'quest';
const comfortPairs = [
  { feeling: 'Cramps', action: 'Try gentle warmth and tell a grown-up if pain is strong or worrying.' },
  { feeling: 'Tired', action: 'Plan a quiet break, water, and an earlier bedtime with your grown-up.' },
  { feeling: 'School worry', action: 'Choose a trusted adult and practice one sentence asking for help.' },
  { feeling: 'Big emotions', action: 'Take five soft breaths and name what you need without judging the feeling.' },
];

export default function ActivitiesScreen() {
  const { data } = useAppStore();
  const [activity, setActivity] = useState<Activity>('garden');
  const [selectedFeeling, setSelectedFeeling] = useState('');
  const [answer, setAnswer] = useState('');
  const earned = useMemo(() => data.achievements.filter((item) => item.earnedAt), [data.achievements]);
  return <Page>
    <Card tone="lavender"><PremiumBadge /><Heading size={27}>Play in your private garden</Heading><Body>Short, calm activities unlock through learning and preparation—not streaks, competition, or spending pressure.</Body></Card>
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><ChoiceChip label="Garden Builder" selected={activity === 'garden'} onPress={() => setActivity('garden')} /><ChoiceChip label="Comfort Match" selected={activity === 'comfort'} onPress={() => setActivity('comfort')} /><ChoiceChip label="Learning Quest" selected={activity === 'quest'} onPress={() => setActivity('quest')} /></View>
    {activity === 'garden' ? <Card tone="aqua"><Heading size={22}>Garden Builder</Heading><Body>Your everyday achievements grow this garden. Nothing disappears when you take a break.</Body><View accessibilityLabel={`${earned.length} garden decorations unlocked`} style={{ minHeight: 190, borderRadius: radii.medium, backgroundColor: colors.butterSoft, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-around', padding: 22, gap: 16 }}>{data.achievements.map((item, index) => <View key={item.id} style={{ alignItems: 'center', gap: 6, opacity: item.earnedAt ? 1 : 0.28 }}><GardenGlyph name="flower" color={[colors.lavender, colors.coral, colors.success, colors.orchid][index % 4]} size={44 + index * 3} /><Text style={{ color: colors.ink, fontFamily: fonts.utility, fontSize: 12 }}>{item.earnedAt ? 'Grown' : 'Still growing'}</Text></View>)}</View></Card> : null}
    {activity === 'comfort' ? <Card><Heading size={22}>Comfort Match</Heading><Body>Pick a feeling, then reveal one reviewed comfort idea. These are support ideas, not treatments.</Body><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{comfortPairs.map((item) => <ChoiceChip key={item.feeling} label={item.feeling} selected={selectedFeeling === item.feeling} onPress={() => setSelectedFeeling(item.feeling)} />)}</View>{selectedFeeling ? <Card tone="butter"><Body>{comfortPairs.find((item) => item.feeling === selectedFeeling)?.action}</Body></Card> : null}</Card> : null}
    {activity === 'quest' ? <Card><Heading size={22}>Learning Quest</Heading><Body>Which choice needs a trusted grown-up right away?</Body><View style={{ gap: 8 }}>{['A period arrives a few days earlier than expected', 'Feeling faint with very heavy bleeding', 'Wanting to try a different pad'].map((choice) => <Pressable key={choice} accessibilityRole="button" accessibilityState={{ selected: answer === choice }} onPress={() => setAnswer(choice)} style={{ minHeight: 58, justifyContent: 'center', padding: 14, borderRadius: radii.small, borderWidth: 1.5, borderColor: answer === choice ? colors.lavender : colors.line, backgroundColor: answer === choice ? colors.lavenderSoft : colors.card }}><Text style={{ color: colors.ink, fontFamily: fonts.bodyBold, lineHeight: 21 }}>{choice}</Text></Pressable>)}</View><PrimaryButton label="Check my answer" disabled={!answer} onPress={() => Alert.alert(answer === 'Feeling faint with very heavy bleeding' ? 'You got it' : 'Try this safety clue', answer === 'Feeling faint with very heavy bleeding' ? 'Feeling faint or bleeding through a pad every hour needs a trusted grown-up and medical help now.' : 'Normal timing and product choices can vary. Feeling faint with very heavy bleeding is the urgent choice.')} /></Card> : null}
    <Body muted>Activity content requires final pediatric/adolescent-health clinician approval before public release.</Body>
  </Page>;
}
