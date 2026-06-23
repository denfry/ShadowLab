import { clamp } from '@/core/utils';
import type { Building, Colonist, ColonyState, Tile } from '../domain/types';
import { grantXp, skillMultiplier } from '../domain/skills';
import { TRAITS } from '../domain/traits';
import {
  BUILD_BASE, CLOTHING_REQUIRED, CLOTHING_WOOD_COST, FARM_BASE, FARM_FREEZE_TEMP,
  RESEARCH_BASE, STORAGE_CAPACITY_BONUS, TAILOR_BASE,
  WOODCUT_BASE, XP_PER_WORK_TICK,
} from '../data/balance';
import { tileAt } from './grid';
import { coldWorkFactor } from './needs';

const workSpeed = (c: Colonist): number =>
  c.traits.reduce((m, t) => m * (TRAITS[t]?.workSpeed ?? 1), 1);

const addResource = (s: ColonyState, id: 'food' | 'wood' | 'science', amt: number) => {
  const r = s.resources[id];
  r.amount = clamp(r.amount + amt, 0, r.capacity);
};

function finishWork(c: Colonist): void {
  c.task = 'idle';
  c.targetBuildingId = undefined;
  c.targetTile = undefined;
}

function applyStorageCapacity(s: ColonyState): void {
  const built = s.buildings.filter((b) => b.type === 'storage' && b.built).length;
  const cap = 200 + built * STORAGE_CAPACITY_BONUS;
  for (const id of ['food', 'wood', 'science'] as const) s.resources[id].capacity = cap;
}

/** Применяет работу для всех колонистов в задаче 'work'. Без RNG. */
export function runWork(s: ColonyState): void {
  for (const c of s.colonists) {
    if (!c.alive || c.task !== 'work') continue;
    const building = c.targetBuildingId
      ? s.buildings.find((b) => b.id === c.targetBuildingId)
      : undefined;

    // Холодовой множитель производительности.
    const cf = coldWorkFactor(c);

    // Стройка блюпринта.
    if (building && !building.built) {
      building.buildProgress += BUILD_BASE * skillMultiplier(c.skills.building.level) * workSpeed(c) * cf;
      grantXp(c.skills.building, XP_PER_WORK_TICK);
      if (building.buildProgress >= building.buildRequired) {
        building.built = true;
        const t = tileAt(building.tile.x, building.tile.y, s.map);
        if (t) t.buildingId = building.id;
        if (building.type === 'wall' && t) t.passable = false;
        applyStorageCapacity(s);
        s.log.push({ day: s.day, text: `Построено: ${building.type}.`, tone: 'good' });
        finishWork(c);
      }
      continue;
    }

    // Производство в здании.
    if (building && building.built) {
      if (building.jobType === 'farm') {
        const t = tileAt(building.tile.x, building.tile.y, s.map);
        if (!t || t.temp <= FARM_FREEZE_TEMP) { /* мёрзлая земля — ничего */ }
        else {
          const fert = 0.5 + t.fertility;
          addResource(s, 'food', FARM_BASE * skillMultiplier(c.skills.farming.level) * workSpeed(c) * fert * cf);
          grantXp(c.skills.farming, XP_PER_WORK_TICK);
        }
      } else if (building.jobType === 'research') {
        addResource(s, 'science', RESEARCH_BASE * skillMultiplier(c.skills.research.level) * workSpeed(c) * cf);
        grantXp(c.skills.research, XP_PER_WORK_TICK);
      } else if (building.jobType === 'tailor') {
        s.tailorProgress += TAILOR_BASE * skillMultiplier(c.skills.building.level) * workSpeed(c) * cf;
        grantXp(c.skills.building, XP_PER_WORK_TICK);
        if (s.tailorProgress >= CLOTHING_REQUIRED && s.resources.wood.amount >= CLOTHING_WOOD_COST) {
          s.tailorProgress -= CLOTHING_REQUIRED;
          s.resources.wood.amount -= CLOTHING_WOOD_COST;
          s.stock.clothing += 1;
        }
      }
      continue;
    }

    // Рубка леса на тайле-цели.
    if (!building && c.targetTile) {
      const t: Tile | undefined = tileAt(c.targetTile.x, c.targetTile.y, s.map);
      if (t && t.terrain === 'forest' && (t.wood ?? 0) > 0) {
        const take = Math.min(t.wood!, WOODCUT_BASE * skillMultiplier(c.skills.woodcutting.level) * workSpeed(c) * cf);
        t.wood! -= take;
        addResource(s, 'wood', take);
        grantXp(c.skills.woodcutting, XP_PER_WORK_TICK);
        if (t.wood! <= 0) {
          t.terrain = 'grass';
          t.wood = undefined;
          finishWork(c); // делянка кончилась
        }
      } else {
        finishWork(c); // цель невалидна
      }
      continue;
    }

    // Нет валидной цели.
    finishWork(c);
  }
}
