import type { Rng } from '@/core/utils/rng';
import type { Station, WeightedLoc, PlayerAction } from './types';

export function weightedPick(opts: WeightedLoc[], rng: Rng): string | undefined {
  if (opts.length === 0) return undefined;
  const total = opts.reduce((s, o) => s + Math.max(0, o.weight), 0);
  if (total <= 0) return opts[0].locationId;
  let r = rng.next() * total;
  for (const o of opts) {
    r -= Math.max(0, o.weight);
    if (r < 0) return o.locationId;
  }
  return opts[opts.length - 1].locationId;
}

/** Resolve where each crew member is this slot, from their routine + rng. */
export function placeCrew(station: Station, slot: number, rng: Rng): Record<string, string> {
  const out: Record<string, string> = {};
  for (const npc of station.crew) {
    const opts = npc.routine[slot] ?? [];
    out[npc.id] = weightedPick(opts, rng) ?? station.locations[0].id;
  }
  return out;
}

/** Where the player ends up this slot given their action and the resolved placement. */
export function playerLocationOf(
  action: PlayerAction,
  station: Station,
  placement: Record<string, string>,
): string | undefined {
  switch (action.kind) {
    case 'blend':
    case 'observe':
      return action.locationId;
    case 'objective': {
      for (const obj of station.objectives) {
        const step = obj.steps.find((s) => s.id === action.stepId);
        if (step) return step.locationId;
      }
      return undefined;
    }
    case 'talk':
      return placement[action.npcId];
  }
}
