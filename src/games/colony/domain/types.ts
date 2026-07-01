export type Biome = 'water' | 'marsh' | 'meadow' | 'grass' | 'forest' | 'rock' | 'mountain';
export type NodeKind = 'wood' | 'stone' | 'clay' | 'iron' | 'gold' | 'berries' | 'fish';
export interface ResourceNode { kind: NodeKind; amount: number; max: number; }

export type ResourceId = 'food' | 'wood' | 'science' | 'stone' | 'clay' | 'iron' | 'gold' | 'fiber';
export type SkillId =
  | 'farming' | 'woodcutting' | 'mining' | 'building' | 'research'
  | 'cooking' | 'medicine' | 'shooting' | 'melee';
export type TraitId = 'hardworker' | 'frail' | 'lazy' | 'optimist' | 'bloodlust' | 'clumsy';
export type CropId = 'wheat' | 'potato' | 'legume' | 'flax';
export type FieldStage = 'till' | 'plant' | 'grow' | 'ready';
export interface FieldPlot { crop: CropId; stage: FieldStage; progress: number; }
export type BuildingType = 'bedroom' | 'storage' | 'lab' | 'wall' | 'door' | 'heater' | 'tailor' | 'bridge' | 'tunnel';
/** Назначаемые игроком категории работ (приоритеты 0..3). */
export type JobType = 'farm' | 'woodcut' | 'mine' | 'forage' | 'research' | 'build' | 'tailor';
/** Конечный автомат поведения колониста. */
export type TaskKind =
  | 'idle' | 'goto_work' | 'work'
  | 'goto_eat' | 'eat' | 'goto_sleep' | 'sleep';

export interface Pt { x: number; y: number; }

export interface Tile {
  x: number;
  y: number;
  biome: Biome;        // было terrain: Terrain
  elevation: number;   // 0..1 — 2.5D-тень/вода/склон
  fertility: number;   // 0..1 — урожай ферм
  passable: boolean;
  buildingId?: string;
  node?: ResourceNode; // было wood?: number (узел дерева/камня/…)
  roomId: number;      // 0 = улица; >0 = id комнаты
  temp: number;        // °C текущая температура тайла
}

export interface Skill { level: number; xp: number; }
export interface Needs { hunger: number; fatigue: number; cold: number; } // все 0..100, выше = хуже
export interface Resource { amount: number; capacity: number; }

export interface Colonist {
  id: string;
  name: string;
  traits: TraitId[];
  skills: Record<SkillId, Skill>;
  needs: Needs;
  health: number;                         // 0..100 (Фаза 0: только голодание)
  clothed: boolean;
  priorities: Record<JobType, number>;    // 0=выкл .. 3=макс
  pos: Pt;                                 // координаты в тайлах (float)
  task: TaskKind;
  targetTile?: Pt;
  targetBuildingId?: string;
  path: Pt[];                              // оставшиеся путевые точки (тайлы)
  alive: boolean;
}

export interface Building {
  id: string;
  type: BuildingType;
  tile: Pt;                // Фаза 0: одно-тайловые здания
  workSlots: number;
  jobType?: JobType;       // что за работа выполняется здесь (farm→'farm', lab→'research')
  built: boolean;          // false = блюпринт (строится)
  buildProgress: number;   // 0..required
  buildRequired: number;
}

export interface Room { id: number; tiles: number[]; temp: number; area: number; }

export interface LogEntry {
  day: number;
  text: string;
  tone: 'good' | 'bad' | 'neutral';
  tag?: string;
}

export interface ColonyState {
  version: number;
  seed: number;
  rngState: number;
  tick: number;
  day: number;
  phase: 'day' | 'night';
  speed: number; // 0 | 1 | 2 | 3
  resources: Record<ResourceId, Resource>;
  colonists: Colonist[];
  buildings: Building[];
  rooms: Room[];
  roomSig: string;          // сигнатура набора стен/дверей (для ленивого пересчёта комнат)
  tailorProgress: number;   // глобальный прогресс пошива
  stock: { clothing: number };
  env: {
    season: 'spring' | 'summer' | 'autumn' | 'winter';
    dayInSeason: number;
    outdoorTemp: number;
    weather: 'clear' | 'snow' | 'cold_snap';
  };
  map: import('../systems/grid').ColonyMap;
  nav?: import('../systems/pathHierarchy').Nav; // derived, NOT serialized
  assignCursor: number; // time-slice cursor (Task 11), serialized for exact resume
  designations: Set<number>; // tile indices marked for harvest (player intent)
  fields: Map<number, FieldPlot>;       // tile index -> field state (till/plant/grow/ready)
  regrowCooldowns: Map<number, number>; // tile index -> days left until a depleted berries node regrows
  log: LogEntry[];
  flags: { gameOver: boolean; victory: boolean };
}

/** Проекция в React HUD. */
export interface ColonyHudColonist {
  id: string;
  name: string;
  traits: TraitId[];
  task: TaskKind;
  hunger: number;
  fatigue: number;
  health: number;
  topSkill: { id: SkillId; level: number };
  priorities: Record<JobType, number>;
  cold: number;
  clothed: boolean;
}

export interface ColonyHudState {
  day: number;
  phase: 'day' | 'night';
  speed: number;
  population: number;
  env: ColonyState['env'];
  clothing: number;
  resources: Record<ResourceId, Resource>;
  colonists: ColonyHudColonist[];
  buildingCounts: Record<BuildingType, number>;
  log: LogEntry[];
  gameOver: boolean;
  victory: boolean;
}
