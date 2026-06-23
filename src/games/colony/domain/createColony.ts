import { Rng } from '@/core/utils/rng';
import { makeId } from '@/core/utils';
import type { Colonist, ColonyState, JobType, Terrain, Tile, TraitId } from './types';
import { emptySkills } from './skills';
import { TRAIT_IDS } from './traits';
import { COLONIST_NAMES, MAP_W, MAP_H, START_COLONISTS, START_RESOURCES, SEASON_BASE_TEMP } from '../data/balance';

const JOB_TYPES: JobType[] = ['farm', 'woodcut', 'research', 'build', 'tailor'];

function genTile(rng: Rng, x: number, y: number): Tile {
  const r = rng.next();
  let terrain: Terrain = 'grass';
  if (r > 0.85) terrain = 'water';
  else if (r > 0.7) terrain = 'rock';
  else if (r > 0.4) terrain = 'forest';
  const passable = terrain !== 'water' && terrain !== 'rock';
  const fertility = terrain === 'grass' ? 0.4 + rng.next() * 0.6 : 0.2 + rng.next() * 0.3;
  const tile: Tile = { x, y, terrain, fertility, passable, roomId: 0, temp: 16 };
  if (terrain === 'forest') tile.wood = 30 + rng.int(0, 30);
  return tile;
}

function startingPriorities(rng: Rng): Record<JobType, number> {
  // Базовый разумный набор; небольшая вариация по сидам.
  const p = {} as Record<JobType, number>;
  for (const j of JOB_TYPES) p[j] = 2;
  p.build = 3; // строить — важно по умолчанию
  return p;
}

export function createColony(seed: number): ColonyState {
  const rng = new Rng(seed);
  const tiles: Tile[] = [];
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const dx = Math.abs(x - MAP_W / 2);
      const dy = Math.abs(y - MAP_H / 2);
      if (dx < 3 && dy < 3) {
        tiles.push({ x, y, terrain: 'grass', fertility: 0.6, passable: true, roomId: 0, temp: 16 });
      } else {
        tiles.push(genTile(rng, x, y));
      }
    }
  }

  const cx = Math.floor(MAP_W / 2);
  const cy = Math.floor(MAP_H / 2);
  const colonists: Colonist[] = Array.from({ length: START_COLONISTS }, (_, i) => {
    const traits: TraitId[] = [rng.pick(TRAIT_IDS)];
    if (rng.chance(0.4)) {
      const second = rng.pick(TRAIT_IDS);
      if (second !== traits[0]) traits.push(second);
    }
    const skills = emptySkills();
    // Лёгкая стартовая специализация.
    const focus = rng.pick(['farming', 'woodcutting', 'research', 'building'] as const);
    skills[focus].level = 2 + rng.int(0, 2);
    return {
      id: makeId('col'),
      name: COLONIST_NAMES[i % COLONIST_NAMES.length],
      traits,
      skills,
      needs: { hunger: 10 + rng.int(0, 10), fatigue: 10 + rng.int(0, 10), cold: 0 },
      health: 100,
      clothed: false,
      priorities: startingPriorities(rng),
      pos: { x: cx + (i - 2) * 0.6, y: cy },
      task: 'idle',
      path: [],
      alive: true,
    } satisfies Colonist;
  });

  return {
    version: 4,
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
    map: { w: MAP_W, h: MAP_H, tiles },
    log: [{ day: 1, text: 'Колония основана. Удачи.', tone: 'neutral' }],
    flags: { gameOver: false, victory: false },
  };
}
