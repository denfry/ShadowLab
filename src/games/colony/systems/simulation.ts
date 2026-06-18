import { Rng } from '@/core/utils/rng';
import { avg, clamp, makeId } from '@/core/utils';
import type { BuildingType, ColonyHudState, ColonyState, JobId } from '../domain/types';
import {
  BASE_CAPACITY,
  BUILD_COST,
  FARM_YIELD,
  FOOD_PER_COLONIST,
  HOUSE_CAPACITY,
  SCI_YIELD,
  TICKS_PER_DAY,
  TOOLS_FACTOR,
  WIN_DAY,
  WIN_POPULATION,
  WOOD_YIELD,
  COLONIST_NAMES,
} from '../data/balance';
import { TECHS, techById } from '../data/tech';
import { rollDailyEvent } from '../data/events';

const hasTech = (s: ColonyState, id: string) => s.tech.researched.includes(id);

const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;

export const alive = (s: ColonyState) => s.colonists.filter((c) => c.alive);
export const capacityOf = (s: ColonyState) =>
  BASE_CAPACITY + s.buildings.filter((b) => b.type === 'house').length * HOUSE_CAPACITY;

function jobCounts(s: ColonyState): Record<JobId, number> {
  const counts: Record<JobId, number> = { farmer: 0, lumberjack: 0, researcher: 0, idle: 0 };
  for (const c of alive(s)) counts[c.job] += 1;
  return counts;
}

function weatherFactor(s: ColonyState): number {
  let f = 1;
  if (s.weather.condition === 'storm') f *= 0.8;
  if (s.weather.season === 'winter') f *= 0.7;
  return f;
}

/** One simulation tick. Returns true if a new day rolled over. */
export function tick(s: ColonyState): boolean {
  if (s.flags.gameOver) return false;
  s.tick += 1;
  s.phase = s.tick % TICKS_PER_DAY < TICKS_PER_DAY / 2 ? 'day' : 'night';

  const counts = jobCounts(s);
  const farms = s.buildings.filter((b) => b.type === 'farm').length;
  const labs = s.buildings.filter((b) => b.type === 'lab').length;
  const wf = weatherFactor(s);
  const tools = hasTech(s, 'tools') ? TOOLS_FACTOR : 1;
  const irrigation = hasTech(s, 'irrigation') ? 1.3 : 1;

  const { food, wood, science } = s.resources;
  food.amount = clamp(food.amount + counts.farmer * FARM_YIELD * (1 + farms * 0.5) * wf * tools * irrigation, 0, food.capacity);
  wood.amount = clamp(wood.amount + counts.lumberjack * WOOD_YIELD * tools, 0, wood.capacity);
  science.amount = clamp(science.amount + counts.researcher * SCI_YIELD * (1 + labs * 0.5) * tools, 0, science.capacity);

  // Consumption.
  const pop = alive(s).length;
  const need = pop * FOOD_PER_COLONIST;
  if (food.amount >= need) {
    food.amount -= need;
    for (const c of alive(s)) c.hunger = clamp(c.hunger - 2, 0, 100);
  } else {
    food.amount = 0;
    s.starvedTicks += 1;
    for (const c of alive(s)) c.hunger = clamp(c.hunger + 5, 0, 100);
  }

  if (s.tick % TICKS_PER_DAY === 0) {
    s.day += 1;
    onNewDay(s);
    return true;
  }
  return false;
}

/** Daily resolution: weather, health/morale, events, growth, win/lose. */
export function onNewDay(s: ColonyState): void {
  const rng = new Rng(s.rngState);

  // Weather: season advances every 5 days; condition re-rolled.
  s.weather.season = SEASONS[Math.floor((s.day - 1) / 5) % SEASONS.length];
  s.weather.condition = rng.chance(0.2) ? 'storm' : rng.chance(0.3) ? 'rain' : 'clear';
  s.weather.temp = { spring: 14, summer: 24, autumn: 10, winter: -4 }[s.weather.season];

  const food = s.resources.food;
  const foodRatio = food.amount / food.capacity;

  const healthRegen = hasTech(s, 'medicine') ? 10 : 6;
  for (const c of alive(s)) {
    if (s.starvedTicks > 0) {
      c.health = clamp(c.health - 15, 0, 100);
      c.morale = clamp(c.morale - 12, 0, 100);
    } else {
      c.health = clamp(c.health + healthRegen, 0, 100);
    }
    const moraleTarget =
      50 + (foodRatio > 0.3 ? 15 : -18) + (s.weather.condition === 'storm' ? -10 : 0) + (s.weather.season === 'winter' ? -8 : 0);
    c.morale = clamp(c.morale + (moraleTarget - c.morale) * 0.3, 0, 100);
  }

  // Deaths.
  for (const c of s.colonists) {
    if (c.alive && c.health <= 0) {
      c.alive = false;
      s.log.push({ day: s.day, text: `${c.name} не пережил трудности.`, tone: 'bad' });
    }
  }

  // World event.
  s.log.push(rollDailyEvent(s, rng));

  // Growth: enough food, housing and morale → a colonist joins.
  const pop = alive(s).length;
  const avgMorale = avg(alive(s).map((c) => c.morale));
  if (pop > 0 && pop < capacityOf(s) && food.amount > food.capacity * 0.2 && avgMorale > 50 && rng.chance(0.45)) {
    s.colonists.push({
      id: makeId('col'),
      name: rng.pick(COLONIST_NAMES),
      job: 'idle',
      health: 85,
      morale: 60,
      hunger: 10,
      alive: true,
    });
    s.log.push({ day: s.day, text: 'В колонии прибавление.', tone: 'good' });
  }

  // Win / lose.
  if (alive(s).length === 0) {
    s.flags.gameOver = true;
    s.log.push({ day: s.day, text: 'Колония вымерла. Игра окончена.', tone: 'bad' });
  } else if (s.day >= WIN_DAY && alive(s).length >= WIN_POPULATION) {
    s.flags.gameOver = true;
    s.flags.victory = true;
    s.log.push({ day: s.day, text: `Колония процветает: ${alive(s).length} жителей на день ${s.day}!`, tone: 'good' });
  }

  // Trim log + persist RNG.
  if (s.log.length > 60) s.log = s.log.slice(-60);
  s.rngState = rng.seed;
  s.starvedTicks = 0;
}

// ---- player actions (invoked from HUD via ctx.events 'ui:command') ----------

export function findBuildTile(s: ColonyState): { tx: number; ty: number } | null {
  const cx = Math.floor(s.map.w / 2);
  const cy = Math.floor(s.map.h / 2);
  for (let r = 0; r < Math.max(s.map.w, s.map.h); r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= s.map.w || y >= s.map.h) continue;
        const tile = s.map.tiles[y * s.map.w + x];
        if (tile.terrain === 'grass' && !tile.buildingId) return { tx: x, ty: y };
      }
    }
  }
  return null;
}

export function tryBuild(s: ColonyState, type: BuildingType): { ok: boolean; reason?: string } {
  const cost = BUILD_COST[type].wood;
  if (s.resources.wood.amount < cost) return { ok: false, reason: 'мало дерева' };
  const spot = findBuildTile(s);
  if (!spot) return { ok: false, reason: 'нет места' };
  s.resources.wood.amount -= cost;
  const id = makeId('bld');
  s.buildings.push({ id, type, tx: spot.tx, ty: spot.ty });
  s.map.tiles[spot.ty * s.map.w + spot.tx].buildingId = id;
  s.log.push({ day: s.day, text: `Построено: ${labelOf(type)}.`, tone: 'good' });
  return { ok: true };
}

export function tryResearch(s: ColonyState, techId: string): { ok: boolean; reason?: string } {
  const tech = techById(techId);
  if (!tech) return { ok: false, reason: 'нет такой технологии' };
  if (hasTech(s, techId)) return { ok: false, reason: 'уже изучено' };
  if (tech.requires?.some((r) => !hasTech(s, r))) return { ok: false, reason: 'нужны предпосылки' };
  if (s.resources.science.amount < tech.cost) return { ok: false, reason: 'мало науки' };
  s.resources.science.amount -= tech.cost;
  s.tech.researched.push(techId);
  s.log.push({ day: s.day, text: `Открыта технология «${tech.name}».`, tone: 'good' });
  return { ok: true };
}

export const allTechResearched = (s: ColonyState) => s.tech.researched.length >= TECHS.length;

export function moveJob(s: ColonyState, job: JobId, dir: 1 | -1): void {
  if (dir === 1) {
    const c = alive(s).find((x) => x.job === 'idle') ?? alive(s).find((x) => x.job !== job);
    if (c) c.job = job;
  } else {
    const c = alive(s).find((x) => x.job === job);
    if (c) c.job = 'idle';
  }
}

function labelOf(type: BuildingType): string {
  return { farm: 'ферма', house: 'дом', lab: 'лаборатория' }[type];
}

export function computeHud(s: ColonyState): ColonyHudState {
  const a = alive(s);
  return {
    day: s.day,
    phase: s.phase,
    speed: s.speed,
    population: a.length,
    capacity: capacityOf(s),
    resources: {
      food: { ...s.resources.food },
      wood: { ...s.resources.wood },
      science: { ...s.resources.science },
    },
    jobs: jobCounts(s),
    avgMorale: Math.round(avg(a.map((c) => c.morale))),
    avgHealth: Math.round(avg(a.map((c) => c.health))),
    weather: { ...s.weather },
    researched: [...s.tech.researched],
    science: Math.floor(s.resources.science.amount),
    colonists: a.map((c) => ({ name: c.name, job: c.job, health: Math.round(c.health), morale: Math.round(c.morale) })),
    log: s.log.slice(-8).reverse(),
    gameOver: s.flags.gameOver,
    victory: s.flags.victory,
  };
}
