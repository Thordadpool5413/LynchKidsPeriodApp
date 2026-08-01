import * as Notifications from 'expo-notifications';
import type { ReminderPreference } from '@shared/types';

const REMINDER_ID_KEY = 'glitter.reminder-id';

function reminderBody(preference: ReminderPreference): string {
  if (preference.phrase === 'custom' && preference.customPhrase?.trim()) return preference.customPhrase.trim().slice(0, 80);
  return preference.phrase === 'bloom' ? 'Your bloom may be getting closer 🌸' : 'Remember your little kit 🎒';
}

export async function updateDailyReminder(preference: ReminderPreference): Promise<'scheduled' | 'disabled' | 'unsupported' | 'denied'> {
  if (process.env.EXPO_OS === 'web') return 'unsupported';
  const existing = localStorage.getItem(REMINDER_ID_KEY);
  if (existing) {
    await Notifications.cancelScheduledNotificationAsync(existing).catch(() => undefined);
    localStorage.removeItem(REMINDER_ID_KEY);
  }
  if (!preference.enabled) return 'disabled';
  const permissions = await Notifications.requestPermissionsAsync();
  if (permissions.status !== 'granted') return 'denied';
  const id = await Notifications.scheduleNotificationAsync({
    content: { title: 'A note from your garden', body: reminderBody(preference), sound: false, data: { screen: 'calendar' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: preference.hour, minute: preference.minute },
  });
  localStorage.setItem(REMINDER_ID_KEY, id);
  return 'scheduled';
}
