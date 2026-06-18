import type { BuildingType, ResourceId } from '../domain/types';

export const TICKS_PER_DAY = 120;

export const START_RESOURCES: Record<ResourceId, { amount: number; capacity: number }> = {
  food: { amount: 70, capacity: 200 },
  wood: { amount: 45, capacity: 200 },
  science: { amount: 0, capacity: 200 },
};

export const START_COLONISTS = 5;

// Per-tick economy.
export const FOOD_PER_COLONIST = 0.03;
export const FARM_YIELD = 0.1;
export const WOOD_YIELD = 0.06;
export const SCI_YIELD = 0.05;
export const TOOLS_FACTOR = 1.25;

export const BUILD_COST: Record<BuildingType, { wood: number }> = {
  farm: { wood: 20 },
  house: { wood: 15 },
  lab: { wood: 30 },
};

export const BASE_CAPACITY = 5; // colonists supported without houses
export const HOUSE_CAPACITY = 4;

export const RESEARCH_TOOLS_COST = 40; // science

// Victory / defeat.
export const WIN_DAY = 20;
export const WIN_POPULATION = 15;

export const COLONIST_NAMES = [
  'Ada', 'Bo', 'Cy', 'Dax', 'Eli', 'Fen', 'Gio', 'Hana', 'Ivo', 'Juno',
  'Kai', 'Lux', 'Mira', 'Nox', 'Ory', 'Pax', 'Quill', 'Rhea', 'Sol', 'Tia',
];
