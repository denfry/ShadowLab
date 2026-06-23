import { makeId } from '@/core/utils';
import type { BuildingType, ColonyState } from '../domain/types';
import {
  BUILD_COST, BUILD_REQUIRED, BUILDING_JOB, BUILDING_WORK_SLOTS,
} from '../data/balance';
import { tileAt } from './grid';

export function canPlace(s: ColonyState, x: number, y: number): boolean {
  const t = tileAt(x, y, s.map);
  if (!t) return false;
  if (t.terrain === 'water' || t.terrain === 'rock') return false;
  if (t.buildingId) return false;
  if (s.buildings.some((b) => b.tile.x === x && b.tile.y === y)) return false;
  return true;
}

export function placeBlueprint(
  s: ColonyState,
  type: BuildingType,
  x: number,
  y: number,
): { ok: boolean; reason?: string } {
  if (!canPlace(s, x, y)) return { ok: false, reason: 'нельзя строить здесь' };
  const cost = BUILD_COST[type];
  for (const [res, amt] of Object.entries(cost) as [keyof typeof s.resources, number][]) {
    if (s.resources[res].amount < amt) {
      return { ok: false, reason: res === 'wood' ? 'мало дерева' : `мало ${res}` };
    }
  }
  for (const [res, amt] of Object.entries(cost) as [keyof typeof s.resources, number][]) {
    s.resources[res].amount -= amt;
  }
  s.buildings.push({
    id: makeId('bld'),
    type,
    tile: { x, y },
    workSlots: BUILDING_WORK_SLOTS[type],
    jobType: BUILDING_JOB[type],
    built: false,
    buildProgress: 0,
    buildRequired: BUILD_REQUIRED[type],
  });
  return { ok: true };
}
