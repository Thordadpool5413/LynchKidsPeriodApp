import React, { useMemo, useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import { ASK_BLOOM_TILES, findCuratedAnswer } from '@shared/content';
import { hasPlusAccess } from '@shared/entitlements';
import { classifySafety, SAFETY_RESPONSES, type SafetyLevel } from '@shared/safety';
import { useAppStore } from '@/store/app-store';
import { Body, Card, ChoiceChip, Heading, Page, PremiumBadge, PrimaryButton, SecondaryButton } from '@/components/ui';
import { colors, fonts, radii } from '@/theme';

export default function AskBloomScreen() {
  const { data, shareResource } = useAppStore();
  const premium = hasPlusAccess(data.entitlement);
  const [question, setQuestion] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [shareId, setShareId] = useState<string | null>(null);
  const safety = useMemo<SafetyLevel>(() => classifySafety(submitted), [submitted]);
  const answers = useMemo(() => submitted && safety === 'standard' ? findCuratedAnswer(submitted) : [], [submitted, safety]);

  const ask = () => {
    if (!question.trim() || !premium) return;
    setSubmitted(question.trim().slice(0, 240));
    setQuestion('');
    setShareId(null);
  };

  return (
    <Page>
      <Card tone="lavender">
        <PremiumBadge />
        <Heading size={24}>A safe place to start a question</Heading>
        <Body>Ask Glitter uses reviewed article search in this build. It is not a person, doctor, or emergency service, and your exact question is not saved.</Body>
      </Card>

      <Card>
        <Text style={{ color: colors.ink, fontFamily: fonts.bodyBold }}>Try a question</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {ASK_BLOOM_TILES.map((tile) => <ChoiceChip key={tile} label={tile} selected={question === tile} onPress={() => setQuestion(tile)} />)}
        </View>
        <TextInput
          accessibilityLabel="Question for Ask Glitter"
          editable={premium}
          value={question}
          onChangeText={setQuestion}
          maxLength={240}
          placeholder={premium ? 'Type a short question…' : 'Start the Plus preview to ask a question'}
          placeholderTextColor={colors.inkMuted}
          multiline
          style={{ minHeight: 100, textAlignVertical: 'top', borderWidth: 1.5, borderColor: colors.line, borderRadius: radii.small, padding: 14, color: colors.ink, fontFamily: fonts.body, fontSize: 16, backgroundColor: premium ? '#FFFFFF' : colors.lavenderSoft }}
        />
        <PrimaryButton label={premium ? 'Find a safe answer' : 'Glitter Plus required'} disabled={!premium || !question.trim()} onPress={ask} />
      </Card>

      {submitted ? (
        <Card tone={safety === 'urgent' ? 'coral' : safety === 'trusted-adult' ? 'butter' : 'aqua'}>
          <Heading size={20}>{safety === 'urgent' ? 'Please get help now' : safety === 'trusted-adult' ? 'A grown-up should help with this' : 'Here is a helpful place to start'}</Heading>
          {safety !== 'standard' ? (
            <>
              <Body>{SAFETY_RESPONSES[safety]}</Body>
              <PrimaryButton label="Tell my grown-up" tone="coral" onPress={() => Alert.alert('Ready to tell a grown-up', 'Bring your device to a trusted grown-up or use your usual safe way to contact them now. Automatic alerts are not sent.')} />
            </>
          ) : answers.length ? answers.map((answer) => (
            <View key={answer.id} style={{ gap: 6 }}>
              <Heading size={18}>{answer.title}</Heading>
              <Body>{answer.body}</Body>
            </View>
          )) : <Body>We did not find a close match. Try one of the question buttons, or ask a trusted grown-up.</Body>}
          <Body muted>Only share this answer if you want to. Your original question stays private.</Body>
          <SecondaryButton label={shareId ? 'Shared with my grown-up ✓' : 'Share this answer'} onPress={() => {
            const id = shareId ?? `ai_${Date.now()}`;
            shareResource('ai-answer', id);
            setShareId(id);
          }} />
        </Card>
      ) : null}

      <Card tone="butter">
        <Heading size={18}>What changes before generative AI turns on?</Heading>
        <Body muted>Zero Data Retention approval, clinician and legal review, safety evaluations, and production feature flags are mandatory. Until then, Ask Glitter searches only the local reviewed library.</Body>
      </Card>
    </Page>
  );
}
