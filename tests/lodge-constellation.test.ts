import { describe, expect, it } from 'vitest';
import { makeRng } from '@/games/lodge/engine/seed';
import { constellationArchetype as arch } from '@/games/lodge/engine/archetypes/constellation';
import type { PuzzleInstance } from '@/games/lodge/engine/types';

function instance(seed: number): PuzzleInstance {
  const gen = arch.generate(makeRng(seed), 'standard');
  return { ...gen, id: 'p0', solved: false };
}

describe('constellationArchetype', () => {
  it('generate is deterministic', () => {
    expect(arch.generate(makeRng(2), 'standard')).toEqual(arch.generate(makeRng(2), 'standard'));
  });

  it('clue holder sees starmap, lock holder sees board, owners distinct', () => {
    const g = arch.generate(makeRng(4), 'standard');
    expect(g.clueOwner).not.toBe(g.lockOwner);
    expect(g.views[g.clueOwner].kind).toBe('starmap');
    expect(g.views[g.lockOwner].kind).toBe('constellation');
  });

  it('canonical solutionEvents solve the puzzle', () => {
    const inst = instance(21);
    let cur = inst;
    for (const ev of arch.solutionEvents(inst)) cur = arch.reduce(cur, ev);
    expect(arch.isSolved(cur)).toBe(true);
  });

  it('toggling an edge twice removes it (not solved)', () => {
    const inst = instance(21);
    const evs = arch.solutionEvents(inst);
    let cur = inst;
    for (const ev of evs) cur = arch.reduce(cur, ev);
    cur = arch.reduce(cur, evs[0]); // toggle first solution edge off again
    expect(arch.isSolved(cur)).toBe(false);
  });
});
