import { describe, expect, it } from 'vitest';
import {
  createRun, validateRun, initRunState, applyEvent, hashState, ARCHETYPES,
} from '@/games/lodge/engine';
import type { RunState } from '@/games/lodge/engine';

describe('lodge engine (public API)', () => {
  it('a generated run is valid and fully solvable end-to-end', () => {
    const run = createRun(2026);
    expect(validateRun(run)).toEqual([]);

    let state: RunState = initRunState(run);
    let seq = 0;
    for (const p of run.puzzles) {
      const live = state.run.puzzles.find((x) => x.id === p.id)!;
      for (const ev of ARCHETYPES[p.archetypeId].solutionEvents(live)) {
        state = applyEvent(state, { seq: ++seq, puzzleId: p.id, by: p.lockOwner, event: ev });
      }
    }
    expect(state.escaped).toBe(true);
  });

  it('two clients on the same seed + event stream converge by hash', () => {
    const seed = 99;
    const runA = createRun(seed);
    const runB = createRun(seed);
    let a = initRunState(runA);
    let b = initRunState(runB);

    const stream = [] as Parameters<typeof applyEvent>[1][];
    let seq = 0;
    for (const p of runA.puzzles) {
      const live = a.run.puzzles.find((x) => x.id === p.id)!;
      for (const ev of ARCHETYPES[p.archetypeId].solutionEvents(live)) {
        stream.push({ seq: ++seq, puzzleId: p.id, by: p.lockOwner, event: ev });
        a = applyEvent(a, stream[stream.length - 1]);
      }
    }
    for (const ev of stream) b = applyEvent(b, ev);

    expect(hashState(a)).toBe(hashState(b));
    expect(a.escaped && b.escaped).toBe(true);
  });
});
