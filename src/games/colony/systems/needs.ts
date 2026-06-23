import { clamp } from '@/core/utils';
import type { Building, Colonist, ColonyState, Pt } from '../domain/types';
import {
  CLOTHE_THRESHOLD, CLOTHING_WARMTH, COLD_DAMAGE_PER_TICK, COLD_PER_DEGREE,
  COLD_RECOVER, COLD_SLOW_MIN, COLD_SLOW_THRESHOLD, COMFORT_MIN, FREEZING_TEMP,
  FATIGUE_PER_TICK, FATIGUE_SLEEP_THRESHOLD, FOOD_PER_MEAL,
  HEALTH_REGEN_PER_TICK, HUNGER_EAT_THRESHOLD, HUNGER_PER_TICK,
  SLEEP_RECOVERY_PER_TICK, SLEEP_WAKE_FATIGUE, STARVE_DAMAGE_PER_TICK,
} from '../data/balance';
import { tempAt } from './grid';
import { findPath } from './pathfinding';

const tileOf = (c: Colonist): Pt => ({ x: Math.round(c.pos.x), y: Math.round(c.pos.y) });

function nearestBuilding(s: ColonyState, from: Pt, type: Building['type']): Building | undefined {
  let best: Building | undefined;
  let bestD = Infinity;
  for (const b of s.buildings) {
    if (b.type !== type || !b.built) continue;
    const d = Math.abs(b.tile.x - from.x) + Math.abs(b.tile.y - from.y);
    if (d < bestD) { bestD = d; best = b; }
  }
  return best;
}

function routeTo(s: ColonyState, c: Colonist, target: Pt, task: Colonist['task']): void {
  const path = findPath(s.map, tileOf(c), target);
  if (path === null) return; // недостижимо — остаёмся как есть
  c.targetTile = target;
  c.path = path;
  c.task = task;
}

/** Декей нужд + разрешение eat/sleep + прерывания. Без RNG (детерминирован). */
export function runNeeds(s: ColonyState): void {
  for (const c of s.colonists) {
    if (!c.alive) continue;

    // 1) Декей.
    c.needs.hunger = clamp(c.needs.hunger + HUNGER_PER_TICK, 0, 100);
    c.needs.fatigue = clamp(c.needs.fatigue + FATIGUE_PER_TICK, 0, 100);

    // 1b) Холод: эффективная температура = тайл под колонистом + одежда.
    const tileTemp = tempAt(s.map, Math.round(c.pos.x), Math.round(c.pos.y));
    const effTemp = tileTemp + (c.clothed ? CLOTHING_WARMTH : 0);
    if (effTemp < COMFORT_MIN) {
      c.needs.cold = clamp(c.needs.cold + (COMFORT_MIN - effTemp) * COLD_PER_DEGREE, 0, 100);
    } else {
      c.needs.cold = clamp(c.needs.cold - COLD_RECOVER, 0, 100);
    }
    if (c.needs.cold >= CLOTHE_THRESHOLD && !c.clothed && s.stock.clothing > 0) {
      c.clothed = true;
      s.stock.clothing -= 1;
    }
    if (effTemp <= FREEZING_TEMP) {
      c.health = clamp(c.health - COLD_DAMAGE_PER_TICK, 0, 100);
      if (c.health <= 0) {
        c.alive = false;
        s.log.push({ day: s.day, text: `${c.name} замёрз(ла) насмерть.`, tone: 'bad' });
        continue;
      }
    }

    // 2) Разрешение текущих «need»-задач.
    if (c.task === 'eat') {
      if (s.resources.food.amount >= FOOD_PER_MEAL) {
        s.resources.food.amount -= FOOD_PER_MEAL;
        c.needs.hunger = 0;
      }
      c.task = 'idle';
      c.targetBuildingId = undefined;
      c.targetTile = undefined;
      continue;
    }
    if (c.task === 'sleep') {
      c.needs.fatigue = clamp(c.needs.fatigue - SLEEP_RECOVERY_PER_TICK, 0, 100);
      if (c.needs.fatigue <= SLEEP_WAKE_FATIGUE) {
        c.task = 'idle';
        c.targetTile = undefined;
      }
      continue;
    }

    // 3) Голодание → урон/реген здоровья.
    if (c.needs.hunger >= 100 && s.resources.food.amount < FOOD_PER_MEAL) {
      c.health = clamp(c.health - STARVE_DAMAGE_PER_TICK, 0, 100);
      if (c.health <= 0) {
        c.alive = false;
        s.log.push({ day: s.day, text: `${c.name} умер(ла) от голода.`, tone: 'bad' });
        continue;
      }
    } else if (c.health < 100) {
      c.health = clamp(c.health + HEALTH_REGEN_PER_TICK, 0, 100);
    }

    // 4) Прерывания: не трогаем уже идущих есть/спать.
    if (c.task === 'goto_eat' || c.task === 'goto_sleep') continue;

    const hungry = c.needs.hunger >= HUNGER_EAT_THRESHOLD;
    const tired = c.needs.fatigue >= FATIGUE_SLEEP_THRESHOLD;
    if (!hungry && !tired) continue;

    if (hungry && s.resources.food.amount >= FOOD_PER_MEAL) {
      const storage = nearestBuilding(s, tileOf(c), 'storage');
      if (storage) routeTo(s, c, storage.tile, 'goto_eat');
      else c.task = 'eat'; // склада нет — едим на месте (разрешится в следующий тик)
    } else if (tired) {
      const bed = nearestBuilding(s, tileOf(c), 'bedroom');
      if (bed) routeTo(s, c, bed.tile, 'goto_sleep');
      else c.task = 'sleep'; // спим на месте
    }
  }
}

/** Множитель скорости работы от холода: 1 ниже порога, до COLD_SLOW_MIN при cold=100. */
export function coldWorkFactor(c: Colonist): number {
  if (c.needs.cold <= COLD_SLOW_THRESHOLD) return 1;
  const t = (c.needs.cold - COLD_SLOW_THRESHOLD) / (100 - COLD_SLOW_THRESHOLD);
  return 1 - t * (1 - COLD_SLOW_MIN);
}
