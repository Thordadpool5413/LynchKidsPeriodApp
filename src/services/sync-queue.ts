import 'expo-sqlite/localStorage/install';
import type { SyncMutation } from '@shared/types';
import { apiClient } from './api-client';

const QUEUE_KEY = 'glitter.sync-queue.v1';

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
  const queue = readQueue();
  if (!queue.length) return 0;
  const result = await apiClient.sync(token, queue);
  const accepted = new Set(result.accepted);
  const remaining = queue.filter((item) => !accepted.has(item.idempotencyKey));
  localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  return queue.length - remaining.length;
}
