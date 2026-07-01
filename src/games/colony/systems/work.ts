import { clamp } from '@/core/utils';
import type { Building, Colonist, ColonyState, NodeKind, ResourceId, SkillId } from '../domain/types';
import { grantXp, skillMultiplier } from '../domain/skills';
import { TRAITS } from '../domain/traits';
import {
  BUILD_BASE, CLOTHING_REQUIRED, CLOTHING_WOOD_COST, FARM_BASE, FARM_FREEZE_TEMP,
  MINE_BASE, FORAGE_BASE, RESEARCH_BASE, STORAGE_CAPACITY_BONUS, TAILOR_BASE,
  WOODCUT_BASE, XP_PER_WORK_TICK,
} from '../data/balance';
import { fertilityAt, tempAt, nodeAt, depleteNode, setBiome, setBuildingId, setPassable, idx } from './grid';
import { coldWorkFactor } from './needs';
import { markDirtyAt } from './pathHierarchy';

const workSpeed = (c: Colonist): number =>
  c.traits.reduce((m, t) => m * (TRAITS[t]?.workSpeed ?? 1), 1);

const addResource = (s: ColonyState, id: ResourceId, amt: number) => {
  const r = s.resources[id];
  r.amount = clamp(r.amount + amt, 0, r.capacity);
};

/** Что даёт добыча узла каждого вида (ресурс + навык + ставка). fish → Столп 2. */
const HARVEST: Record<NodeKind, { res: ResourceId; skill: SkillId; base: number } | null> = {
  wood:    { res: 'wood',  skill: 'woodcutting', base: WOODCUT_BASE },
  stone:   { res: 'stone', skill: 'mining',      base: MINE_BASE },
  clay:    { res: 'clay',  skill: 'mining',      base: MINE_BASE },
  iron:    { res: 'iron',  skill: 'mining',      base: MINE_BASE },
  gold:    { res: 'gold',  skill: 'mining',      base: MINE_BASE },
  berries: { res: 'food',  skill: 'farming',     base: FORAGE_BASE },
  fish:    null,
};

function finishWork(c: Colonist): void {
  c.task = 'idle';
  c.targetBuildingId = undefined;
  c.targetTile = undefined;
}

function applyStorageCapacity(s: ColonyState): void {
  const built = s.buildings.filter((b) => b.type === 'storage' && b.built).length;
  const cap = 200 + built * STORAGE_CAPACITY_BONUS;
  for (const id of ['food', 'wood', 'science', 'stone', 'clay', 'iron', 'gold', 'fiber'] as const) s.resources[id].capacity = cap;
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
        setBuildingId(s.map, building.tile.x, building.tile.y, building.id);
        if (building.type === 'wall') { setPassable(s.map, building.tile.x, building.tile.y, false); if (s.nav) markDirtyAt(s.nav, building.tile.x, building.tile.y); }
        if (building.type === 'bridge' || building.type === 'tunnel') { setPassable(s.map, building.tile.x, building.tile.y, true); if (s.nav) markDirtyAt(s.nav, building.tile.x, building.tile.y); }
        applyStorageCapacity(s);
        s.log.push({ day: s.day, text: `Построено: ${building.type}.`, tone: 'good' });
        finishWork(c);
      }
      continue;
    }

    // Производство в здании.
    if (building && building.built) {
      if (building.jobType === 'farm') {
        if (tempAt(s.map, building.tile.x, building.tile.y) <= FARM_FREEZE_TEMP) { /* мёрзлая земля — ничего */ }
        else {
          const fert = 0.5 + fertilityAt(s.map, building.tile.x, building.tile.y);
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

    // Добыча узла на тайле-цели (рубка/добыча/сбор).
    if (!building && c.targetTile) {
      const tx = c.targetTile.x, ty = c.targetTile.y;
      const node = nodeAt(s.map, tx, ty);
      const rule = node ? HARVEST[node.kind] : null;
      if (node && rule && node.amount > 0) {
        const want = rule.base * skillMultiplier(c.skills[rule.skill].level) * workSpeed(c) * cf;
        const took = depleteNode(s.map, tx, ty, want);
        addResource(s, rule.res, took);
        grantXp(c.skills[rule.skill], XP_PER_WORK_TICK);
        if (!nodeAt(s.map, tx, ty)) {                  // узел истощён
          s.designations.delete(idx(tx, ty, s.map.w));  // снять пометку
          if (node.kind === 'wood') setBiome(s.map, tx, ty, 'grass');
          finishWork(c);
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
