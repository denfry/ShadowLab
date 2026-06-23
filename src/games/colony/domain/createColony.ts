import { Rng } from '@/core/utils/rng';
import { makeId } from '@/core/utils';
import type { Colonist, ColonyState, JobType, TraitId } from './types';
import { emptySkills } from './skills';
import { TRAIT_IDS } from './traits';
import { COLONIST_NAMES, START_COLONISTS, START_RESOURCES, SEASON_BASE_TEMP } from '../data/balance';
import { regenerateWorld, pickStartSite } from './worldgen';
import { passableAt } from '../systems/grid';

const JOB_TYPES: JobType[] = ['farm', 'woodcut', 'research', 'build', 'tailor'];

function startingPriorities(): Record<JobType, number> {
  const p = {} as Record<JobType, number>;
  for (const j of JOB_TYPES) p[j] = 2;
  p.build = 3;
  return p;
}

export function createColony(seed: number): ColonyState {
  const rng = new Rng(seed);
  const map = regenerateWorld(seed);
  const start = pickStartSite(map);

  // Раскладываем колонистов по проходимым тайлам кольцами вокруг старт-площадки.
  const spots: { x: number; y: number }[] = [];
  for (let rad = 0; rad < 6 && spots.length < START_COLONISTS; rad++) {
    for (let dy = -rad; dy <= rad && spots.length < START_COLONISTS; dy++) {
      for (let dx = -rad; dx <= rad && spots.length < START_COLONISTS; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
        const x = start.x + dx, y = start.y + dy;
        if (passableAt(map, x, y) && !spots.some((s) => s.x === x && s.y === y)) spots.push({ x, y });
      }
    }
  }

  const colonists: Colonist[] = Array.from({ length: START_COLONISTS }, (_, i) => {
    const traits: TraitId[] = [rng.pick(TRAIT_IDS)];
    if (rng.chance(0.4)) {
      const second = rng.pick(TRAIT_IDS);
      if (second !== traits[0]) traits.push(second);
    }
    const skills = emptySkills();
    const focus = rng.pick(['farming', 'woodcutting', 'research', 'building'] as const);
    skills[focus].level = 2 + rng.int(0, 2);
    const spot = spots[i] ?? start;
    return {
      id: makeId('col'),
      name: COLONIST_NAMES[i % COLONIST_NAMES.length],
      traits,
      skills,
      needs: { hunger: 10 + rng.int(0, 10), fatigue: 10 + rng.int(0, 10), cold: 0 },
      health: 100,
      clothed: false,
      priorities: startingPriorities(),
      pos: { x: spot.x, y: spot.y },
      task: 'idle',
      path: [],
      alive: true,
    } satisfies Colonist;
  });

  return {
    version: 5,
    seed,
    rngState: rng.seed,
    tick: 0,
    day: 1,
    phase: 'day',
    speed: 1,
    resources: {
      food: { ...START_RESOURCES.food },
      wood: { ...START_RESOURCES.wood },
      science: { ...START_RESOURCES.science },
    },
    colonists,
    buildings: [],
    rooms: [],
    roomSig: '',
    tailorProgress: 0,
    stock: { clothing: 0 },
    env: { season: 'spring', dayInSeason: 0, outdoorTemp: SEASON_BASE_TEMP.spring, weather: 'clear' },
    map,
    log: [{ day: 1, text: 'Колония основана. Удачи.', tone: 'neutral' }],
    flags: { gameOver: false, victory: false },
  };
}
