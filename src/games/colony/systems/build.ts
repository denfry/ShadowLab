import { makeId } from '@/core/utils';
import type { BuildingType, ColonyState } from '../domain/types';
import {
  BUILD_COST, BUILD_REQUIRED, BUILDING_JOB, BUILDING_WORK_SLOTS,
} from '../data/balance';
import { biomeAt, buildingIdAt, inBounds } from './grid';

export function canPlace(s: ColonyState, x: number, y: number): boolean {
  if (!inBounds(x, y, s.map)) return false;
  const b = biomeAt(s.map, x, y);
  if (b === 'water' || b === 'mountain') return false;
  if (buildingIdAt(s.map, x, y)) return false;
  if (s.buildings.some((bl) => bl.tile.x === x && bl.tile.y === y)) return false;
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
