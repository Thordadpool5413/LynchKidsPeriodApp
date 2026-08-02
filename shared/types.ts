export type ISODate = `${number}-${number}-${number}`;

export type Mood = 'good' | 'calm' | 'tired' | 'emotional' | 'worried';
export type Symptom = 'cramps' | 'headache' | 'bloating' | 'backache' | 'low-energy';
export type Flow = 'spotting' | 'light' | 'medium' | 'heavy';
export type CycleEventKind = 'period-start' | 'period-day' | 'period-end' | 'not-on-period';
export type EntitlementStatus =
  | 'free'
  | 'trialing'
  | 'active'
  | 'grace_period'
  | 'billing_retry'
  | 'expired'
  | 'refunded'
  | 'revoked';

export interface ParentAccount {
  id: string;
  email: string;
  emailVerifiedAt?: string;
  createdAt: string;
}

export interface ChildProfile {
  id: string;
  nickname?: string;
  birthYear?: number;
  parentAccountId?: string;
  cloudSyncEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConsentRecord {
  id: string;
  parentAccountId: string;
  childProfileId: string;
  policyVersion: string;
  method: 'verified-email-plus-payment' | 'manual-review';
  consentedAt: string;
  revokedAt?: string;
}

export interface CycleEvent {
  id: string;
  childProfileId: string;
  date: ISODate;
  kind: CycleEventKind;
  flow?: Flow;
  symptoms: Symptom[];
  note?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface DailyCheckIn {
  id: string;
  childProfileId: string;
  date: ISODate;
  mood: Mood;
  symptoms: Symptom[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface JournalEntry {
  id: string;
  childProfileId: string;
  title: string;
  body: string;
  prompt?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface ShareGrant {
  id: string;
  childProfileId: string;
  resourceType: 'journal' | 'ai-answer' | 'care-summary';
  resourceId: string;
  sharedAt: string;
  revokedAt?: string;
}

export interface ReminderPreference {
  enabled: boolean;
  daysBefore: number;
  hour: number;
  minute: number;
  phrase: 'bloom' | 'little-kit' | 'custom';
  customPhrase?: string;
}

export type CareRequestItemCode =
  | 'pads' | 'liners' | 'period-underwear' | 'spare-underwear' | 'wipes' | 'heat-pack' | 'school-kit-refill'
  | 'water' | 'warm-drink' | 'parent-approved-snack'
  | 'quiet-time' | 'rest' | 'comfort-item'
  | 'bathroom-plan' | 'nurse-help' | 'teacher-note'
  | 'pickup' | 'check-on-me';

export type CareRequestResponseCode = 'got-it' | 'help-soon' | 'lets-talk' | 'not-right-now';
export type CareRequestStatus = 'open' | 'acknowledged' | 'cancelled' | 'expired';

export interface CareRequest {
  id: string;
  childProfileId: string;
  items: CareRequestItemCode[];
  note?: string;
  urgentSafety?: boolean;
  status: CareRequestStatus;
  responseCode?: CareRequestResponseCode;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

export interface ParentReminderPreference {
  enabled: boolean;
  timezone: string;
  quietHoursStart: number;
  quietHoursEnd: number;
  leadDays: number[];
  phraseCode: 'garden-moment' | 'little-kit';
  consentedAt?: string;
}

export interface DeviceRegistration {
  id: string;
  ownerRole: 'parent' | 'child';
  platform: 'ios' | 'android';
  enabled: boolean;
  lastSeenAt: string;
}

export interface CycleForecast {
  estimatedDate: ISODate;
  confidence: 'low' | 'medium' | 'high';
  sourceRevision: string;
  calculatedAt: string;
}

export interface AchievementProgress {
  id: string;
  code: string;
  earnedAt?: string;
  progress: number;
  target: number;
}

export interface EducationProgress {
  contentId: string;
  completedAt?: string;
  quizScore?: number;
}

export interface ContentItem {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  category: 'basics' | 'body' | 'school' | 'feelings' | 'safety' | 'self-care';
  premium: boolean;
  reviewedAt: string;
  reviewerStatus: 'draft' | 'clinician-reviewed';
  publishedAt: string;
}

export interface SubscriptionEntitlement {
  parentAccountId?: string;
  status: EntitlementStatus;
  plan?: 'monthly' | 'annual';
  source?: 'apple' | 'stripe' | 'preview';
  trialEndsAt?: string;
  currentPeriodEndsAt?: string;
  updatedAt: string;
}

export interface AIUsageSummary {
  month: string;
  categoryCounts: Record<string, number>;
  total: number;
}

export interface AuditEvent {
  id: string;
  actorType: 'child' | 'parent' | 'system';
  action: string;
  resourceType: string;
  resourceId?: string;
  occurredAt: string;
}

export interface AppData {
  schemaVersion: 1;
  profile: ChildProfile;
  onboardingComplete: boolean;
  cycleEvents: CycleEvent[];
  checkIns: DailyCheckIn[];
  journalEntries: JournalEntry[];
  shareGrants: ShareGrant[];
  achievements: AchievementProgress[];
  educationProgress: EducationProgress[];
  reminder: ReminderPreference;
  entitlement: SubscriptionEntitlement;
  reducedMotion: boolean;
  selectedTheme: 'garden' | 'rainbow' | 'starlight';
}

export interface SyncMutation {
  idempotencyKey: string;
  entityType: 'cycle-event' | 'check-in' | 'journal-entry' | 'share-grant' | 'education-progress';
  operation: 'upsert' | 'delete';
  entityId: string;
  updatedAt: string;
  payload: unknown;
}
