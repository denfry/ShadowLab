import type { Rng } from '@/core/utils/rng';
import { clamp } from '@/core/utils';
import type { ColonyState, LogEntry } from '../domain/types';
import { HOUSE_CAPACITY, BASE_CAPACITY } from './balance';
import { makeId } from '@/core/utils';
import { COLONIST_NAMES } from './balance';

export interface ColonyEventDef {
  id: string;
  weight: number;
  apply: (state: ColonyState, rng: Rng) => LogEntry;
}

const capacityOf = (s: ColonyState) =>
  BASE_CAPACITY + s.buildings.filter((b) => b.type === 'house').length * HOUSE_CAPACITY;

const aliveCount = (s: ColonyState) => s.colonists.filter((c) => c.alive).length;

/** The 5 MVP world events. The world reacts to the player's state — e.g. a
 *  trader only helps if you have wood to trade; migration needs free housing. */
export const COLONY_EVENTS: ColonyEventDef[] = [
  {
    id: 'good_harvest',
    weight: 1,
    apply: (s) => {
      s.resources.food.amount = clamp(s.resources.food.amount + 28, 0, s.resources.food.capacity);
      return { day: s.day, text: 'Богатый урожай: +28 еды.', tone: 'good' };
    },
  },
  {
    id: 'disease',
    weight: 1,
    apply: (s, rng) => {
      const alive = s.colonists.filter((c) => c.alive);
      if (!alive.length) return { day: s.day, text: 'Болезнь прошла стороной.', tone: 'neutral' };
      const victim = rng.pick(alive);
      victim.health = clamp(victim.health - 35, 0, 100);
      return { day: s.day, text: `Болезнь подкосила ${victim.name} (−35 здоровья).`, tone: 'bad' };
    },
  },
  {
    id: 'migration',
    weight: 1,
    apply: (s, rng) => {
      if (aliveCount(s) >= capacityOf(s)) {
        return { day: s.day, text: 'Странники прошли мимо: нет жилья.', tone: 'neutral' };
      }
      s.colonists.push({
        id: makeId('col'),
        name: rng.pick(COLONIST_NAMES),
        job: 'idle',
        health: 90,
        morale: 60,
        hunger: 10,
        alive: true,
      });
      return { day: s.day, text: 'К колонии присоединился новый житель.', tone: 'good' };
    },
  },
  {
    id: 'storm',
    weight: 1,
    apply: (s) => {
      s.weather.condition = 'storm';
      s.resources.wood.amount = clamp(s.resources.wood.amount - 12, 0, s.resources.wood.capacity);
      return { day: s.day, text: 'Буря повредила запасы: −12 дерева.', tone: 'bad' };
    },
  },
  {
    id: 'trader',
    weight: 1,
    apply: (s) => {
      if (s.resources.wood.amount >= 10) {
        s.resources.wood.amount -= 10;
        s.resources.food.amount = clamp(s.resources.food.amount + 22, 0, s.resources.food.capacity);
        return { day: s.day, text: 'Торговец: обменяли 10 дерева на 22 еды.', tone: 'good' };
      }
      return { day: s.day, text: 'Заходил торговец, но нечего было предложить.', tone: 'neutral' };
    },
  },
  {
    id: 'raid',
    weight: 1,
    apply: (s, rng) => {
      // Defense scales with population (ThreatSystem, MVP).
      const defenders = aliveCount(s);
      const repelled = defenders >= 5 || rng.chance(Math.min(0.85, defenders * 0.17));
      if (repelled) {
        return { day: s.day, text: 'Налётчики отбиты — колония удержала позиции.', tone: 'good', tag: 'raid_repelled' };
      }
      s.resources.food.amount = clamp(s.resources.food.amount - 15, 0, s.resources.food.capacity);
      s.resources.wood.amount = clamp(s.resources.wood.amount - 10, 0, s.resources.wood.capacity);
      const av = s.colonists.filter((c) => c.alive);
      if (av.length) {
        const victim = rng.pick(av);
        victim.health = clamp(victim.health - 35, 0, 100);
      }
      return { day: s.day, text: 'Налёт: разграблены припасы, есть раненые.', tone: 'bad' };
    },
  },
  {
    id: 'festival',
    weight: 1,
    apply: (s) => {
      for (const c of s.colonists) if (c.alive) c.morale = clamp(c.morale + 15, 0, 100);
      return { day: s.day, text: 'Праздник урожая поднял боевой дух (+мораль).', tone: 'good' };
    },
  },
  {
    id: 'cold_snap',
    weight: 1,
    apply: (s) => {
      for (const c of s.colonists) if (c.alive) c.health = clamp(c.health - 8, 0, 100);
      s.weather.condition = 'storm';
      return { day: s.day, text: 'Резкое похолодание ударило по здоровью жителей.', tone: 'bad' };
    },
  },
  {
    id: 'wanderer',
    weight: 1,
    apply: (s, rng) => {
      if (aliveCount(s) >= capacityOf(s)) {
        return { day: s.day, text: 'Опытный странник не остался — нет жилья.', tone: 'neutral' };
      }
      s.colonists.push({
        id: makeId('col'),
        name: rng.pick(COLONIST_NAMES),
        job: rng.pick(['farmer', 'lumberjack', 'researcher'] as const),
        health: 95,
        morale: 65,
        hunger: 5,
        alive: true,
      });
      return { day: s.day, text: 'Опытный странник присоединился и сразу взялся за работу.', tone: 'good' };
    },
  },
  {
    id: 'wildfire',
    weight: 1,
    apply: (s, rng) => {
      s.resources.wood.amount = clamp(s.resources.wood.amount - 18, 0, s.resources.wood.capacity);
      const av = s.colonists.filter((c) => c.alive);
      if (av.length && rng.chance(0.5)) {
        const victim = rng.pick(av);
        victim.health = clamp(victim.health - 20, 0, 100);
      }
      return { day: s.day, text: 'Лесной пожар уничтожил часть запасов дерева.', tone: 'bad' };
    },
  },
  {
    id: 'supply_cache',
    weight: 1,
    apply: (s) => {
      s.resources.food.amount = clamp(s.resources.food.amount + 15, 0, s.resources.food.capacity);
      s.resources.wood.amount = clamp(s.resources.wood.amount + 15, 0, s.resources.wood.capacity);
      return { day: s.day, text: 'Найден старый тайник: +15 еды, +15 дерева.', tone: 'good' };
    },
  },
];

export function rollDailyEvent(state: ColonyState, rng: Rng): LogEntry {
  const total = COLONY_EVENTS.reduce((a, e) => a + e.weight, 0);
  let roll = rng.next() * total;
  for (const ev of COLONY_EVENTS) {
    roll -= ev.weight;
    if (roll <= 0) return ev.apply(state, rng);
  }
  return COLONY_EVENTS[0].apply(state, rng);
}
