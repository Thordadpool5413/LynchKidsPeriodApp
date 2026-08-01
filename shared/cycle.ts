import type { CycleEvent, ISODate } from './types';

const DAY_MS = 86_400_000;

export function parseISODate(date: ISODate): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function formatISODate(date: Date): ISODate {
  return date.toISOString().slice(0, 10) as ISODate;
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / DAY_MS);
}

export function addDays(date: ISODate, count: number): ISODate {
  return formatISODate(new Date(parseISODate(date).getTime() + count * DAY_MS));
}

export interface CyclePrediction {
  nextStart?: ISODate;
  daysUntil?: number;
  averageCycleLength?: number;
  confidence: 'not-enough-data' | 'early-estimate' | 'pattern-based';
  message: string;
}

export function predictNextPeriod(events: CycleEvent[], today: ISODate): CyclePrediction {
  const starts = [...new Set(events
    .filter((event) => event.kind === 'period-start' && !event.deletedAt)
    .map((event) => event.date))]
    .sort();

  if (starts.length === 0) {
    return {
      confidence: 'not-enough-data',
      message: "Track a period start when you're ready. We'll learn together.",
    };
  }

  let averageCycleLength = 28;
  let confidence: CyclePrediction['confidence'] = 'early-estimate';
  if (starts.length >= 2) {
    const recentStarts = starts.slice(-7);
    const lengths = recentStarts.slice(1).map((start, index) => daysBetween(recentStarts[index], start));
    const plausible = lengths.filter((length) => length >= 15 && length <= 60);
    if (plausible.length) {
      averageCycleLength = Math.round(plausible.reduce((sum, length) => sum + length, 0) / plausible.length);
      confidence = plausible.length >= 2 ? 'pattern-based' : 'early-estimate';
    }
  }

  let nextStart = addDays(starts.at(-1)!, averageCycleLength);
  while (daysBetween(today, nextStart) < -averageCycleLength) {
    nextStart = addDays(nextStart, averageCycleLength);
  }
  const daysUntil = daysBetween(today, nextStart);
  const timing = daysUntil === 0
    ? 'around today'
    : daysUntil > 0
      ? `in about ${daysUntil} day${daysUntil === 1 ? '' : 's'}`
      : `about ${Math.abs(daysUntil)} day${Math.abs(daysUntil) === 1 ? '' : 's'} later than the estimate`;

  return {
    nextStart,
    daysUntil,
    averageCycleLength,
    confidence,
    message: `Your next bloom may be ${timing}.`,
  };
}

export function periodDaysForMonth(events: CycleEvent[], year: number, month: number): Set<number> {
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  return new Set(events
    .filter((event) => !event.deletedAt && event.kind !== 'not-on-period' && event.date.startsWith(prefix))
    .map((event) => Number(event.date.slice(-2))));
}
