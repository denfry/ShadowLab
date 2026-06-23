import type { Biome, BuildingType, JobType, ResourceId } from '../domain/types';

export const MAP_W = 28;
export const MAP_H = 28;
export const TILE = 22;               // пиксели на тайл (рендер)
export const TICKS_PER_DAY = 240;
export const SIM_TPS = 8;             // тиков/сек при 1×

export const START_COLONISTS = 5;
export const START_RESOURCES: Record<ResourceId, Resource_> = {
  food: { amount: 120, capacity: 200 },
  wood: { amount: 60, capacity: 200 },
  science: { amount: 0, capacity: 200 },
};
type Resource_ = { amount: number; capacity: number };

// Движение
export const MOVE_SPEED = 0.2;        // тайлов/тик
export const ARRIVE_EPS = 0.05;

// Нужды (на тик)
export const HUNGER_PER_TICK = 0.3;
export const FATIGUE_PER_TICK = 0.22;
export const HUNGER_EAT_THRESHOLD = 65;
export const FATIGUE_SLEEP_THRESHOLD = 70;
export const FOOD_PER_MEAL = 8;
export const SLEEP_RECOVERY_PER_TICK = 1.4;
export const SLEEP_WAKE_FATIGUE = 8;  // просыпается, когда усталость ниже

// Здоровье (Фаза 0)
export const STARVE_DAMAGE_PER_TICK = 0.5;
export const HEALTH_REGEN_PER_TICK = 0.15;

// Выработка (на тик во время работы)
export const FARM_BASE = 0.45;        // *skill *(0.5+fertility)
export const WOODCUT_BASE = 0.5;      // *skill ; забирает дерево из тайла
export const RESEARCH_BASE = 0.3;     // *skill
export const BUILD_BASE = 0.6;        // *skill ; прогресс блюпринта
export const XP_PER_WORK_TICK = 0.6;

export const STORAGE_CAPACITY_BONUS = 120; // +ёмкость всех ресурсов за склад

export const BUILD_COST: Record<BuildingType, Partial<Record<ResourceId, number>>> = {
  farm: { wood: 20 }, bedroom: { wood: 25 }, storage: { wood: 15 }, lab: { wood: 35 },
  wall: { wood: 5 }, door: { wood: 8 }, heater: { wood: 30 }, tailor: { wood: 25 },
};

export const BUILD_REQUIRED: Record<BuildingType, number> = {
  farm: 30, bedroom: 35, storage: 25, lab: 45, wall: 8, door: 10, heater: 25, tailor: 30,
};

export const BUILDING_WORK_SLOTS: Record<BuildingType, number> = {
  farm: 3, bedroom: 0, storage: 0, lab: 2, wall: 0, door: 0, heater: 0, tailor: 2,
};

export const BUILDING_JOB: Record<BuildingType, JobType | undefined> = {
  farm: 'farm', lab: 'research', bedroom: undefined, storage: undefined,
  wall: undefined, door: undefined, heater: undefined, tailor: 'tailor',
};

export const WIN_DAY_STUB = 12;       // заглушка победы (реальный арк — Фаза 4)

// ---- Phase 1: среда ----
export const SEASON_LENGTH = 6; // дней в сезоне
export const SEASON_BASE_TEMP: Record<'spring' | 'summer' | 'autumn' | 'winter', number> = {
  spring: 12, summer: 26, autumn: 8, winter: -12,
};
export const SEASON_ORDER = ['spring', 'summer', 'autumn', 'winter'] as const;
export const NIGHT_TEMP_DROP = 6;
export const WEATHER_TEMP_DROP: Record<'clear' | 'snow' | 'cold_snap', number> = {
  clear: 0, snow: 4, cold_snap: 10,
};

// Температура комнат
export const HEATER_OUTPUT = 30;        // °C при площади AREA_NORM
export const AREA_NORM = 16;            // тайлов — эталон для полной мощности
export const TEMP_LERP = 0.05;
export const HEATER_FUEL_PER_TICK = 0.02; // дерева за активный обогреватель в тик

// Нужда холода
export const COMFORT_MIN = 14;          // ниже — холодно
export const CLOTHING_WARMTH = 12;      // +эфф. температура в одежде
export const COLD_PER_DEGREE = 0.06;    // рост cold за °C недостатка в тик
export const COLD_RECOVER = 0.8;        // падение cold в тепле в тик
export const COLD_SLOW_THRESHOLD = 40;  // выше — замедление работы
export const COLD_SLOW_MIN = 0.5;       // мин. множитель работы при cold=100
export const FREEZING_TEMP = -2;        // эфф. темп ≤ — урон здоровью
export const COLD_DAMAGE_PER_TICK = 0.4;
export const CLOTHE_THRESHOLD = 30;     // cold, при котором авто-одевание

// Фермы зимой
export const FARM_FREEZE_TEMP = 0;      // ферма работает только если temp тайла > этого

// Пошив
export const TAILOR_BASE = 0.5;
export const CLOTHING_WOOD_COST = 10;
export const CLOTHING_REQUIRED = 20;

// Порча еды (в день)
export const BASE_SPOIL = 0.08;
export const SPOIL_COLD_TEMP = 0;       // средняя темп ниже — порча почти нулевая

export const COLONIST_NAMES = [
  'Ada', 'Bo', 'Cy', 'Dax', 'Eli', 'Fen', 'Gio', 'Hana', 'Ivo', 'Juno',
  'Kai', 'Lux', 'Mira', 'Nox', 'Ory', 'Pax', 'Quill', 'Rhea', 'Sol', 'Tia',
];

// ---- Генерация мира (План A: 28²; План B поднимет MAP до 256) ----
export const GEN = {
  elevScale: 7,        // делитель координат для шума высоты (крупнее = плавнее)
  moistScale: 6,
  waterLevel: 0.34,    // elevation < — вода
  marshMax: 0.39,      // < и влажно — болото
  rockMin: 0.60,       // > — скалы
  mountainMin: 0.70,   // > — горы (непроходимо)
  forestMoist: 0.60,   // влажность > в средней высоте — лес
  meadowMoist: 0.44,   // влажность > — луга
  riverCount: 3,       // рек на карту
  riverMaxSteps: 200,
  // плотности залежей (вероятность узла на подходящем тайле)
  pStone: 0.05, pIron: 0.018, pGold: 0.004, pClay: 0.05, pBerries: 0.03, pFish: 0.04,
  woodMin: 20, woodMax: 50,   // запас узла дерева
  oreMin: 30, oreMax: 80,
} as const;

export const BIOME_FERTILITY: Record<Biome, number> = {
  water: 0, marsh: 0.25, meadow: 0.85, grass: 0.5, forest: 0.55, rock: 0.15, mountain: 0,
};
