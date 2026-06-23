import { Rng } from '@/core/utils/rng';
import type { Station, GameState, CrewMemberState, Observation, NPC } from './types';
import { PLAYER_ID } from './types';

export const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));

export function createGameState(station: Station, seed: number, objectiveId?: string): GameState {
  const rng = new Rng(seed);
  const objId = objectiveId ?? rng.pick(station.objectives).id;
  const ids = [...station.crew.map((c) => c.id), PLAYER_ID];
  const crew: CrewMemberState[] = station.crew.map((npc) => {
    const suspicion: Record<string, number> = {};
    for (const id of ids) if (id !== npc.id) suspicion[id] = station.startSuspicion;
    return { npcId: npc.id, alive: true, suspicion, observations: [] };
  });
  return {
    station,
    day: 1,
    slot: 0,
    phase: 'plan',
    crew,
    player: { composure: 100, objectiveProgress: [], alibis: [], notebook: [] },
    anomalies: [],
    objectiveId: objId,
    seed,
    rngState: rng.seed,
  };
}

export function cloneCrew(crew: CrewMemberState[]): CrewMemberState[] {
  return crew.map((c) => ({
    npcId: c.npcId,
    alive: c.alive,
    suspicion: { ...c.suspicion },
    observations: [...c.observations],
  }));
}

export function adjustSuspicion(
  crew: CrewMemberState[],
  holderId: string,
  subjectId: string,
  delta: number,
): void {
  const holder = crew.find((c) => c.npcId === holderId);
  if (!holder || holderId === subjectId) return;
  holder.suspicion[subjectId] = clamp((holder.suspicion[subjectId] ?? 0) + delta, 0, 100);
}

export function addObservation(crew: CrewMemberState[], holderId: string, obs: Observation): void {
  const holder = crew.find((c) => c.npcId === holderId);
  if (holder) holder.observations.push(obs);
}

export const isAlive = (crew: CrewMemberState[], npcId: string): boolean =>
  crew.find((c) => c.npcId === npcId)?.alive ?? false;

export function topSuspect(
  cState: CrewMemberState,
  selfId: string,
): { subjectId: string; value: number } | null {
  let best: { subjectId: string; value: number } | null = null;
  for (const [subjectId, value] of Object.entries(cState.suspicion)) {
    if (subjectId === selfId) continue;
    if (!best || value > best.value) best = { subjectId, value };
  }
  return best;
}

export const livingNpcs = (station: Station, crew: CrewMemberState[]): NPC[] =>
  station.crew.filter((n) => isAlive(crew, n.id));
