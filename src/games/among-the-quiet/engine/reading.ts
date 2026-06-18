import type { Station, GameState, Cue, Band, CrewMemberState } from './types';
import { BAND_WARY, BAND_COLD, BAND_ACCUSING, EXPOSURE_MED, EXPOSURE_HIGH, PLAYER_ID } from './types';
import { topSuspect } from './state';

export function bandFor(value: number): Band {
  if (value >= BAND_ACCUSING) return 'accusing';
  if (value >= BAND_COLD) return 'cold';
  if (value >= BAND_WARY) return 'wary';
  return 'trust';
}

export function selfExposure(state: GameState): 'low' | 'med' | 'high' {
  const max = state.crew.filter((c) => c.alive).reduce((m, c) => Math.max(m, c.suspicion[PLAYER_ID] ?? 0), 0);
  if (max >= EXPOSURE_HIGH) return 'high';
  if (max >= EXPOSURE_MED) return 'med';
  return 'low';
}

function nameOf(station: Station, id: string): string {
  if (id === PLAYER_ID) return 'Импостор';
  return station.crew.find((n) => n.id === id)?.name ?? id;
}

export function readCues(station: Station, state: GameState, npcId: string): Cue[] {
  const cState: CrewMemberState | undefined = state.crew.find((c) => c.npcId === npcId);
  if (!cState || !cState.alive) return [];
  const npc = station.crew.find((n) => n.id === npcId);
  if (!npc) return [];
  const band = bandFor(cState.suspicion[PLAYER_ID] ?? 0);
  const set = station.cueLibrary.find((cs) => cs.readStyle === npc.readStyle);
  if (!set) return [];
  const top = topSuspect(cState, npcId);
  const targetName = top ? nameOf(station, top.subjectId) : '';
  return (set.bands[band] ?? [])
    .filter((c) => !c.traitGate || npc.traits.includes(c.traitGate))
    .map((c) => ({ ...c, text: c.text.replace('{target}', targetName) }));
}
