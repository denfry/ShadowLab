import { Rng } from '@/core/utils/rng';
import { makeId } from '@/core/utils';
import type { Colonist, ColonyState, JobId, Terrain, Tile } from './types';
import { COLONIST_NAMES, START_COLONISTS, START_RESOURCES } from '../data/balance';

const MAP_W = 24;
const MAP_H = 24;
const START_JOBS: JobId[] = ['farmer', 'farmer', 'lumberjack', 'researcher', 'idle'];

function genTile(rng: Rng, x: number, y: number): Tile {
  const r = rng.next();
  let terrain: Terrain = 'grass';
  if (r > 0.82) terrain = 'water';
  else if (r > 0.6) terrain = 'rock';
  else if (r > 0.32) terrain = 'forest';
  return { x, y, terrain };
}

export function createColony(seed: number): ColonyState {
  const rng = new Rng(seed);
  const tiles: Tile[] = [];
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      // Keep the central spawn area buildable grass.
      const dx = Math.abs(x - MAP_W / 2);
      const dy = Math.abs(y - MAP_H / 2);
      tiles.push(dx < 3 && dy < 3 ? { x, y, terrain: 'grass' } : genTile(rng, x, y));
    }
  }

  const colonists: Colonist[] = Array.from({ length: START_COLONISTS }, (_, i) => ({
    id: makeId('col'),
    name: COLONIST_NAMES[i % COLONIST_NAMES.length],
    job: START_JOBS[i] ?? 'idle',
    health: 100,
    morale: 70,
    hunger: 0,
    alive: true,
  }));

  return {
    version: 2,
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
    map: { w: MAP_W, h: MAP_H, tiles },
    weather: { season: 'spring', temp: 16, condition: 'clear' },
    tech: { researched: [] },
    starvedTicks: 0,
    log: [{ day: 1, text: 'Колония основана. Удачи.', tone: 'neutral' }],
    flags: { gameOver: false, victory: false },
  };
}
