import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const entitlementStatus = pgEnum('entitlement_status', ['free', 'trialing', 'active', 'grace_period', 'billing_retry', 'expired', 'refunded', 'revoked']);
export const subscriptionSource = pgEnum('subscription_source', ['apple', 'stripe', 'preview']);
export const ownerRole = pgEnum('owner_role', ['parent', 'child']);
export const careRequestStatus = pgEnum('care_request_status', ['open', 'acknowledged', 'cancelled', 'expired']);
export const notificationJobStatus = pgEnum('notification_job_status', ['pending', 'processing', 'sent', 'retry', 'failed', 'cancelled']);

export const parentAccounts = pgTable('parent_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [uniqueIndex('parent_email_unique').on(table.email)]);

export const magicLinkTokens = pgTable('magic_link_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  parentAccountId: uuid('parent_account_id').notNull().references(() => parentAccounts.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex('magic_link_token_hash_unique').on(table.tokenHash)]);

export const childProfiles = pgTable('child_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  parentAccountId: uuid('parent_account_id').references(() => parentAccounts.id, { onDelete: 'cascade' }),
  encryptedProfile: jsonb('encrypted_profile').notNull(),
  cloudSyncEnabled: boolean('cloud_sync_enabled').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [index('child_parent_index').on(table.parentAccountId)]);

export const sessionRecords = pgTable('session_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerRole: ownerRole('owner_role').notNull(),
  ownerId: text('owner_id').notNull(),
  childProfileId: uuid('child_profile_id').references(() => childProfiles.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index('session_owner_index').on(table.ownerRole, table.ownerId)]);

export const deviceLinkCodes = pgTable('device_link_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  parentAccountId: uuid('parent_account_id').notNull().references(() => parentAccounts.id, { onDelete: 'cascade' }),
  childProfileId: uuid('child_profile_id').notNull().references(() => childProfiles.id, { onDelete: 'cascade' }),
  codeHash: text('code_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex('device_link_code_hash_unique').on(table.codeHash)]);

export const consentRecords = pgTable('consent_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  parentAccountId: uuid('parent_account_id').notNull().references(() => parentAccounts.id, { onDelete: 'cascade' }),
  childProfileId: uuid('child_profile_id').notNull().references(() => childProfiles.id, { onDelete: 'cascade' }),
  policyVersion: text('policy_version').notNull(),
  method: text('method').notNull(),
  consentedAt: timestamp('consented_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});

export const deviceRegistrations = pgTable('device_registrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  parentAccountId: uuid('parent_account_id').references(() => parentAccounts.id, { onDelete: 'cascade' }),
  childProfileId: uuid('child_profile_id').references(() => childProfiles.id, { onDelete: 'cascade' }),
  ownerRole: ownerRole('owner_role').notNull(),
  encryptedExpoToken: jsonb('encrypted_expo_token').notNull(),
  tokenFingerprint: text('token_fingerprint').notNull(),
  platform: text('platform').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('device_token_fingerprint_unique').on(table.tokenFingerprint),
  index('device_parent_enabled_index').on(table.parentAccountId, table.enabled),
]);

export const parentReminderPreferences = pgTable('parent_reminder_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  parentAccountId: uuid('parent_account_id').notNull().references(() => parentAccounts.id, { onDelete: 'cascade' }),
  childProfileId: uuid('child_profile_id').notNull().references(() => childProfiles.id, { onDelete: 'cascade' }),
  enabled: boolean('enabled').notNull().default(false),
  timezone: text('timezone').notNull().default('America/New_York'),
  quietHoursStart: integer('quiet_hours_start').notNull().default(20),
  quietHoursEnd: integer('quiet_hours_end').notNull().default(7),
  leadDays: jsonb('lead_days').notNull().default([5, 1]),
  phraseCode: text('phrase_code').notNull().default('garden-moment'),
  consentedAt: timestamp('consented_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex('parent_reminder_child_unique').on(table.parentAccountId, table.childProfileId)]);

export const syncRecords = pgTable('sync_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  childProfileId: uuid('child_profile_id').notNull().references(() => childProfiles.id, { onDelete: 'cascade' }),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  encryptedPayload: jsonb('encrypted_payload').notNull(),
  clientUpdatedAt: timestamp('client_updated_at', { withTimezone: true }).notNull(),
  revisionKey: text('revision_key').notNull(),
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

export const careRequests = pgTable('care_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  parentAccountId: uuid('parent_account_id').notNull().references(() => parentAccounts.id, { onDelete: 'cascade' }),
  childProfileId: uuid('child_profile_id').notNull().references(() => childProfiles.id, { onDelete: 'cascade' }),
  encryptedItems: jsonb('encrypted_items').notNull(),
  encryptedNote: jsonb('encrypted_note'),
  urgentSafety: boolean('urgent_safety').notNull().default(false),
  status: careRequestStatus('status').notNull().default('open'),
  clientRequestId: text('client_request_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
}, (table) => [
  uniqueIndex('care_request_client_unique').on(table.childProfileId, table.clientRequestId),
  index('care_request_child_status_index').on(table.childProfileId, table.status),
  index('care_request_parent_status_index').on(table.parentAccountId, table.status),
]);

export const careRequestResponses = pgTable('care_request_responses', {
  id: uuid('id').primaryKey().defaultRandom(),
  careRequestId: uuid('care_request_id').notNull().references(() => careRequests.id, { onDelete: 'cascade' }),
  parentAccountId: uuid('parent_account_id').notNull().references(() => parentAccounts.id, { onDelete: 'cascade' }),
  responseCode: text('response_code').notNull(),
  respondedAt: timestamp('responded_at', { withTimezone: true }).notNull().defaultNow(),
});

export const cycleForecasts = pgTable('cycle_forecasts', {
  id: uuid('id').primaryKey().defaultRandom(),
  childProfileId: uuid('child_profile_id').notNull().references(() => childProfiles.id, { onDelete: 'cascade' }),
  estimatedDate: text('estimated_date').notNull(),
  confidence: text('confidence').notNull(),
  sourceRevision: text('source_revision').notNull(),
  calculatedAt: timestamp('calculated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex('cycle_forecast_child_unique').on(table.childProfileId)]);

export const notificationJobs = pgTable('notification_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceRegistrationId: uuid('device_registration_id').notNull().references(() => deviceRegistrations.id, { onDelete: 'cascade' }),
  parentAccountId: uuid('parent_account_id').notNull().references(() => parentAccounts.id, { onDelete: 'cascade' }),
  childProfileId: uuid('child_profile_id').notNull().references(() => childProfiles.id, { onDelete: 'cascade' }),
  opaqueEventId: uuid('opaque_event_id').notNull().defaultRandom(),
  templateCode: text('template_code').notNull(),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  status: notificationJobStatus('status').notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0),
  receiptId: text('receipt_id'),
  lastErrorCode: text('last_error_code'),
  deduplicationKey: text('deduplication_key').notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('notification_dedupe_unique').on(table.deduplicationKey),
  index('notification_due_index').on(table.status, table.scheduledAt),
]);

export const subscriptionEntitlements = pgTable('subscription_entitlements', {
  id: uuid('id').primaryKey().defaultRandom(),
  parentAccountId: uuid('parent_account_id').notNull().references(() => parentAccounts.id, { onDelete: 'cascade' }),
  status: entitlementStatus('status').notNull().default('free'),
  source: subscriptionSource('source'),
  plan: text('plan'),
  providerCustomerId: text('provider_customer_id'),
  providerSubscriptionId: text('provider_subscription_id'),
  currentPeriodEndsAt: timestamp('current_period_ends_at', { withTimezone: true }),
  trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
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
