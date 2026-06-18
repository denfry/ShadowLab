import { Rng } from '@/core/utils/rng';
import type { Station, GameState, PlayerAction, Anomaly, NotebookEntry, ObjectiveStep } from './types';
import { EXPOSURE_FACTOR, PLAYER_ID } from './types';
import { clamp, cloneCrew, adjustSuspicion, addObservation } from './state';
import { placeCrew, playerLocationOf } from './placement';

const exposureOf = (station: Station, locId: string) =>
  station.locations.find((l) => l.id === locId)?.exposure ?? 'public';

function learnRoutine(notebook: NotebookEntry[], npcId: string, slot: number): NotebookEntry[] {
  const existing = notebook.find((n) => n.npcId === npcId);
  if (existing) {
    return existing.learnedSlots.includes(slot)
      ? notebook
      : notebook.map((n) => (n.npcId === npcId ? { ...n, learnedSlots: [...n.learnedSlots, slot] } : n));
  }
  return [...notebook, { npcId, learnedSlots: [slot] }];
}

function discoverable(npcTraits: readonly string[], anomaly: Anomaly): boolean {
  const need = anomaly.discoverableBy ?? 'any';
  if (need === 'any') return true;
  return npcTraits.includes(need);
}

export function resolveSlot(station: Station, state: GameState, action: PlayerAction): GameState {
  const rng = new Rng(state.rngState);
  const t = station.tuning;
  const placement = placeCrew(station, state.slot, rng);
  const playerLoc = playerLocationOf(action, station, placement) ?? station.locations[0].id;
  const witnessIds = station.crew
    .filter((n) => placement[n.id] === playerLoc && state.crew.find((c) => c.npcId === n.id)?.alive)
    .map((n) => n.id);

  const crew = cloneCrew(state.crew);
  let player = { ...state.player };
  const anomalies: Anomaly[] = state.anomalies.map((a) => ({ ...a }));
  const npcById = (id: string) => station.crew.find((n) => n.id === id)!;

  // co-presence: witnesses register seeing the player
  for (const w of witnessIds) {
    addObservation(crew, w, { day: state.day, slot: state.slot, locationId: playerLoc, subjectId: PLAYER_ID, kind: 'present' });
  }

  switch (action.kind) {
    case 'blend': {
      player = { ...player, alibis: [...player.alibis, { day: state.day, slot: state.slot, locationId: playerLoc, witnessIds }] };
      for (const w of witnessIds) adjustSuspicion(crew, w, PLAYER_ID, -t.suspicionGain);
      player = { ...player, composure: clamp(player.composure + t.composureRegen, 0, 100) };
      break;
    }
    case 'objective': {
      let step: ObjectiveStep | undefined;
      for (const obj of station.objectives) {
        const found = obj.steps.find((s) => s.id === action.stepId);
        if (found) step = found;
      }
      if (step) {
        const sev = step.leavesTrace?.severity ?? 1;
        const factor = EXPOSURE_FACTOR[exposureOf(station, playerLoc)];
        const watch = witnessIds.length ? Math.max(...witnessIds.map((w) => npcById(w).watchfulness)) : 0;
        const pDetect = clamp(step.baseRisk * t.detectionMult * factor * watch, 0, 1);
        const detected = witnessIds.length > 0 && rng.chance(pDetect);
        anomalies.push({
          id: `a_${state.day}_${state.slot}`,
          fromStepId: step.id,
          locationId: playerLoc,
          day: state.day,
          slot: state.slot,
          severity: sev,
          discoveredBy: detected ? witnessIds[0] : undefined,
        });
        if (detected) {
          for (const w of witnessIds) {
            adjustSuspicion(crew, w, PLAYER_ID, t.suspicionGain * sev);
            addObservation(crew, w, { day: state.day, slot: state.slot, locationId: playerLoc, subjectId: PLAYER_ID, kind: 'odd_action' });
          }
        }
        player = {
          ...player,
          objectiveProgress: [...player.objectiveProgress, step.id],
          composure: clamp(player.composure - t.composureCost, 0, 100),
        };
      }
      break;
    }
    case 'talk': {
      const target = npcById(action.npcId);
      if (action.tack === 'reassure') {
        adjustSuspicion(crew, action.npcId, PLAYER_ID, -t.suspicionGain * 1.5);
      } else if (action.tack === 'seed' && action.targetId) {
        if (target.traits.includes('sharp')) adjustSuspicion(crew, action.npcId, PLAYER_ID, t.suspicionGain);
        else adjustSuspicion(crew, action.npcId, action.targetId, t.suspicionGain * 1.5);
        player = { ...player, composure: clamp(player.composure - t.composureCost, 0, 100) };
      } else if (action.tack === 'fish') {
        player = { ...player, notebook: learnRoutine(player.notebook, action.npcId, state.slot) };
      }
      player = { ...player, alibis: [...player.alibis, { day: state.day, slot: state.slot, locationId: playerLoc, witnessIds: [action.npcId] }] };
      break;
    }
    case 'observe': {
      if (action.mode === 'routine' && action.targetId) {
        player = { ...player, notebook: learnRoutine(player.notebook, action.targetId, state.slot) };
      } else if (action.mode === 'plant' && action.targetId) {
        anomalies.push({ id: `a_plant_${state.day}_${state.slot}`, locationId: playerLoc, day: state.day, slot: state.slot, severity: 1, plantedAgainst: action.targetId });
      }
      if (exposureOf(station, playerLoc) === 'private' && witnessIds.length > 0) {
        for (const w of witnessIds) adjustSuspicion(crew, w, PLAYER_ID, t.suspicionGain * 0.5);
      }
      break;
    }
  }

  // discovery of still-undiscovered anomalies by a watchful crew member present at the location
  for (const an of anomalies) {
    if (an.discoveredBy) continue;
    const finder = station.crew.find(
      (n) => placement[n.id] === an.locationId && n.watchfulness >= 0.5 && discoverable(n.traits, an),
    );
    if (finder) {
      an.discoveredBy = finder.id;
      const subject = an.plantedAgainst ?? PLAYER_ID;
      adjustSuspicion(crew, finder.id, subject, t.suspicionGain * an.severity);
      addObservation(crew, finder.id, { day: state.day, slot: state.slot, locationId: an.locationId, subjectId: subject, kind: 'anomaly_found' });
    }
  }

  // low composure leaks: nervous behaviour raises co-present suspicion
  if (player.composure < 30) {
    for (const w of witnessIds) adjustSuspicion(crew, w, PLAYER_ID, t.suspicionGain * 0.5);
  }

  // advance time
  let slot = state.slot + 1;
  let day = state.day;
  let phase: GameState['phase'] = 'plan';
  if (slot >= station.slotsPerDay) {
    slot = 0;
    day += 1;
    phase = 'meeting';
  }

  return { ...state, crew, player, anomalies, slot, day, phase, rngState: rng.seed };
}
