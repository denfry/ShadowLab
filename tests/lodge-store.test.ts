import { describe, expect, it, beforeEach } from 'vitest';
import { useLodgeStore } from '@/games/lodge/ui/store/useLodgeStore';
import { validateRun } from '@/games/lodge/engine';

beforeEach(() => useLodgeStore.getState().regenerate(123, 'standard'));

describe('useLodgeStore', () => {
  it('regenerate yields a valid run and selects the first puzzle', () => {
    const s = useLodgeStore.getState();
    expect(validateRun(s.runState.run)).toEqual([]);
    expect(s.selectedPuzzleId).toBe('p0');
    expect(s.runState.escaped).toBe(false);
  });

  it('dispatch advances seq', () => {
    const before = useLodgeStore.getState().runState.seq;
    useLodgeStore.getState().dispatch('p0', 'A', { type: 'dial.clear' });
    expect(useLodgeStore.getState().runState.seq).toBe(before + 1);
  });

  it('autoSolve on every puzzle reaches escaped', () => {
    for (const p of useLodgeStore.getState().runState.run.puzzles) {
      useLodgeStore.getState().autoSolve(p.id);
    }
    expect(useLodgeStore.getState().runState.escaped).toBe(true);
  });
});
