import type { ContentItem } from './types';

// This catalog is intentionally empty until each item has been approved
// by a qualified clinician.  Draft copy lives in server/pending-content.ts,
// which is not bundled into the client app.
//
// To publish an item:
//   1. Send it to the clinician for review via server/pending-content.ts.
//   2. Record documented sign-off (name, date, method).
//   3. Move the approved item here with reviewerStatus:'clinician-reviewed'
//      and set reviewedAt / publishedAt to the sign-off date.
export const EDUCATION_CONTENT: ContentItem[] = [];

/**
 * Returns only clinician-reviewed items from any catalog.
 * Accepts a catalog parameter so the filter logic can be tested
 * with synthetic fixtures independently of the real catalog state.
 */
export function filterPublished(catalog: ContentItem[]): ContentItem[] {
  return catalog.filter((item) => item.reviewerStatus === 'clinician-reviewed');
}

/** Clinician-approved items safe to serve publicly. Empty until review is complete. */
export const PUBLISHED_CONTENT: ContentItem[] = filterPublished(EDUCATION_CONTENT);

export const ASK_BLOOM_TILES = [
  'Is brown Glitter (period) blood normal?',
  'What should I keep in my school kit?',
  'What can I do when I have cramps?',
  'How do I tell a teacher I need the bathroom?',
];

export function findCuratedAnswer(question: string): ContentItem[] {
  const words = question.toLowerCase().split(/\W+/).filter((word) => word.length > 2);
  return PUBLISHED_CONTENT
    .map((item) => ({ item, score: words.filter((word) => `${item.title} ${item.summary} ${item.body}`.toLowerCase().includes(word)).length }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ item }) => item);
}
