import { describe, expect, it } from 'vitest';
import { makeRng } from '@/games/lodge/engine/seed';
import { dialArchetype } from '@/games/lodge/engine/archetypes/dial';
import type { PuzzleInstance } from '@/games/lodge/engine/types';

function instance(seed: number): PuzzleInstance {
  const gen = dialArchetype.generate(makeRng(seed), 'standard');
  return { ...gen, id: 'p0', solved: false };
}

describe('dialArchetype', () => {
  it('generate is deterministic', () => {
    expect(dialArchetype.generate(makeRng(5), 'standard'))
      .toEqual(dialArchetype.generate(makeRng(5), 'standard'));
  });

  it('lock and clue owners are distinct, with matching views', () => {
    const g = dialArchetype.generate(makeRng(1), 'standard');
    expect(g.clueOwner).not.toBe(g.lockOwner);
    expect(g.views[g.lockOwner].kind).toBe('dial');
    expect(g.views[g.clueOwner].kind).toBe('legend');
  });

  it('canonical solutionEvents solve the puzzle', () => {
    const inst = instance(13);
    let cur = inst;
    for (const ev of dialArchetype.solutionEvents(inst)) cur = dialArchetype.reduce(cur, ev);
    expect(dialArchetype.isSolved(cur)).toBe(true);
  });

  it('wrong sequence is not solved', () => {
    const inst = instance(13);
    const cur = dialArchetype.reduce(
      dialArchetype.reduce(inst, { type: 'dial.set', value: 999 }),
      { type: 'dial.commit' },
    );
    expect(dialArchetype.isSolved(cur)).toBe(false);
  });

  it('dial.clear resets entered progress', () => {
    const inst = instance(13);
    const a = dialArchetype.reduce(inst, { type: 'dial.set', value: 0 });
    const b = dialArchetype.reduce(a, { type: 'dial.commit' });
    const c = dialArchetype.reduce(b, { type: 'dial.clear' });
    expect(c.state).toEqual({ kind: 'dial', pos: 0, entered: [] });
  });
});
