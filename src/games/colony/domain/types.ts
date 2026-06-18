export type ResourceId = 'food' | 'wood' | 'science';
export type JobId = 'farmer' | 'lumberjack' | 'researcher' | 'idle';
export type BuildingType = 'farm' | 'house' | 'lab';
export type Terrain = 'grass' | 'forest' | 'rock' | 'water';

export interface Resource {
  amount: number;
  capacity: number;
}

export interface Colonist {
  id: string;
  name: string;
  job: JobId;
  health: number; // 0..100
  morale: number; // 0..100
  hunger: number; // 0..100 (higher = hungrier)
  alive: boolean;
}

export interface Building {
  id: string;
  type: BuildingType;
  tx: number;
  ty: number;
}

export interface Tile {
  x: number;
  y: number;
  terrain: Terrain;
  buildingId?: string;
}

export interface LogEntry {
  day: number;
  text: string;
  tone: 'good' | 'bad' | 'neutral';
  /** Optional marker for systems to react to (e.g. 'raid_repelled'). */
  tag?: string;
}

export interface ColonyState {
  version: number;
  seed: number;
  rngState: number;
  tick: number;
  day: number;
  phase: 'day' | 'night';
  speed: number; // 0 = paused, 1/2/3
  resources: Record<ResourceId, Resource>;
  colonists: Colonist[];
  buildings: Building[];
  map: { w: number; h: number; tiles: Tile[] };
  weather: { season: 'spring' | 'summer' | 'autumn' | 'winter'; temp: number; condition: 'clear' | 'rain' | 'storm' };
  tech: { researched: string[] };
  starvedTicks: number;
  log: LogEntry[];
  flags: { gameOver: boolean; victory: boolean };
}

/** Light projection sent to the React HUD every few frames. */
export interface ColonyHudState {
  day: number;
  phase: 'day' | 'night';
  speed: number;
  population: number;
  capacity: number;
  resources: Record<ResourceId, Resource>;
  jobs: Record<JobId, number>;
  avgMorale: number;
  avgHealth: number;
  weather: ColonyState['weather'];
  researched: string[];
  science: number;
  colonists: { name: string; job: JobId; health: number; morale: number }[];
  log: LogEntry[];
  gameOver: boolean;
  victory: boolean;
}
