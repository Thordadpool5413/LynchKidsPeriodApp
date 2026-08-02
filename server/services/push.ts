import { and, eq, lt } from 'drizzle-orm';
import { db } from '../db/client';
import { careRequests, deviceRegistrations, notificationJobs } from '../db/schema';
import { decryptField } from '../security/crypto';
import { config } from '../config';
import { hasActiveConsent, requirePlus } from './access';

const TEMPLATES: Record<string, { title: string; body: string }> = {
  'care-request': { title: 'Glitter', body: 'A garden note is waiting.' },
  'forecast-soon': { title: 'Glitter', body: 'A garden moment may be getting closer.' },
};

export async function sendDueNotifications(now = new Date()): Promise<{ sent: number; failed: number }> {
  if (!db) throw new Error('DATABASE_URL is required for notification jobs');
  await db.update(careRequests).set({ status: 'expired', updatedAt: now }).where(and(eq(careRequests.status, 'open'), lt(careRequests.expiresAt, now)));
  await inspectPushReceipts();
  const due = await db.query.notificationJobs.findMany({
    where: (jobs, operators) => operators.and(
      operators.inArray(jobs.status, ['pending', 'retry']),
      operators.lte(jobs.scheduledAt, now),
    ),
    limit: 100,
  });
  let sent = 0;
  let failed = 0;
  for (const job of due) {
    if (!(await requirePlus(job.parentAccountId)) || !(await hasActiveConsent(job.parentAccountId, job.childProfileId))) {
      await db.update(notificationJobs).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(notificationJobs.id, job.id));
      continue;
    }
    const [device] = await db.select().from(deviceRegistrations).where(and(
      eq(deviceRegistrations.id, job.deviceRegistrationId),
      eq(deviceRegistrations.enabled, true),
    )).limit(1);
    if (!device) {
      await db.update(notificationJobs).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(notificationJobs.id, job.id));
      continue;
    }
    const template = TEMPLATES[job.templateCode];
    if (!template) {
      await db.update(notificationJobs).set({ status: 'failed', lastErrorCode: 'unknown-template', updatedAt: new Date() }).where(eq(notificationJobs.id, job.id));
      failed += 1;
      continue;
    }
    try {
      const token = decryptField<string>(device.encryptedExpoToken as never);
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${config.EXPO_ACCESS_TOKEN}` } : {}),
        },
        body: JSON.stringify({ to: token, title: template.title, body: template.body, data: { eventId: job.opaqueEventId } }),
      });
      const payload = await response.json() as { data?: { status?: string; id?: string; details?: { error?: string } } };
      const errorCode = payload.data?.details?.error;
      if (!response.ok || payload.data?.status === 'error') throw new Error(errorCode ?? 'push-rejected');
      await db.update(notificationJobs).set({ status: 'sent', receiptId: payload.data?.id, sentAt: new Date(), attempts: job.attempts + 1, updatedAt: new Date() }).where(eq(notificationJobs.id, job.id));
      sent += 1;
    } catch (error) {
      const code = error instanceof Error ? error.message.slice(0, 80) : 'push-failed';
      const terminal = code === 'DeviceNotRegistered' || job.attempts >= 4;
      if (code === 'DeviceNotRegistered') await db.update(deviceRegistrations).set({ enabled: false, revokedAt: new Date() }).where(eq(deviceRegistrations.id, device.id));
      await db.update(notificationJobs).set({ status: terminal ? 'failed' : 'retry', lastErrorCode: code, attempts: job.attempts + 1, scheduledAt: new Date(Date.now() + Math.min(60, 2 ** job.attempts) * 60_000), updatedAt: new Date() }).where(eq(notificationJobs.id, job.id));
      failed += 1;
    }
  }
  return { sent, failed };
}

async function inspectPushReceipts(): Promise<void> {
  if (!db) return;
  const jobs = await db.select({ id: notificationJobs.id, deviceRegistrationId: notificationJobs.deviceRegistrationId, receiptId: notificationJobs.receiptId }).from(notificationJobs).where(and(eq(notificationJobs.status, 'sent'), lt(notificationJobs.updatedAt, new Date(Date.now() - 60_000)))).limit(300);
  const receiptIds = jobs.map((job) => job.receiptId).filter((id): id is string => Boolean(id));
  if (!receiptIds.length) return;
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/getReceipts', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(config.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${config.EXPO_ACCESS_TOKEN}` } : {}) }, body: JSON.stringify({ ids: receiptIds }) });
    if (!response.ok) return;
    const payload = await response.json() as { data?: Record<string, { status?: string; details?: { error?: string } }> };
    for (const job of jobs) {
      if (!job.receiptId) continue;
      const receipt = payload.data?.[job.receiptId];
      if (receipt?.status !== 'error') continue;
      const errorCode = receipt.details?.error ?? 'receipt-error';
      await db.update(notificationJobs).set({ lastErrorCode: errorCode, updatedAt: new Date() }).where(eq(notificationJobs.id, job.id));
      if (errorCode === 'DeviceNotRegistered') await db.update(deviceRegistrations).set({ enabled: false, revokedAt: new Date() }).where(eq(deviceRegistrations.id, job.deviceRegistrationId));
    }
  } catch { /* receipt inspection retries on the next scheduled run */ }
}
