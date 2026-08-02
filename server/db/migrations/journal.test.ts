import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type Journal = {
  entries: Array<{ idx: number; tag: string; when: number }>;
};

describe('migration journal', () => {
  it('keeps migration timestamps strictly increasing', () => {
    const journal = JSON.parse(
      readFileSync(resolve('server/db/migrations/meta/_journal.json'), 'utf8'),
    ) as Journal;

    for (let index = 1; index < journal.entries.length; index += 1) {
      const previous = journal.entries[index - 1];
      const current = journal.entries[index];
      expect(
        current.when,
        `${current.tag} must be newer than ${previous.tag}`,
      ).toBeGreaterThan(previous.when);
    }
  });
});
