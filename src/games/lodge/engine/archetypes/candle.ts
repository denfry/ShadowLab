import type {
  Archetype, GeneratedPuzzle, PuzzleEvent, PuzzleInstance, RoomView, Role,
} from '../types';
import { DIFFICULTY } from '../types';
import { shuffle } from '../seed';
import { arrEq, chooseOwners } from '../util';

export const candleArchetype: Archetype = {
  id: 'candle',

  generate(rng, difficulty): GeneratedPuzzle {
    const { candleCount } = DIFFICULTY[difficulty];
    const { clueOwner, lockOwner } = chooseOwners(rng);
    const order = shuffle(rng, Array.from({ length: candleCount }, (_, i) => i));

    const views = {} as Record<Role, RoomView>;
    views[clueOwner] = { kind: 'verse', order };
    views[lockOwner] = { kind: 'candelabra', count: candleCount };

    return {
      archetypeId: 'candle',
      clueOwner,
      lockOwner,
      views,
      solution: { kind: 'candle', order },
      state: { kind: 'candle', lit: [] },
    };
  },

  reduce(inst, ev): PuzzleInstance {
    if (inst.state.kind !== 'candle') return inst;
    if (ev.type === 'candle.light') return { ...inst, state: { kind: 'candle', lit: [...inst.state.lit, ev.index] } };
    if (ev.type === 'candle.reset') return { ...inst, state: { kind: 'candle', lit: [] } };
    return inst;
  },

  isSolved(inst): boolean {
    if (inst.solution.kind !== 'candle' || inst.state.kind !== 'candle') return false;
    return arrEq(inst.state.lit, inst.solution.order);
  },

  solutionEvents(inst): PuzzleEvent[] {
    if (inst.solution.kind !== 'candle') return [];
    return inst.solution.order.map((i) => ({ type: 'candle.light', index: i }));
  },
};
