import 'expo-sqlite/localStorage/install';
import type { SyncMutation } from '@shared/types';
import { apiClient } from './api-client';

const QUEUE_KEY = 'glitter.sync-queue.v1';
const RETRY_KEY = 'glitter.sync-retry.v1';

function readQueue(): SyncMutation[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as SyncMutation[]; }
  catch { return []; }
}

export function enqueueMutation(mutation: SyncMutation): void {
  const queue = readQueue();
  const withoutOlderCopy = queue.filter((item) => !(item.entityType === mutation.entityType && item.entityId === mutation.entityId));
  localStorage.setItem(QUEUE_KEY, JSON.stringify([...withoutOlderCopy, mutation]));
}

export async function flushSyncQueue(token: string): Promise<number> {
  const retryAt = Number(localStorage.getItem(RETRY_KEY) ?? '0');
  if (retryAt > Date.now()) return 0;
  const queue = readQueue();
  if (!queue.length) return 0;
  try {
    const result = await apiClient.sync(token, queue);
    const accepted = new Set(result.accepted);
    const remaining = queue.filter((item) => !accepted.has(item.idempotencyKey));
    localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
    localStorage.removeItem(RETRY_KEY);
    return queue.length - remaining.length;
  } catch (error) {
    const previous = Number(localStorage.getItem(`${RETRY_KEY}.attempt`) ?? '0');
    const attempt = Math.min(previous + 1, 6);
    localStorage.setItem(`${RETRY_KEY}.attempt`, String(attempt));
    localStorage.setItem(RETRY_KEY, String(Date.now() + Math.min(60, 2 ** attempt) * 1000));
    throw error;
  }
}
