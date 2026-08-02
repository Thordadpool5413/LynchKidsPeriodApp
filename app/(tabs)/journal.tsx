import React, { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { useAppStore } from '@/store/app-store';
import { friendlyDate } from '@/utils/date';
import { Body, Card, EmptyState, Heading, Page, PrimaryButton, SecondaryButton } from '@/components/ui';
import { colors, fonts, radii } from '@/theme';
import { GardenGlyph } from '@/components/garden-glyph';

const prompts = [
  'Something my body told me today…',
  'One thing I handled well…',
  'A question I want to ask a trusted grown-up…',
];

export default function JournalScreen() {
  const { data, saveJournal, deleteJournal, shareResource, revokeShare } = useAppStore();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [prompt, setPrompt] = useState<string | undefined>();
  const entries = data.journalEntries.filter((item) => !item.deletedAt).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const submit = () => {
    if (!body.trim()) return;
    saveJournal({ title: title.trim() || 'My thoughts', body: body.trim(), prompt });
    setTitle(''); setBody(''); setPrompt(undefined);
  };

  return (
    <Page>
      <Card tone="aqua">
        <GardenGlyph name="lock" color={colors.success} size={32} />
        <Heading size={22}>Your words belong to you</Heading>
        <Body>Your journal stays private unless you choose to share one entry with your linked grown-up.</Body>
      </Card>
      <Card>
        <Heading size={20}>Write something</Heading>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {prompts.map((item) => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: prompt === item }} onPress={() => { setPrompt(item); if (!body) setBody(item); }} style={({ pressed }) => ({ flexGrow: 1, flexBasis: 220, minHeight: 72, justifyContent: 'center', padding: 14, borderWidth: 1.5, borderColor: prompt === item ? colors.lavender : colors.line, borderRadius: radii.small, backgroundColor: prompt === item ? colors.lavenderSoft : pressed ? colors.butterSoft : colors.card })}><Text style={{ color: colors.ink, fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 20 }}>{item}</Text></Pressable>)}
        </View>
        <TextInput accessibilityLabel="Journal title" value={title} onChangeText={setTitle} placeholder="A title (optional)" placeholderTextColor={colors.inkMuted} style={{ minHeight: 48, borderWidth: 1.5, borderColor: colors.line, borderRadius: radii.small, paddingHorizontal: 14, color: colors.ink, fontFamily: fonts.body, fontSize: 16 }} />
        <TextInput accessibilityLabel="Journal entry" value={body} onChangeText={setBody} placeholder="Write as much as you want…" placeholderTextColor={colors.inkMuted} multiline style={{ minHeight: 150, textAlignVertical: 'top', borderWidth: 1.5, borderColor: colors.line, borderRadius: radii.small, padding: 14, color: colors.ink, fontFamily: fonts.body, fontSize: 16 }} />
        <PrimaryButton label="Save privately" disabled={!body.trim()} onPress={submit} />
      </Card>

      <Heading size={22}>Recent pages</Heading>
      {entries.length === 0 ? <EmptyState title="A quiet page is waiting" body="Write a thought, a question, or something you are proud of." /> : entries.map((entry) => {
        const grant = data.shareGrants.find((item) => item.resourceType === 'journal' && item.resourceId === entry.id && !item.revokedAt);
        return (
          <Card key={entry.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Heading size={19}>{entry.title}</Heading>
                <Text selectable style={{ color: colors.inkMuted, fontFamily: fonts.utility, fontSize: 12 }}>{friendlyDate(entry.updatedAt)}</Text>
              </View>
              <GardenGlyph name={grant ? 'flower' : 'lock'} color={grant ? colors.success : colors.lavender} size={24} />
            </View>
            <Body>{entry.body}</Body>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {grant
                ? <SecondaryButton label="Stop sharing" onPress={() => revokeShare('journal', entry.id)} />
                : <SecondaryButton label="Share with my grown-up" onPress={() => Alert.alert('Share this page?', 'Your linked grown-up will be able to read this journal entry until you stop sharing it.', [{ text: 'Keep private', style: 'cancel' }, { text: 'Share', onPress: () => shareResource('journal', entry.id) }])} />}
              <SecondaryButton label="Delete" destructive onPress={() => Alert.alert('Delete this page?', 'This removes it from this device.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => deleteJournal(entry.id) }])} />
            </View>
          </Card>
        );
      })}
    </Page>
  );
}
