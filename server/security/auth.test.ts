import { describe, expect, it } from 'vitest';
import { createSessionToken, verifySessionToken } from './auth';

describe('session tokens', () => {
  it('round trips signed parent claims', () => {
    const token = createSessionToken({ subject: 'parent-1', role: 'parent', sessionId: 'session-1' });
    expect(verifySessionToken(token)).toMatchObject({ subject: 'parent-1', role: 'parent', sessionId: 'session-1' });
  });

  it('rejects a modified signature', () => {
    const token = createSessionToken({ subject: 'child-1', role: 'child', childId: 'child-1' });
    const [payload, signature] = token.split('.');
    const replacement = signature[0] === 'a' ? 'b' : 'a';
    expect(verifySessionToken(`${payload}.${replacement}${signature.slice(1)}`)).toBeNull();
  });

  it('rejects expired tokens', () => {
    const token = createSessionToken({ subject: 'parent-1', role: 'parent' }, -1);
    expect(verifySessionToken(token)).toBeNull();
  });
});
