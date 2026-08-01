import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, predictNextPeriod } from './cycle';
import type { CycleEvent, ISODate } from './types';

const event = (date: ISODate): CycleEvent => ({
  id: date,
  childProfileId: 'child',
  date,
  kind: 'period-start',
  symptoms: [],
  createdAt: `${date}T12:00:00Z`,
  updatedAt: `${date}T12:00:00Z`,
});

describe('cycle estimates', () => {
  it('handles leap days in UTC', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
  });

  it('does not guess before a period is tracked', () => {
    expect(predictNextPeriod([], '2026-07-31').confidence).toBe('not-enough-data');
  });

  it('uses recent plausible cycle lengths', () => {
    const result = predictNextPeriod([event('2026-05-01'), event('2026-05-30'), event('2026-06-28')], '2026-07-20');
    expect(result.averageCycleLength).toBe(29);
    expect(result.nextStart).toBe('2026-07-27');
    expect(result.confidence).toBe('pattern-based');
  });
});
