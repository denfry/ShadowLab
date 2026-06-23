import { describe, expect, it } from 'vitest';
import { createRun } from '@/games/lodge/engine/generate';

describe('createRun', () => {
  it('is deterministic for a given seed', () => {
    expect(createRun(123)).toEqual(createRun(123));
  });

  it('uses every archetype once, with unique sequential ids', () => {
    const run = createRun(123);
    expect(run.puzzles.map((p) => p.id)).toEqual(['p0', 'p1', 'p2']);
    expect(new Set(run.puzzles.map((p) => p.archetypeId)).size).toBe(3);
  });

  it('respects an explicit archetype chain', () => {
    const run = createRun(1, { archetypeIds: ['candle', 'dial'] });
    expect(run.puzzles.map((p) => p.archetypeId)).toEqual(['candle', 'dial']);
  });

  it('every puzzle starts unsolved and asymmetric', () => {
    const run = createRun(77, { difficulty: 'devious' });
    for (const p of run.puzzles) {
      expect(p.solved).toBe(false);
      expect(p.clueOwner).not.toBe(p.lockOwner);
    }
    expect(run.difficulty).toBe('devious');
  });
});
