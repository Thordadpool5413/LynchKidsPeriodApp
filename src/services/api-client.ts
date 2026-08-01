import Constants from 'expo-constants';
import type { ContentItem, SubscriptionEntitlement, SyncMutation } from '@shared/types';

const apiUrl = (process.env.EXPO_OS === 'web'
  ? process.env.EXPO_PUBLIC_API_URL ?? ''
  : process.env.EXPO_PUBLIC_API_URL ?? Constants.expoConfig?.extra?.apiUrl ?? '').replace(/\/$/, '');

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  if (!apiUrl && process.env.EXPO_OS !== 'web') throw new Error('Glitter cloud services are not configured. Your local data is unchanged.');
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : 'Glitter could not complete that request.');
  return body as T;
}

export const apiClient = {
  content: () => request<{ items: ContentItem[] }>('/v1/content'),
  entitlement: (token: string) => request<{ entitlement: SubscriptionEntitlement }>('/v1/entitlement', {}, token),
  sync: (token: string, mutations: SyncMutation[]) => request<{ accepted: string[]; serverTime: string }>('/v1/sync', { method: 'POST', body: JSON.stringify({ mutations }) }, token),
  askBloom: (token: string, question: string) => request<{ mode: string; safety: string; answer?: string; items?: ContentItem[]; retained: false }>('/v1/ask-bloom', { method: 'POST', body: JSON.stringify({ question }) }, token),
  checkout: (token: string, plan: 'monthly' | 'annual') => request<{ url: string }>('/v1/checkout', { method: 'POST', body: JSON.stringify({ plan }) }, token),
  billingPortal: (token: string) => request<{ url: string }>('/v1/billing/portal', { method: 'POST' }, token),
  requestLink: (email: string) => request<{ accepted: boolean; message: string }>('/v1/auth/request-link', { method: 'POST', body: JSON.stringify({ email }) }),
  verifyLink: (magicToken: string) => request<{ token: string; parentAccountId: string }>(`/v1/auth/verify-link?token=${encodeURIComponent(magicToken)}`),
};
