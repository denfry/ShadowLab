import { describe, expect, it, beforeEach } from 'vitest';
import { useLodgeStore } from '@/games/lodge/ui/store/useLodgeStore';
import { createRun, initRunState } from '@/games/lodge/engine';

beforeEach(() => useLodgeStore.getState().regenerate(5, 'standard'));

describe('store net seam', () => {
  it('applyServerEvent applies a host-ordered event and advances seq', () => {
    const before = useLodgeStore.getState().runState.seq;
    useLodgeStore.getState().applyServerEvent({ seq: before + 1, puzzleId: 'p0', by: 'A', event: { type: 'dial.clear' } });
    expect(useLodgeStore.getState().runState.seq).toBe(before + 1);
  });

  it('setRunState replaces state and selects the first puzzle', () => {
    const fresh = initRunState(createRun(999, { difficulty: 'gentle' }));
    useLodgeStore.getState().setRunState(fresh);
    expect(useLodgeStore.getState().runState.run.seed).toBe(999);
    expect(useLodgeStore.getState().selectedPuzzleId).toBe('p0');
  });
});
