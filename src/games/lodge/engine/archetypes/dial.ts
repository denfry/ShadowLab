import type {
  Archetype, GeneratedPuzzle, PuzzleEvent, PuzzleInstance, RoomView, Role,
} from '../types';
import { SYMBOLS, DIFFICULTY } from '../types';
import { shuffle, randInt } from '../seed';
import { arrEq, chooseOwners } from '../util';

export const dialArchetype: Archetype = {
  id: 'dial',

  generate(rng, difficulty): GeneratedPuzzle {
    const { dialLen } = DIFFICULTY[difficulty];
    const { clueOwner, lockOwner } = chooseOwners(rng);

    const ringSize = Math.max(dialLen + 2, 5);
    const ring = shuffle(rng, SYMBOLS).slice(0, ringSize);

    const digits = shuffle(rng, ring.map((_, i) => i));
    const legend: Record<string, number> = {};
    ring.forEach((s, i) => { legend[s] = digits[i]; });

    const positions: number[] = [];
    for (let k = 0; k < dialLen; k++) positions.push(randInt(rng, ring.length));
    const target = positions.map((pos) => legend[ring[pos]]);

    const views = {} as Record<Role, RoomView>;
    views[lockOwner] = { kind: 'dial', ring };
    views[clueOwner] = { kind: 'legend', legend, target };

    return {
      archetypeId: 'dial',
      clueOwner,
      lockOwner,
      views,
      solution: { kind: 'dial', positions },
      state: { kind: 'dial', pos: 0, entered: [] },
    };
  },

  reduce(inst, ev): PuzzleInstance {
    if (inst.state.kind !== 'dial') return inst;
    const st = inst.state;
    if (ev.type === 'dial.set') return { ...inst, state: { ...st, pos: ev.value } };
    if (ev.type === 'dial.commit') return { ...inst, state: { ...st, entered: [...st.entered, st.pos] } };
    if (ev.type === 'dial.clear') return { ...inst, state: { kind: 'dial', pos: 0, entered: [] } };
    return inst;
  },

  isSolved(inst): boolean {
    if (inst.solution.kind !== 'dial' || inst.state.kind !== 'dial') return false;
    return arrEq(inst.state.entered, inst.solution.positions);
  },

  solutionEvents(inst): PuzzleEvent[] {
    if (inst.solution.kind !== 'dial') return [];
    const evs: PuzzleEvent[] = [];
    for (const pos of inst.solution.positions) {
      evs.push({ type: 'dial.set', value: pos });
      evs.push({ type: 'dial.commit' });
    }
    return evs;
  },
};
