import { describe, expect, it } from 'vitest';
import { shouldAcceptMutation } from './sync';

describe('deterministic sync conflict resolution', () => {
  const current = { updatedAt: new Date('2026-08-01T12:00:00.000Z'), revisionKey: 'mutation-b' };

  it('accepts a newer client timestamp', () => expect(shouldAcceptMutation(current, { updatedAt: new Date('2026-08-01T12:00:01.000Z'), revisionKey: 'mutation-a' })).toBe(true));
  it('rejects an older client timestamp', () => expect(shouldAcceptMutation(current, { updatedAt: new Date('2026-08-01T11:59:59.000Z'), revisionKey: 'mutation-z' })).toBe(false));
  it('uses the stable revision key to break timestamp ties', () => {
    expect(shouldAcceptMutation(current, { updatedAt: current.updatedAt, revisionKey: 'mutation-c' })).toBe(true);
    expect(shouldAcceptMutation(current, { updatedAt: current.updatedAt, revisionKey: 'mutation-a' })).toBe(false);
  });
});
