import type { Station, GameState } from './types';
import { cloneCrew, adjustSuspicion, isAlive, topSuspect } from './state';

/** One bounded round of rumour spread across positive social bonds. Deterministic. */
export function gossipPhase(station: Station, state: GameState): GameState {
  const crew = cloneCrew(state.crew);
  for (const speaker of station.crew) {
    if (!isAlive(crew, speaker.id)) continue;
    const sState = crew.find((c) => c.npcId === speaker.id)!;
    const top = topSuspect(sState, speaker.id);
    if (!top || top.value <= station.startSuspicion) continue;
    for (const rel of speaker.relationships) {
      if (rel.bond <= 0) continue;
      if (rel.npcId === top.subjectId) continue;
      if (!isAlive(crew, rel.npcId)) continue;
      const listener = station.crew.find((n) => n.id === rel.npcId);
      if (!listener) continue;
      const trustW = rel.bond / 100;
      const traitW = listener.traits.includes('trusting') ? 0.5 : listener.traits.includes('sharp') ? 1.5 : 1;
      adjustSuspicion(crew, listener.id, top.subjectId, station.tuning.gossipStrength * trustW * traitW);
    }
  }
  return { ...state, crew };
}
