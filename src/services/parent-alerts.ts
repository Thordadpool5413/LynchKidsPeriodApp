import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { apiClient } from './api-client';

export async function enableParentAlerts(token: string): Promise<void> {
  if (process.env.EXPO_OS !== 'ios' && process.env.EXPO_OS !== 'android') throw new Error('Parent push alerts are available in the iPhone or iPad app.');
  const permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') throw new Error('Notifications are off. You can enable them in device Settings.');
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId || projectId === 'SET_WITH_EAS_INIT') throw new Error('Push setup needs the production EAS project ID.');
  const pushToken = await Notifications.getExpoPushTokenAsync({ projectId });
  await apiClient.registerDevice(token, pushToken.data, process.env.EXPO_OS);
  await apiClient.updateReminderPreference(token, {
    enabled: true,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
    quietHoursStart: 20,
    quietHoursEnd: 7,
    leadDays: [5, 1],
    phraseCode: 'garden-moment',
  });
}
