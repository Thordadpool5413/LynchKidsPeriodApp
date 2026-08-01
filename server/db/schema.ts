import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const entitlementStatus = pgEnum('entitlement_status', ['free', 'trialing', 'active', 'grace_period', 'billing_retry', 'expired', 'refunded', 'revoked']);
export const subscriptionSource = pgEnum('subscription_source', ['apple', 'stripe', 'preview']);

export const parentAccounts = pgTable('parent_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [uniqueIndex('parent_email_unique').on(table.email)]);

export const childProfiles = pgTable('child_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  parentAccountId: uuid('parent_account_id').references(() => parentAccounts.id, { onDelete: 'cascade' }),
  encryptedProfile: jsonb('encrypted_profile').notNull(),
  cloudSyncEnabled: boolean('cloud_sync_enabled').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [index('child_parent_index').on(table.parentAccountId)]);

export const consentRecords = pgTable('consent_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  parentAccountId: uuid('parent_account_id').notNull().references(() => parentAccounts.id, { onDelete: 'cascade' }),
  childProfileId: uuid('child_profile_id').notNull().references(() => childProfiles.id, { onDelete: 'cascade' }),
  policyVersion: text('policy_version').notNull(),
  method: text('method').notNull(),
  consentedAt: timestamp('consented_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});

export const syncRecords = pgTable('sync_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  childProfileId: uuid('child_profile_id').notNull().references(() => childProfiles.id, { onDelete: 'cascade' }),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  encryptedPayload: jsonb('encrypted_payload').notNull(),
  clientUpdatedAt: timestamp('client_updated_at', { withTimezone: true }).notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('sync_entity_unique').on(table.childProfileId, table.entityType, table.entityId),
  index('sync_child_updated_index').on(table.childProfileId, table.updatedAt),
]);

export const shareGrants = pgTable('share_grants', {
  id: uuid('id').primaryKey().defaultRandom(),
  childProfileId: uuid('child_profile_id').notNull().references(() => childProfiles.id, { onDelete: 'cascade' }),
  resourceType: text('resource_type').notNull(),
  resourceId: text('resource_id').notNull(),
  sharedAt: timestamp('shared_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
}, (table) => [index('share_child_index').on(table.childProfileId)]);

export const subscriptionEntitlements = pgTable('subscription_entitlements', {
  id: uuid('id').primaryKey().defaultRandom(),
  parentAccountId: uuid('parent_account_id').notNull().references(() => parentAccounts.id, { onDelete: 'cascade' }),
  status: entitlementStatus('status').notNull().default('free'),
  source: subscriptionSource('source'),
  plan: text('plan'),
  providerCustomerId: text('provider_customer_id'),
  providerSubscriptionId: text('provider_subscription_id'),
  currentPeriodEndsAt: timestamp('current_period_ends_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex('entitlement_parent_unique').on(table.parentAccountId)]);

export const aiUsageSummaries = pgTable('ai_usage_summaries', {
  id: uuid('id').primaryKey().defaultRandom(),
  childProfileId: uuid('child_profile_id').notNull().references(() => childProfiles.id, { onDelete: 'cascade' }),
  month: text('month').notNull(),
  category: text('category').notNull(),
  count: integer('count').notNull().default(0),
}, (table) => [uniqueIndex('ai_usage_unique').on(table.childProfileId, table.month, table.category)]);

export const auditEvents = pgTable('audit_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  parentAccountId: uuid('parent_account_id').references(() => parentAccounts.id, { onDelete: 'set null' }),
  childProfileId: uuid('child_profile_id').references(() => childProfiles.id, { onDelete: 'set null' }),
  actorType: text('actor_type').notNull(),
  action: text('action').notNull(),
  resourceType: text('resource_type').notNull(),
  resourceId: text('resource_id'),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
});

export const webhookEvents = pgTable('webhook_events', {
  id: text('id').primaryKey(),
  provider: text('provider').notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
});
