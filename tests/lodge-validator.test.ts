import { describe, expect, it } from 'vitest';
import { createRun } from '@/games/lodge/engine/generate';
import { validateRun } from '@/games/lodge/engine/validator';

describe('validateRun', () => {
  it('passes for many generated seeds and difficulties', () => {
    for (const difficulty of ['gentle', 'standard', 'devious'] as const) {
      for (let seed = 0; seed < 40; seed++) {
        expect(validateRun(createRun(seed, { difficulty }))).toEqual([]);
      }
    }
  });

  it('flags a broken asymmetry invariant', () => {
    const run = createRun(5);
    run.puzzles[0] = { ...run.puzzles[0], clueOwner: run.puzzles[0].lockOwner };
    expect(validateRun(run).some((m) => m.includes('asymmetry'))).toBe(true);
  });

  it('flags a duplicate puzzle id', () => {
    const run = createRun(5);
    run.puzzles[1] = { ...run.puzzles[1], id: run.puzzles[0].id };
    expect(validateRun(run).some((m) => m.includes('duplicate'))).toBe(true);
  });
});
