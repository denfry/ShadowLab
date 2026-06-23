export type Terrain = 'grass' | 'forest' | 'rock' | 'water';
export type ResourceId = 'food' | 'wood' | 'science';
export type SkillId =
  | 'farming' | 'woodcutting' | 'building' | 'research'
  | 'cooking' | 'medicine' | 'shooting' | 'melee';
export type TraitId = 'hardworker' | 'frail' | 'lazy' | 'optimist' | 'bloodlust' | 'clumsy';
export type BuildingType = 'farm' | 'bedroom' | 'storage' | 'lab' | 'wall' | 'door' | 'heater' | 'tailor';
/** Назначаемые игроком категории работ (приоритеты 0..3). */
export type JobType = 'farm' | 'woodcut' | 'research' | 'build' | 'tailor';
/** Конечный автомат поведения колониста. */
export type TaskKind =
  | 'idle' | 'goto_work' | 'work'
  | 'goto_eat' | 'eat' | 'goto_sleep' | 'sleep';

export interface Pt { x: number; y: number; }

export interface Tile {
  x: number;
  y: number;
  terrain: Terrain;
  fertility: number;   // 0..1 — влияет на урожай ферм
  passable: boolean;
  buildingId?: string;
  wood?: number;       // запас дерева на forest-тайле
  roomId: number;   // 0 = улица; >0 = id комнаты
  temp: number;     // °C текущая температура тайла
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
  map: { w: number; h: number; tiles: Tile[] };
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
