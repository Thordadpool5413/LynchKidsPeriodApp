import React from 'react';
import { Alert, Pressable, Share, Switch, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { hasPlusAccess } from '@shared/entitlements';
import { useAppStore } from '@/store/app-store';
import { updateDailyReminder } from '@/services/reminders';
import { Body, Card, Divider, Heading, Page, PremiumBadge, SecondaryButton } from '@/components/ui';
import { colors, fonts } from '@/theme';

function SettingRow({ title, body, control }: { title: string; body: string; control: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text selectable style={{ color: colors.ink, fontFamily: fonts.bodyBold, fontSize: 16 }}>{title}</Text>
        <Body muted>{body}</Body>
      </View>
      {control}
    </View>
  );
}

export default function MoreScreen() {
  const { data, setCloudSync, setReducedMotion, setReminder, resetAllData, exportData } = useAppStore();
  const premium = hasPlusAccess(data.entitlement);
  return (
    <Page>
      <Link href="/plus" asChild>
        <Pressable><Card tone="lavender"><PremiumBadge /><Heading size={23}>{premium ? 'Your Plus garden is growing' : 'Meet Glitter Plus'}</Heading><Body>{premium ? 'Premium preview is active on this device.' : 'More guidance, activities, insights, themes, and grown-up support.'}</Body><Text style={{ color: colors.lavender, fontFamily: fonts.bodyBold }}>{premium ? 'View membership →' : 'See what is included →'}</Text></Card></Pressable>
      </Link>

      <Link href="/parent" asChild>
        <Pressable><Card tone="aqua"><Heading size={21}>Grown-up space</Heading><Body>Consent, linked tracking, support summaries, and subscription management live behind an adult gate.</Body><Text style={{ color: colors.success, fontFamily: fonts.bodyBold }}>Open grown-up space →</Text></Card></Pressable>
      </Link>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <Link href="/achievements" asChild>
          <Pressable style={{ flexGrow: 1, flexBasis: 240 }}><Card tone="butter"><Heading size={20}>Sticker garden 🏵️</Heading><Body muted>See the kind things you have practiced.</Body></Card></Pressable>
        </Link>
        <Link href="/school-kit" asChild>
          <Pressable style={{ flexGrow: 1, flexBasis: 240 }}><Card tone="aqua"><Heading size={20}>School kit 🎒</Heading><Body muted>Pack a tiny kit and practice what to say.</Body></Card></Pressable>
        </Link>
      </View>

      <Card>
        <Heading size={21}>Privacy and comfort</Heading>
        <SettingRow title="Little-kit reminder" body="Uses discreet words and never mentions a period on the lock screen." control={<Switch value={data.reminder.enabled} onValueChange={async (enabled) => {
          const next = { ...data.reminder, enabled };
          const result = await updateDailyReminder(next);
          if (result === 'denied') Alert.alert('Notifications are off', 'You can allow Glitter reminders in device Settings.');
          if (result === 'unsupported' && enabled) Alert.alert('Use your device app', 'Scheduled reminders are available in the iPhone and iPad app.');
          setReminder(result === 'denied' || result === 'unsupported' ? { ...next, enabled: false } : next);
        }} trackColor={{ true: colors.coral, false: colors.line }} />} />
        <Divider />
        <SettingRow title="Cloud sharing" body="Prototype toggle only. Production requires verified grown-up consent." control={<Switch value={data.profile.cloudSyncEnabled} onValueChange={setCloudSync} trackColor={{ true: colors.aqua, false: colors.line }} />} />
        <Divider />
        <SettingRow title="Reduce sparkle motion" body="Keep the colors while stopping floating animation." control={<Switch value={data.reducedMotion} onValueChange={setReducedMotion} trackColor={{ true: colors.lavender, false: colors.line }} />} />
      </Card>

      <Card>
        <Heading size={21}>Your data</Heading>
        <Body muted>Export and deletion stay free. Export creates a readable JSON copy; it does not send anything to Glitter.</Body>
        <SecondaryButton label="Export my data" onPress={() => void Share.share({ title: 'My Glitter data', message: exportData() })} />
        <SecondaryButton label="Delete everything on this device" destructive onPress={() => Alert.alert('Delete all Glitter data?', 'This cannot be undone. Cloud deletion is handled separately from the grown-up account.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete all', style: 'destructive', onPress: resetAllData }])} />
      </Card>

      <Link href="/privacy" asChild>
        <Pressable><Card><Heading size={19}>Plain-language privacy</Heading><Body muted>See what stays private, what can be shared, and how to ask for help.</Body></Card></Pressable>
      </Link>
      <Body muted>Glitter gives general education, not a diagnosis or emergency service.</Body>
    </Page>
  );
}
