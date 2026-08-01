import type { ContentItem } from './types';

export const EDUCATION_CONTENT: ContentItem[] = [
  {
    id: 'first-period', slug: 'first-period', title: 'Your first period',
    summary: 'What it can look and feel like—and why every body has its own timing.',
    body: 'A first period can be light, brown, red, or a little spotty. It may last a few days, and the timing can be irregular at first. Keep a pad or period underwear nearby, and tell a trusted grown-up if you need help.',
    category: 'basics', premium: false, reviewedAt: '2026-07-30', reviewerStatus: 'draft', publishedAt: '2026-07-30',
  },
  {
    id: 'period-products', slug: 'period-products', title: 'Pads, period underwear, and tampons',
    summary: 'A no-pressure guide to the products you might hear about.',
    body: 'Pads stick to underwear. Period underwear absorbs flow. Tampons are worn inside the vagina and should be changed as directed on the package. Start with the option that feels comfortable and ask a trusted grown-up for help.',
    category: 'basics', premium: false, reviewedAt: '2026-07-30', reviewerStatus: 'draft', publishedAt: '2026-07-30',
  },
  {
    id: 'cramp-comfort', slug: 'cramp-comfort', title: 'Comfort for cramps',
    summary: 'Gentle things that may help your body feel more comfortable.',
    body: 'A warm pack, gentle movement, water, rest, and slow breathing may help. Ask a grown-up before taking medicine. Tell one right away if pain is very strong, sudden, or keeps you from normal activities.',
    category: 'self-care', premium: false, reviewedAt: '2026-07-30', reviewerStatus: 'draft', publishedAt: '2026-07-30',
  },
  {
    id: 'school-kit', slug: 'school-kit', title: 'Build a tiny school kit',
    summary: 'Pack what you need without making a big deal of it.',
    body: 'Try a small pouch with two pads, spare underwear, a sealable bag, and wipes made for skin. Keep it in a backpack pocket. Check it once a month and replace anything you use.',
    category: 'school', premium: true, reviewedAt: '2026-07-30', reviewerStatus: 'draft', publishedAt: '2026-07-30',
  },
  {
    id: 'ask-for-help', slug: 'ask-for-help', title: 'When to ask for help',
    summary: 'Your body deserves attention when something feels wrong.',
    body: 'Tell a trusted grown-up if you soak through a pad or tampon every hour for more than two hours, feel faint, have severe pain, bleed for more than seven days, or feel worried about anything happening to your body.',
    category: 'safety', premium: false, reviewedAt: '2026-07-30', reviewerStatus: 'draft', publishedAt: '2026-07-30',
  },
];

export const ASK_BLOOM_TILES = [
  'Is brown period blood normal?',
  'What should I keep in my school kit?',
  'What can I do when I have cramps?',
  'How do I tell a teacher I need the bathroom?',
];

export function findCuratedAnswer(question: string): ContentItem[] {
  const words = question.toLowerCase().split(/\W+/).filter((word) => word.length > 2);
  return EDUCATION_CONTENT
    .map((item) => ({ item, score: words.filter((word) => `${item.title} ${item.summary} ${item.body}`.toLowerCase().includes(word)).length }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ item }) => item);
}
