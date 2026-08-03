import Constants from 'expo-constants';
import type { CareRequest, CareRequestItemCode, CareRequestResponseCode, ContentItem, ParentReminderPreference, SubscriptionEntitlement, SyncMutation } from '@shared/types';

const apiUrl = (process.env.EXPO_OS === 'web'
  ? process.env.EXPO_PUBLIC_API_URL ?? ''
  : process.env.EXPO_PUBLIC_API_URL ?? Constants.expoConfig?.extra?.apiUrl ?? '').replace(/\/$/, '');

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  if (!apiUrl && process.env.EXPO_OS !== 'web') throw new Error('AvaCado cloud services are not configured. Your local data is unchanged.');
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : 'AvaCado could not complete that request.');
  return body as T;
}

export const apiClient = {
  requestParentLink: (email: string) => request<{ accepted: true; message: string }>('/v1/auth/request-link', { method: 'POST', body: JSON.stringify({ email }) }),
  verifyParentLink: (token: string) => request<{ token: string; expiresAt: string }>(`/v1/auth/verify-link?token=${encodeURIComponent(token)}`),
  linkChild: (code: string) => request<{ token: string; childProfileId: string; expiresAt: string }>('/v1/child/link', { method: 'POST', body: JSON.stringify({ code }) }),
  recordConsent: (token: string, verificationReference: string, verificationProof: string) => request<{ childProfileId: string; consentedAt: string; policyVersion: string }>('/v1/parent/consent', { method: 'POST', body: JSON.stringify({ verificationReference, verificationProof }) }, token),
  createLinkCode: (token: string) => request<{ code: string; expiresAt: string }>('/v1/parent/link-codes', { method: 'POST' }, token),
  content: () => request<{ items: ContentItem[] }>('/v1/content'),
  entitlement: (token: string) => request<{ entitlement: SubscriptionEntitlement }>('/v1/entitlement', {}, token),
  sync: (token: string, mutations: SyncMutation[]) => request<{ accepted: string[]; serverTime: string }>('/v1/sync', { method: 'POST', body: JSON.stringify({ mutations }) }, token),
  askBloom: (token: string, question: string) => request<{ mode: string; safety: string; answer?: string; items?: ContentItem[]; retained: false }>('/v1/ask-bloom', { method: 'POST', body: JSON.stringify({ question }) }, token),
  checkout: (token: string, plan: 'monthly' | 'annual') => request<{ url: string }>('/v1/checkout', { method: 'POST', body: JSON.stringify({ plan }) }, token),
  billingPortal: (token: string) => request<{ url: string }>('/v1/billing/portal', { method: 'POST' }, token),
  careRequests: (token: string) => request<{ requests: CareRequest[] }>('/v1/care-requests', {}, token),
  createCareRequest: (token: string, input: { clientRequestId: string; items: CareRequestItemCode[]; note?: string; urgentSafety?: boolean }) => request<{ request: CareRequest }>('/v1/care-requests', { method: 'POST', body: JSON.stringify(input) }, token),
  updateCareRequest: (token: string, id: string, input: { action: 'cancel' | 'edit' | 'acknowledge'; responseCode?: CareRequestResponseCode; items?: CareRequestItemCode[]; note?: string }) => request<{ status: string; responseCode?: CareRequestResponseCode }>(`/v1/care-requests/${id}/status`, { method: 'PATCH', body: JSON.stringify(input) }, token),
  parentDashboard: (token: string) => request<{ linked: boolean; forecast: { estimatedDate: string; confidence: string; calculatedAt: string } | null; careRequests: CareRequest[] }>('/v1/parent/dashboard', {}, token),
  childLinkStatus: (token: string) => request<{ linked: boolean; parentRemindersEnabled: boolean; disclosure?: string }>('/v1/child/link-status', {}, token),
  reminderPreference: (token: string) => request<{ preference: ParentReminderPreference }>('/v1/parent/reminder-preferences', {}, token),
  updateReminderPreference: (token: string, preference: ParentReminderPreference) => request<{ preference: ParentReminderPreference }>('/v1/parent/reminder-preferences', { method: 'PATCH', body: JSON.stringify(preference) }, token),
  exportAccount: (token: string) => request<Record<string, unknown>>('/v1/account/export', { method: 'POST' }, token),
  unlinkChild: (token: string) => request<void>('/v1/parent/unlink', { method: 'POST' }, token),
  registerDevice: (token: string, expoPushToken: string, platform: 'ios' | 'android') => request<{ id: string }>('/v1/devices', { method: 'POST', body: JSON.stringify({ expoPushToken, platform }) }, token),
};
