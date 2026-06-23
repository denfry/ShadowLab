import { ARCHETYPES } from './archetypes';
import { fnv1a } from './util';
import type { Run, RunState, LodgeEvent } from './types';

export function initRunState(run: Run): RunState {
  return { run, cursor: 0, solvedCount: 0, escaped: false, seq: 0 };
}

export function applyEvent(state: RunState, ev: LodgeEvent): RunState {
  const idx = state.run.puzzles.findIndex((p) => p.id === ev.puzzleId);
  if (idx < 0) return { ...state, seq: ev.seq };

  const puzzle = state.run.puzzles[idx];
  if (puzzle.solved) return { ...state, seq: ev.seq };

  const arch = ARCHETYPES[puzzle.archetypeId];
  const reduced = arch.reduce(puzzle, ev.event);
  const solved = arch.isSolved(reduced);
  const nextPuzzle = { ...reduced, solved };

  const puzzles = state.run.puzzles.map((p, i) => (i === idx ? nextPuzzle : p));
  const solvedCount = state.solvedCount + (solved ? 1 : 0);
  const escaped = solvedCount === puzzles.length;

  let cursor = state.cursor;
  while (cursor < puzzles.length && puzzles[cursor].solved) cursor++;

  return { run: { ...state.run, puzzles }, cursor, solvedCount, escaped, seq: ev.seq };
}

export function hashState(state: RunState): number {
  const payload = JSON.stringify({
    seq: state.seq,
    escaped: state.escaped,
    cursor: state.cursor,
    p: state.run.puzzles.map((p) => ({ id: p.id, solved: p.solved, state: p.state })),
  });
  return fnv1a(payload);
}
