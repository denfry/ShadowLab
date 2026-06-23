import { describe, expect, it } from 'vitest';
import { createRun, validateRun } from '@/games/lodge/engine';

describe('createRun role balance', () => {
  it('is deterministic', () => {
    expect(createRun(2026)).toEqual(createRun(2026));
  });

  it('gives both roles at least one lock puzzle across many seeds', () => {
    for (let seed = 0; seed < 60; seed++) {
      const owners = new Set(createRun(seed).puzzles.map((p) => p.lockOwner));
      expect(owners.has('A')).toBe(true);
      expect(owners.has('B')).toBe(true);
    }
  });

  it('seed 2026 (previously all-B) is balanced, still valid, still asymmetric', () => {
    const run = createRun(2026);
    expect(new Set(run.puzzles.map((p) => p.lockOwner)).size).toBe(2);
    expect(validateRun(run)).toEqual([]);
    for (const p of run.puzzles) expect(p.clueOwner).not.toBe(p.lockOwner);
  });
});
