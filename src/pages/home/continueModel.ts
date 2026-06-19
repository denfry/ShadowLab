import type { GameDefinition } from '@/types/game-module';
import type { GameSave } from '@/types/save';

export interface ContinueEntry {
  def: GameDefinition;
  save: GameSave;
}

/** The most-recently-updated save across the given games, or null if none have a save. */
export function pickContinue(
  games: GameDefinition[],
  lastSaveOf: (id: string) => GameSave | null,
): ContinueEntry | null {
  let best: ContinueEntry | null = null;
  for (const def of games) {
    const save = lastSaveOf(def.id);
    if (save && (!best || save.updatedAt > best.save.updatedAt)) best = { def, save };
  }
  return best;
}
