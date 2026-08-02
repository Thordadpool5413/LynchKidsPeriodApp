import { and, desc, eq, isNull } from 'drizzle-orm';
import { hasPlusAccess, normalizeEntitlement } from '../../shared/entitlements';
import type { SubscriptionEntitlement } from '../../shared/types';
import { db } from '../db/client';
import { childProfiles, consentRecords, subscriptionEntitlements } from '../db/schema';

export async function getEntitlement(parentAccountId: string): Promise<SubscriptionEntitlement> {
  if (!db) return normalizeEntitlement({ status: 'free' });
  const [record] = await db.select().from(subscriptionEntitlements)
    .where(eq(subscriptionEntitlements.parentAccountId, parentAccountId)).limit(1);
  if (!record) return normalizeEntitlement({ parentAccountId, status: 'free' });
  return normalizeEntitlement({
    parentAccountId,
    status: record.status,
    source: record.source ?? undefined,
    plan: record.plan === 'monthly' || record.plan === 'annual' ? record.plan : undefined,
    currentPeriodEndsAt: record.currentPeriodEndsAt?.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
}

export async function requirePlus(parentAccountId: string): Promise<boolean> {
  return hasPlusAccess(await getEntitlement(parentAccountId));
}

export async function hasActiveConsent(parentAccountId: string, childProfileId: string): Promise<boolean> {
  if (!db) return false;
  const result = await db.select({ id: consentRecords.id }).from(consentRecords).where(and(
    eq(consentRecords.parentAccountId, parentAccountId),
    eq(consentRecords.childProfileId, childProfileId),
    isNull(consentRecords.revokedAt),
  )).orderBy(desc(consentRecords.consentedAt)).limit(1);
  return result.length > 0;
}

export async function getParentChild(parentAccountId: string): Promise<string | null> {
  if (!db) return null;
  const [child] = await db.select({ id: childProfiles.id }).from(childProfiles).where(and(
    eq(childProfiles.parentAccountId, parentAccountId),
    isNull(childProfiles.deletedAt),
  )).limit(1);
  return child?.id ?? null;
}
