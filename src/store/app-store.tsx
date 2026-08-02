import 'expo-sqlite/localStorage/install';

import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AppData,
  CycleEvent,
  DailyCheckIn,
  EducationProgress,
  Flow,
  ISODate,
  JournalEntry,
  Mood,
  ReminderPreference,
  ShareGrant,
  Symptom,
} from '@shared/types';
import { createId } from '@/utils/id';
import { enqueueMutation } from '@/services/sync-queue';

const STORAGE_KEY = 'glitter.app-data.v1';
const now = () => new Date().toISOString();

function queue(entityType: 'cycle-event' | 'check-in' | 'journal-entry' | 'share-grant' | 'education-progress', operation: 'upsert' | 'delete', entityId: string, updatedAt: string, payload: unknown) {
  enqueueMutation({ idempotencyKey: createId('mutation'), entityType, operation, entityId, updatedAt, payload });
}

export const DEFAULT_DATA: AppData = {
  schemaVersion: 1,
  profile: {
    id: 'local-child',
    cloudSyncEnabled: false,
    createdAt: now(),
    updatedAt: now(),
  },
  onboardingComplete: false,
  cycleEvents: [],
  checkIns: [],
  journalEntries: [],
  shareGrants: [],
  achievements: [
    { id: 'first-checkin', code: 'first-checkin', progress: 0, target: 1 },
    { id: 'first-bloom', code: 'first-bloom', progress: 0, target: 1 },
    { id: 'three-lessons', code: 'three-lessons', progress: 0, target: 3 },
    { id: 'school-ready', code: 'school-ready', progress: 0, target: 1 },
  ],
  educationProgress: [],
  reminder: { enabled: false, daysBefore: 3, hour: 18, minute: 0, phrase: 'little-kit' },
  entitlement: { status: 'free', updatedAt: now() },
  reducedMotion: false,
  selectedTheme: 'garden',
};

interface AppStoreValue {
  data: AppData;
  hydrated: boolean;
  completeOnboarding: (nickname?: string) => void;
  addCheckIn: (mood: Mood, symptoms?: Symptom[]) => void;
  saveCycleDay: (date: ISODate, kind: CycleEvent['kind'], flow?: Flow, symptoms?: Symptom[], note?: string) => void;
  deleteCycleDay: (date: ISODate) => void;
  saveJournal: (input: Pick<JournalEntry, 'title' | 'body' | 'prompt'> & { id?: string }) => string;
  deleteJournal: (id: string) => void;
  shareResource: (resourceType: ShareGrant['resourceType'], resourceId: string) => void;
  revokeShare: (resourceType: ShareGrant['resourceType'], resourceId: string) => void;
  completeLesson: (contentId: string) => void;
  setReminder: (reminder: ReminderPreference) => void;
  setCloudSync: (enabled: boolean) => void;
  setReducedMotion: (enabled: boolean) => void;
  enablePremiumPreview: () => void;
  setEntitlement: (entitlement: import('@shared/types').SubscriptionEntitlement) => void;
  resetAllData: () => void;
  exportData: () => string;
}

const AppStoreContext = createContext<AppStoreValue | null>(null);

function loadData(): AppData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_DATA;
    const parsed = JSON.parse(stored) as Partial<AppData>;
    const merged = { ...DEFAULT_DATA, ...parsed, profile: { ...DEFAULT_DATA.profile, ...parsed.profile } };
    return !__DEV__ && merged.entitlement.source === 'preview' ? { ...merged, entitlement: { status: 'free', updatedAt: now() } } : merged;
  } catch {
    return DEFAULT_DATA;
  }
}

function recalculateAchievements(data: AppData): AppData {
  const lessonCount = data.educationProgress.filter((item) => item.completedAt).length;
  const completed = data.achievements.map((achievement) => {
    const progress = achievement.code === 'first-checkin'
      ? Math.min(data.checkIns.length, 1)
      : achievement.code === 'first-bloom'
        ? Math.min(data.cycleEvents.filter((item) => item.kind === 'period-start' && !item.deletedAt).length, 1)
        : achievement.code === 'three-lessons'
          ? Math.min(lessonCount, 3)
          : achievement.progress;
    return {
      ...achievement,
      progress,
      earnedAt: progress >= achievement.target ? achievement.earnedAt ?? now() : undefined,
    };
  });
  return { ...data, achievements: completed };
}

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(DEFAULT_DATA);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setData(loadData());
    setHydrated(true);
  }, []);

  const update = useCallback((recipe: (current: AppData) => AppData) => {
    setData((current) => {
      const next = recalculateAchievements(recipe(current));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const value = useMemo<AppStoreValue>(() => ({
    data,
    hydrated,
    completeOnboarding: (nickname) => update((current) => ({
      ...current,
      onboardingComplete: true,
      profile: { ...current.profile, nickname: nickname?.trim() || undefined, updatedAt: now() },
    })),
    addCheckIn: (mood, symptoms = []) => update((current) => {
      const date = new Date().toISOString().slice(0, 10) as ISODate;
      const existing = current.checkIns.find((item) => item.date === date && !item.deletedAt);
      const next: DailyCheckIn = existing
        ? { ...existing, mood, symptoms, updatedAt: now() }
        : { id: createId('checkin'), childProfileId: current.profile.id, date, mood, symptoms, createdAt: now(), updatedAt: now() };
      queue('check-in', 'upsert', next.id, next.updatedAt, next);
      return { ...current, checkIns: [...current.checkIns.filter((item) => item.id !== next.id), next] };
    }),
    saveCycleDay: (date, kind, flow, symptoms = [], note) => update((current) => {
      const existing = current.cycleEvents.find((item) => item.date === date && !item.deletedAt);
      const next: CycleEvent = existing
        ? { ...existing, kind, flow, symptoms, note, updatedAt: now() }
        : { id: createId('cycle'), childProfileId: current.profile.id, date, kind, flow, symptoms, note, createdAt: now(), updatedAt: now() };
      queue('cycle-event', 'upsert', next.id, next.updatedAt, next);
      return { ...current, cycleEvents: [...current.cycleEvents.filter((item) => item.id !== next.id), next] };
    }),
    deleteCycleDay: (date) => update((current) => {
      const deletedAt = now();
      const target = current.cycleEvents.find((item) => item.date === date && !item.deletedAt);
      if (target) queue('cycle-event', 'delete', target.id, deletedAt, { id: target.id });
      return { ...current, cycleEvents: current.cycleEvents.map((item) => item.id === target?.id ? { ...item, deletedAt, updatedAt: deletedAt } : item) };
    }),
    saveJournal: (input) => {
      const id = input.id ?? createId('journal');
      update((current) => {
        const existing = current.journalEntries.find((item) => item.id === id);
        const next: JournalEntry = existing
          ? { ...existing, title: input.title, body: input.body, prompt: input.prompt, updatedAt: now(), deletedAt: undefined }
          : { id, childProfileId: current.profile.id, title: input.title, body: input.body, prompt: input.prompt, createdAt: now(), updatedAt: now() };
        const shared = current.shareGrants.some((grant) => grant.resourceType === 'journal' && grant.resourceId === id && !grant.revokedAt);
        if (shared) queue('journal-entry', 'upsert', next.id, next.updatedAt, next);
        return { ...current, journalEntries: [...current.journalEntries.filter((item) => item.id !== id), next] };
      });
      return id;
    },
    deleteJournal: (id) => update((current) => {
      const deletedAt = now();
      const shared = current.shareGrants.some((grant) => grant.resourceType === 'journal' && grant.resourceId === id && !grant.revokedAt);
      if (shared) queue('journal-entry', 'delete', id, deletedAt, { id });
      return { ...current, journalEntries: current.journalEntries.map((item) => item.id === id ? { ...item, deletedAt, updatedAt: deletedAt } : item) };
    }),
    shareResource: (resourceType, resourceId) => update((current) => {
      const existing = current.shareGrants.find((item) => item.resourceType === resourceType && item.resourceId === resourceId && !item.revokedAt);
      if (existing) return current;
      const grant = { id: createId('share'), childProfileId: current.profile.id, resourceType, resourceId, sharedAt: now() } as ShareGrant;
      queue('share-grant', 'upsert', grant.id, grant.sharedAt, grant);
      if (resourceType === 'journal') {
        const entry = current.journalEntries.find((item) => item.id === resourceId && !item.deletedAt);
        if (entry) queue('journal-entry', 'upsert', entry.id, entry.updatedAt, entry);
      }
      return { ...current, shareGrants: [...current.shareGrants, grant] };
    }),
    revokeShare: (resourceType, resourceId) => update((current) => {
      const revokedAt = now();
      const grant = current.shareGrants.find((item) => item.resourceType === resourceType && item.resourceId === resourceId && !item.revokedAt);
      if (grant) queue('share-grant', 'delete', grant.id, revokedAt, { id: grant.id, resourceType, resourceId });
      if (resourceType === 'journal') queue('journal-entry', 'delete', resourceId, revokedAt, { id: resourceId });
      return { ...current, shareGrants: current.shareGrants.map((item) => item.id === grant?.id ? { ...item, revokedAt } : item) };
    }),
    completeLesson: (contentId) => update((current) => {
      const progress: EducationProgress = { contentId, completedAt: now() };
      queue('education-progress', 'upsert', contentId, progress.completedAt!, progress);
      return { ...current, educationProgress: [...current.educationProgress.filter((item) => item.contentId !== contentId), progress] };
    }),
    setReminder: (reminder) => update((current) => ({ ...current, reminder })),
    setCloudSync: (enabled) => update((current) => ({ ...current, profile: { ...current.profile, cloudSyncEnabled: enabled, updatedAt: now() } })),
    setReducedMotion: (enabled) => update((current) => ({ ...current, reducedMotion: enabled })),
    enablePremiumPreview: () => {
      if (!__DEV__) return;
      update((current) => ({ ...current, entitlement: { status: 'trialing', plan: 'annual', source: 'preview', trialEndsAt: new Date(Date.now() + 7 * 86_400_000).toISOString(), updatedAt: now() } }));
    },
    setEntitlement: (entitlement) => update((current) => ({ ...current, entitlement })),
    resetAllData: () => {
      localStorage.removeItem(STORAGE_KEY);
      setData({ ...DEFAULT_DATA, profile: { ...DEFAULT_DATA.profile, createdAt: now(), updatedAt: now() } });
    },
    exportData: () => JSON.stringify(data, null, 2),
  }), [data, hydrated, update]);

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore(): AppStoreValue {
  const context = React.use(AppStoreContext);
  if (!context) throw new Error('useAppStore must be used within AppStoreProvider');
  return context;
}
