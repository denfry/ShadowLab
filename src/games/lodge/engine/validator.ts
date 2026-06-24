import { ARCHETYPES } from './archetypes';
import { initRunState, applyEvent } from './reducer';
import type { Run } from './types';

export function validateRun(run: Run): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();

  for (const p of run.puzzles) {
    if (seen.has(p.id)) problems.push(`duplicate puzzle id: ${p.id}`);
    seen.add(p.id);
    if (p.clueOwner === p.lockOwner) {
      problems.push(`${p.id}: asymmetry broken — clueOwner === lockOwner`);
    }
    if (!ARCHETYPES[p.archetypeId]) {
      problems.push(`${p.id}: unknown archetype ${p.archetypeId}`);
    }
  }

  let state = initRunState(run);
  let seq = 0;
  for (const p of run.puzzles) {
    const arch = ARCHETYPES[p.archetypeId];
    if (!arch) continue;
    const live = state.run.puzzles.find((x) => x.id === p.id)!;
    for (const ev of arch.solutionEvents(live)) {
      state = applyEvent(state, { seq: ++seq, puzzleId: p.id, by: p.lockOwner, event: ev });
    }
    const after = state.run.puzzles.find((x) => x.id === p.id)!;
    if (!after.solved) problems.push(`${p.id}: canonical solution did not solve the puzzle`);
  }
  if (!state.escaped) problems.push('run not completable: escape never reached');

  return problems;
}
