import type {
  Archetype, GeneratedPuzzle, PuzzleEvent, PuzzleInstance, RoomView, Role,
} from '../types';
import { DIFFICULTY } from '../types';
import { shuffle } from '../seed';
import { chooseOwners, normEdge, edgeSetEq } from '../util';

const NODES = 6;

export const constellationArchetype: Archetype = {
  id: 'constellation',

  generate(rng, difficulty): GeneratedPuzzle {
    const { starEdges } = DIFFICULTY[difficulty];
    const { clueOwner, lockOwner } = chooseOwners(rng);

    const all: [number, number][] = [];
    for (let i = 0; i < NODES; i++) {
      for (let j = i + 1; j < NODES; j++) all.push([i, j]);
    }
    const edges = shuffle(rng, all).slice(0, starEdges);

    const views = {} as Record<Role, RoomView>;
    views[clueOwner] = { kind: 'starmap', nodes: NODES, edges };
    views[lockOwner] = { kind: 'constellation', nodes: NODES };

    return {
      archetypeId: 'constellation',
      clueOwner,
      lockOwner,
      views,
      solution: { kind: 'constellation', edges },
      state: { kind: 'constellation', edges: [] },
    };
  },

  reduce(inst, ev): PuzzleInstance {
    if (inst.state.kind !== 'constellation') return inst;
    if (ev.type !== 'constellation.toggle') return inst;
    const e = normEdge(ev.a, ev.b);
    const has = inst.state.edges.some((x) => x[0] === e[0] && x[1] === e[1]);
    const edges = has
      ? inst.state.edges.filter((x) => !(x[0] === e[0] && x[1] === e[1]))
      : [...inst.state.edges, e];
    return { ...inst, state: { kind: 'constellation', edges } };
  },

  isSolved(inst): boolean {
    if (inst.solution.kind !== 'constellation' || inst.state.kind !== 'constellation') return false;
    return edgeSetEq(inst.state.edges, inst.solution.edges);
  },

  solutionEvents(inst): PuzzleEvent[] {
    if (inst.solution.kind !== 'constellation') return [];
    return inst.solution.edges.map((e) => ({ type: 'constellation.toggle', a: e[0], b: e[1] }));
  },
};
