import { clamp } from '@/core/utils';
import type { Building, Colonist, ColonyState, CropId, NodeKind, ResourceId, SkillId } from '../domain/types';
import { grantXp, skillMultiplier } from '../domain/skills';
import { TRAITS } from '../domain/traits';
import {
  BUILD_BASE, CLOTHING_REQUIRED, CLOTHING_WOOD_COST, FARM_BASE, FARM_FREEZE_TEMP,
  MINE_BASE, FORAGE_BASE, RESEARCH_BASE, STORAGE_CAPACITY_BONUS, TAILOR_BASE,
  WOODCUT_BASE, XP_PER_WORK_TICK,
  TILL_BASE, PLANT_BASE, HARVEST_BASE, TILL_REQUIRED, PLANT_REQUIRED, HARVEST_REQUIRED,
  CROP_GROWTH_TICKS, CROP_YIELD, CROP_FERTILITY_DELTA, BERRY_REGROW_DAYS,
} from '../data/balance';
import { fertilityAt, setFertility, tempAt, nodeAt, depleteNode, setBiome, setBuildingId, setPassable, idx } from './grid';
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

const CROP_RESOURCE: Record<CropId, ResourceId> = { wheat: 'food', potato: 'food', legume: 'food', flax: 'fiber' };

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

    // Поле (till/plant/harvest) или добыча узла на тайле-цели.
    if (!building && c.targetTile) {
      const tx = c.targetTile.x, ty = c.targetTile.y;
      const fi = idx(tx, ty, s.map.w);
      const plot = s.fields.get(fi);
      if (plot) {
        if (tempAt(s.map, tx, ty) > FARM_FREEZE_TEMP) {
          if (plot.stage === 'till') {
            plot.progress += TILL_BASE * skillMultiplier(c.skills.farming.level) * workSpeed(c) * cf;
            grantXp(c.skills.farming, XP_PER_WORK_TICK);
            if (plot.progress >= TILL_REQUIRED) { plot.stage = 'plant'; plot.progress = 0; finishWork(c); }
          } else if (plot.stage === 'plant') {
            plot.progress += PLANT_BASE * skillMultiplier(c.skills.farming.level) * workSpeed(c) * cf;
            grantXp(c.skills.farming, XP_PER_WORK_TICK);
            if (plot.progress >= PLANT_REQUIRED) { plot.stage = 'grow'; plot.progress = 0; finishWork(c); }
          } else if (plot.stage === 'ready') {
            plot.progress += HARVEST_BASE * skillMultiplier(c.skills.farming.level) * workSpeed(c) * cf;
            grantXp(c.skills.farming, XP_PER_WORK_TICK);
            if (plot.progress >= HARVEST_REQUIRED) {
              const amt = CROP_YIELD[plot.crop] * (0.5 + fertilityAt(s.map, tx, ty)) * skillMultiplier(c.skills.farming.level) * cf;
              addResource(s, CROP_RESOURCE[plot.crop], amt);
              setFertility(s.map, tx, ty, fertilityAt(s.map, tx, ty) + CROP_FERTILITY_DELTA[plot.crop]);
              plot.stage = 'till'; plot.progress = 0;
              finishWork(c);
            }
          } else {
            finishWork(c); // 'grow' — рабочий тут не нужен, освобождаем
          }
        }
        continue;
      }
      const node = nodeAt(s.map, tx, ty);
      const rule = node ? HARVEST[node.kind] : null;
      if (node && rule && node.amount > 0) {
        const want = rule.base * skillMultiplier(c.skills[rule.skill].level) * workSpeed(c) * cf;
        const took = depleteNode(s.map, tx, ty, want);
        addResource(s, rule.res, took);
        grantXp(c.skills[rule.skill], XP_PER_WORK_TICK);
        if (!nodeAt(s.map, tx, ty)) {                   // узел истощён
          s.designations.delete(idx(tx, ty, s.map.w));   // снять пометку
          if (node.kind === 'wood') setBiome(s.map, tx, ty, 'grass');
          if (node.kind === 'berries') s.regrowCooldowns.set(idx(tx, ty, s.map.w), BERRY_REGROW_DAYS);
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

/** Пассивный рост 'grow'-тайлов; не требует рабочего. Вызывается раз в тик из tick.ts. */
export function advanceGrowth(s: ColonyState): void {
  for (const [i, plot] of s.fields) {
    if (plot.stage !== 'grow') continue;
    const x = i % s.map.w, y = Math.floor(i / s.map.w);
    if (tempAt(s.map, x, y) <= FARM_FREEZE_TEMP) continue; // приморожено — ждём тепла
    plot.progress += 1;
    if (plot.progress >= CROP_GROWTH_TICKS[plot.crop]) { plot.stage = 'ready'; plot.progress = 0; }
  }
}

/** На переходе сезона в 'winter' губит все незрелые (grow) посевы — семя погибло,
 *  время потрачено, штрафа к плодородию нет. */
export function killUnripeCrops(s: ColonyState): void {
  for (const plot of s.fields.values()) {
    if (plot.stage === 'grow') { plot.stage = 'till'; plot.progress = 0; }
  }
}
