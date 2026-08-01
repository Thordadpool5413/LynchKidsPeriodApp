import type { EntitlementStatus, SubscriptionEntitlement } from './types';

const ACTIVE_STATUSES: EntitlementStatus[] = ['trialing', 'active', 'grace_period'];

export function hasPlusAccess(entitlement: SubscriptionEntitlement): boolean {
  return ACTIVE_STATUSES.includes(entitlement.status);
}

export function normalizeEntitlement(input: Partial<SubscriptionEntitlement>): SubscriptionEntitlement {
  return {
    status: input.status ?? 'free',
    updatedAt: input.updatedAt ?? new Date().toISOString(),
    ...(input.parentAccountId ? { parentAccountId: input.parentAccountId } : {}),
    ...(input.plan ? { plan: input.plan } : {}),
    ...(input.source ? { source: input.source } : {}),
    ...(input.trialEndsAt ? { trialEndsAt: input.trialEndsAt } : {}),
    ...(input.currentPeriodEndsAt ? { currentPeriodEndsAt: input.currentPeriodEndsAt } : {}),
  };
}
