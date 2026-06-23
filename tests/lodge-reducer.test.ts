import { describe, expect, it } from 'vitest';
import { createRun } from '@/games/lodge/engine/generate';
import { initRunState, applyEvent, hashState } from '@/games/lodge/engine/reducer';
import { ARCHETYPES } from '@/games/lodge/engine/archetypes';
import type { RunState } from '@/games/lodge/engine/types';

function solveAll(run = createRun(123)): RunState {
  let state = initRunState(run);
  let seq = 0;
  for (const p of run.puzzles) {
    const live = state.run.puzzles.find((x) => x.id === p.id)!;
    for (const ev of ARCHETYPES[p.archetypeId].solutionEvents(live)) {
      state = applyEvent(state, { seq: ++seq, puzzleId: p.id, by: p.lockOwner, event: ev });
    }
  }
  return state;
}

describe('reducer', () => {
  it('initRunState starts fresh', () => {
    const s = initRunState(createRun(1));
    expect(s).toMatchObject({ cursor: 0, solvedCount: 0, escaped: false, seq: 0 });
  });

  it('threading every solution escapes the run', () => {
    const s = solveAll();
    expect(s.solvedCount).toBe(3);
    expect(s.escaped).toBe(true);
    expect(s.cursor).toBe(3);
  });

  it('updates seq even for an unknown puzzle id', () => {
    const s = initRunState(createRun(1));
    const next = applyEvent(s, { seq: 9, puzzleId: 'nope', by: 'A', event: { type: 'dial.clear' } });
    expect(next.seq).toBe(9);
    expect(next.solvedCount).toBe(0);
  });

  it('hashState is deterministic and changes as state advances', () => {
    const s0 = initRunState(createRun(123));
    const s1 = solveAll();
    expect(hashState(s0)).toBe(hashState(initRunState(createRun(123))));
    expect(hashState(s1)).not.toBe(hashState(s0));
  });
});
