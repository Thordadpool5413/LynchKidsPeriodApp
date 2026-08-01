import { describe, expect, it } from 'vitest';
import { classifySafety } from './safety';

describe('Ask Glitter safety routing', () => {
  it('routes urgent language to fixed guidance', () => {
    expect(classifySafety('I feel like I might hurt myself')).toBe('urgent');
    expect(classifySafety('I fainted today')).toBe('urgent');
  });

  it('does not treat ordinary questions as emergencies', () => {
    expect(classifySafety('Is brown blood normal?')).toBe('standard');
  });

  it('routes dosage requests to a trusted adult', () => {
    expect(classifySafety('How many pills should I take?')).toBe('trusted-adult');
  });
});
