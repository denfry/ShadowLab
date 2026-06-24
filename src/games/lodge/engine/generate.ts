import { makeRng, shuffle } from './seed';
import { ARCHETYPES, ARCHETYPE_IDS } from './archetypes';
import type { Run, Difficulty, PuzzleInstance, Role } from './types';

export interface RunConfig {
  difficulty?: Difficulty;
  archetypeIds?: string[];
}

const other = (role: Role): Role => (role === 'A' ? 'B' : 'A');

/** Re-assign a puzzle to the opposite roles (swap clue/lock owners and the
 *  two role-keyed views). Solution/state are role-agnostic and untouched, so
 *  the puzzle's logic — and the `lock !== clue` invariant — are preserved. */
function flipPuzzleRoles(p: PuzzleInstance): PuzzleInstance {
  return {
    ...p,
    clueOwner: other(p.clueOwner),
    lockOwner: other(p.lockOwner),
    views: { A: p.views.B, B: p.views.A },
  };
}

/** Guarantee both roles own at least one lock puzzle. If every puzzle shares the
 *  same lockOwner (a lopsided run), flip the first puzzle. Deterministic. */
function balanceLockOwners(puzzles: PuzzleInstance[]): PuzzleInstance[] {
  if (puzzles.length < 2) return puzzles;
  if (new Set(puzzles.map((p) => p.lockOwner)).size > 1) return puzzles;
  return puzzles.map((p, i) => (i === 0 ? flipPuzzleRoles(p) : p));
}

export function createRun(seed: number, config: RunConfig = {}): Run {
  const difficulty = config.difficulty ?? 'standard';
  const rng = makeRng(seed);
  const ids = config.archetypeIds ?? shuffle(rng, ARCHETYPE_IDS);

  const raw: PuzzleInstance[] = ids.map((aid, i) => {
    const gen = ARCHETYPES[aid].generate(rng, difficulty);
    return { ...gen, id: `p${i}`, solved: false };
  });

  return { seed, difficulty, puzzles: balanceLockOwners(raw) };
}
