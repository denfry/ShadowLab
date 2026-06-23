import { create } from 'zustand';
import {
  createRun,
  initRunState,
  applyEvent,
  ARCHETYPES,
  type RunState,
  type Difficulty,
  type Role,
  type PuzzleEvent,
} from '@/games/lodge/engine';

export interface LodgeStore {
  runState: RunState;
  seed: number;
  difficulty: Difficulty;
  selectedPuzzleId: string | null;
  regenerate: (seed: number, difficulty: Difficulty) => void;
  select: (puzzleId: string | null) => void;
  dispatch: (puzzleId: string, by: Role, event: PuzzleEvent) => void;
  autoSolve: (puzzleId: string) => void;
}

const DEFAULT_SEED = 1;
const DEFAULT_DIFFICULTY: Difficulty = 'standard';

function freshState(seed: number, difficulty: Difficulty): RunState {
  return initRunState(createRun(seed, { difficulty }));
}

const INITIAL = freshState(DEFAULT_SEED, DEFAULT_DIFFICULTY);

export const useLodgeStore = create<LodgeStore>((set, get) => ({
  runState: INITIAL,
  seed: DEFAULT_SEED,
  difficulty: DEFAULT_DIFFICULTY,
  selectedPuzzleId: INITIAL.run.puzzles[0]?.id ?? null,

  regenerate(seed, difficulty) {
    const runState = freshState(seed, difficulty);
    set({ runState, seed, difficulty, selectedPuzzleId: runState.run.puzzles[0]?.id ?? null });
  },

  select(puzzleId) {
    set({ selectedPuzzleId: puzzleId });
  },

  dispatch(puzzleId, by, event) {
    const { runState } = get();
    set({ runState: applyEvent(runState, { seq: runState.seq + 1, puzzleId, by, event }) });
  },

  autoSolve(puzzleId) {
    const puzzle = get().runState.run.puzzles.find((p) => p.id === puzzleId);
    if (!puzzle) return;
    for (const ev of ARCHETYPES[puzzle.archetypeId].solutionEvents(puzzle)) {
      get().dispatch(puzzleId, puzzle.lockOwner, ev);
    }
  },
}));
