import { makeRng, shuffle } from './seed';
import { ARCHETYPES, ARCHETYPE_IDS } from './archetypes';
import type { Run, Difficulty, PuzzleInstance } from './types';

export interface RunConfig {
  difficulty?: Difficulty;
  archetypeIds?: string[];
}

export function createRun(seed: number, config: RunConfig = {}): Run {
  const difficulty = config.difficulty ?? 'standard';
  const rng = makeRng(seed);
  const ids = config.archetypeIds ?? shuffle(rng, ARCHETYPE_IDS);

  const puzzles: PuzzleInstance[] = ids.map((aid, i) => {
    const gen = ARCHETYPES[aid].generate(rng, difficulty);
    return { ...gen, id: `p${i}`, solved: false };
  });

  return { seed, difficulty, puzzles };
}
