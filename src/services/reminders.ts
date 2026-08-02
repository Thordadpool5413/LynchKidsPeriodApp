import * as Notifications from 'expo-notifications';
import type { ReminderPreference } from '@shared/types';
import { addDays } from '@shared/cycle';
import type { ISODate } from '@shared/types';

const REMINDER_ID_KEY = 'glitter.reminder-id';

function reminderBody(preference: ReminderPreference): string {
  if (preference.phrase === 'custom' && preference.customPhrase?.trim()) return preference.customPhrase.trim().slice(0, 80);
  return preference.phrase === 'bloom' ? 'A garden moment may be getting closer.' : 'Remember your little kit.';
}

export async function updateForecastReminder(preference: ReminderPreference, nextStart?: ISODate): Promise<'scheduled' | 'disabled' | 'unsupported' | 'denied' | 'not-enough-data'> {
  if (process.env.EXPO_OS === 'web') return 'unsupported';
  const existing = localStorage.getItem(REMINDER_ID_KEY);
  if (existing) {
    await Notifications.cancelScheduledNotificationAsync(existing).catch(() => undefined);
    localStorage.removeItem(REMINDER_ID_KEY);
  }
  if (!preference.enabled) return 'disabled';
  if (!nextStart) return 'not-enough-data';
  const permissions = await Notifications.requestPermissionsAsync();
  if (permissions.status !== 'granted') return 'denied';
  const [year, month, day] = addDays(nextStart, -preference.daysBefore).split('-').map(Number);
  const reminderDate = new Date(year, month - 1, day, preference.hour, preference.minute, 0, 0);
  if (reminderDate <= new Date()) return 'not-enough-data';
  const id = await Notifications.scheduleNotificationAsync({
    content: { title: 'A note from your garden', body: reminderBody(preference), sound: false, data: { screen: 'calendar' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminderDate },
  });
  localStorage.setItem(REMINDER_ID_KEY, id);
  return 'scheduled';
}
