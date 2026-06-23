import { describe, expect, it } from 'vitest';
import { makeRng } from '@/games/lodge/engine/seed';
import { candleArchetype as arch } from '@/games/lodge/engine/archetypes/candle';
import type { PuzzleInstance } from '@/games/lodge/engine/types';

function instance(seed: number): PuzzleInstance {
  const gen = arch.generate(makeRng(seed), 'standard');
  return { ...gen, id: 'p0', solved: false };
}

describe('candleArchetype', () => {
  it('generate is deterministic', () => {
    expect(arch.generate(makeRng(8), 'standard')).toEqual(arch.generate(makeRng(8), 'standard'));
  });

  it('clue holder reads verse, lock holder holds candelabra, owners distinct', () => {
    const g = arch.generate(makeRng(6), 'standard');
    expect(g.clueOwner).not.toBe(g.lockOwner);
    expect(g.views[g.clueOwner].kind).toBe('verse');
    expect(g.views[g.lockOwner].kind).toBe('candelabra');
  });

  it('lighting in the verse order solves it', () => {
    const inst = instance(33);
    let cur = inst;
    for (const ev of arch.solutionEvents(inst)) cur = arch.reduce(cur, ev);
    expect(arch.isSolved(cur)).toBe(true);
  });

  it('candle.reset clears progress', () => {
    const inst = instance(33);
    const a = arch.reduce(inst, { type: 'candle.light', index: 0 });
    const b = arch.reduce(a, { type: 'candle.reset' });
    expect(b.state).toEqual({ kind: 'candle', lit: [] });
  });
});
