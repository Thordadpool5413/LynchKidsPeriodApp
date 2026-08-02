import * as SecureStore from 'expo-secure-store';

const SESSION_KEY = 'glitter.cloud-session.v1';

export interface CloudSession { token: string; role: 'parent' | 'child'; expiresAt: string; childProfileId?: string }

export async function saveCloudSession(session: CloudSession): Promise<void> {
  const value = JSON.stringify(session);
  if (process.env.EXPO_OS === 'web') localStorage.setItem(SESSION_KEY, value);
  else await SecureStore.setItemAsync(SESSION_KEY, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
}

export async function readCloudSession(): Promise<CloudSession | null> {
  const value = process.env.EXPO_OS === 'web' ? localStorage.getItem(SESSION_KEY) : await SecureStore.getItemAsync(SESSION_KEY);
  if (!value) return null;
  try {
    const session = JSON.parse(value) as CloudSession;
    if (new Date(session.expiresAt).getTime() <= Date.now()) return null;
    return session;
  } catch { return null; }
}

export async function clearCloudSession(): Promise<void> {
  if (process.env.EXPO_OS === 'web') localStorage.removeItem(SESSION_KEY);
  else await SecureStore.deleteItemAsync(SESSION_KEY);
}
