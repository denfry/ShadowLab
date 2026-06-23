import { describe, expect, it } from 'vitest';
import { makeRng } from '@/games/lodge/engine/seed';
import { ARCHETYPES, ARCHETYPE_IDS } from '@/games/lodge/engine/archetypes';

describe('archetype registry', () => {
  it('contains the three stage-0 archetypes, each keyed by its id', () => {
    expect(ARCHETYPE_IDS.sort()).toEqual(['candle', 'constellation', 'dial']);
    for (const id of ARCHETYPE_IDS) expect(ARCHETYPES[id].id).toBe(id);
  });

  it('every archetype round-trips: generate → solutionEvents → solved', () => {
    for (const id of ARCHETYPE_IDS) {
      const arch = ARCHETYPES[id];
      for (let seed = 0; seed < 30; seed++) {
        const gen = arch.generate(makeRng(seed), 'standard');
        const inst = { ...gen, id: 'p0', solved: false };
        let cur = inst;
        for (const ev of arch.solutionEvents(inst)) cur = arch.reduce(cur, ev);
        expect(arch.isSolved(cur)).toBe(true);
        expect(gen.clueOwner).not.toBe(gen.lockOwner);
      }
    }
  });
});
