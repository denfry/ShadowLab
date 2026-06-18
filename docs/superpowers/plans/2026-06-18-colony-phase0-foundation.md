# Colony Phase 0 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Заменить абстрактную тик-симуляцию `colony` движком систем, где колонисты-личности (черты, навыки, нужды) физически ходят по сетке к работе, а игрок ставит здания кликом — играбельная «мини-колония».

**Architecture:** Плоское сериализуемое `ColonyState` + набор чистых систем (`pathfinding / needs / jobScheduler / agent / work / build / tick`), детерминированных через сид-`Rng`. Phaser-сцена рендерит из состояния и шлёт команды; React HUD — view + эмиттер. Контракт `GameModule` не меняется, `payloadVersion` 2 → 3.

**Tech Stack:** TypeScript, Phaser 3, React 18, Zustand, Vitest. Алиас `@/` → `src/`. Тесты: `npm test` (= `vitest run`), один файл: `npx vitest run <path>`. Типы: `npm run typecheck`.

---

## Предусловия и заметки

- **Git:** репозиторий **не инициализирован**. Шаги `git commit` приведены для полноты. Перед первым коммитом выполни `git init` (или попроси владельца). Если git недоступен — пропускай шаги коммита, но **всё равно** прогоняй тесты/typecheck в конце каждой задачи.
- **Совместимость сборки (важно, уточнено по факту):** замена общих `domain/types.ts` и `data/balance.ts` в Задаче 1 **сразу** ломает `tsc --noEmit` в легаси-файлах колонии (`systems/simulation.ts`, старый `createColony`, `data/events.ts`, `scenes/WorldScene.ts`, `ui/ColonyHud.tsx`), т.к. они импортируют старые символы. Это **ожидаемо** и держится до Задач 12–14, где эти файлы переписываются/удаляются.
  - **vitest (`npm test`) остаётся зелёным после каждой задачи** — esbuild транспилирует без проверки типов, старые тесты продолжают проходить, пока жив `simulation.ts`.
  - **`npm run build` (= `vite build`) тоже проходит** — vite использует esbuild, не `tsc`.
  - **Гейт на задачу для T1–T11:** (а) тесты этой задачи зелёные через `npx vitest run <файл>`; (б) **новые** файлы задачи сами по себе тип-корректны (ошибки `tsc` допустимы только в перечисленных легаси-файлах).
  - **Полностью зелёный `npm run typecheck`** достигается в Задаче 14 после удаления легаси. Не считать красный `tsc` на легаси-файлах регрессией до Задачи 14.
- **Семантика нужд:** `hunger` и `fatigue` — оба «чем выше, тем хуже» (0 — норма, 100 — критично).
- **Здоровье в Фазе 0:** простое число `health` 0..100 (падает только от голодания). Фаза 2 заменит его на список `conditions` со «способностями».
- **Баланс:** числовые константы конкретны, но намеренно черновые — тюнятся в баланс-проходах. Не блокируют архитектуру.

## Карта файлов

Создаём:
- `src/games/colony/domain/types.ts` — модель состояния и перечисления (заменяет старый).
- `src/games/colony/domain/traits.ts` — пул черт.
- `src/games/colony/domain/skills.ts` — список навыков + эффекты.
- `src/games/colony/data/balance.ts` — константы (заменяет старый).
- `src/games/colony/data/buildings.ts` — определения зданий.
- `src/games/colony/systems/grid.ts` — помощники сетки.
- `src/games/colony/systems/pathfinding.ts` — A*.
- `src/games/colony/domain/createColony.ts` — генерация мира (заменяет старый).
- `src/games/colony/systems/needs.ts` — декей нужд, еда/сон, прерывания.
- `src/games/colony/systems/jobScheduler.ts` — назначение работ по приоритету.
- `src/games/colony/systems/agent.ts` — движение по пути + переходы задач.
- `src/games/colony/systems/work.ts` — выработка/стройка/рубка + xp.
- `src/games/colony/systems/build.ts` — постановка здания кликом (блюпринт).
- `src/games/colony/systems/tick.ts` — оркестрация тика + новый день + победа/поражение.
- `src/games/colony/systems/projection.ts` — `computeHud(state)`.
- `tests/colony.grid.test.ts`, `colony.pathfinding.test.ts`, `colony.createColony.test.ts`, `colony.needs.test.ts`, `colony.jobs.test.ts`, `colony.agent.test.ts`, `colony.work.test.ts`, `colony.build.test.ts`, `colony.tick.test.ts`, `colony.projection.test.ts`.

Создаём UI (Задачи 12–13):
- `src/games/colony/scenes/WorldScene.ts` — переписывается.
- `src/games/colony/ui/ColonyHud.tsx` — переписывается.
- `src/games/colony/ui/panels/Roster.tsx`, `Inspector.tsx`, `WorkPriorities.tsx`, `BuildMenu.tsx`.

Изменяем:
- `src/games/colony/ColonyGameModule.ts` — `payloadVersion` → 3, импорт нового tick/createColony.
- `src/games/colony/definition.ts` — копирайт (tagline/description).
- `src/services/achievements/definitions.ts` — без удалений (ачивки совместимы).

Удаляем (Задача 14):
- `src/games/colony/systems/simulation.ts`, `src/games/colony/data/tech.ts`, `src/games/colony/data/events.ts`, `tests/colony.test.ts`.

---

## Task 1: Доменные типы, черты, навыки, баланс

**Files:**
- Create: `src/games/colony/domain/types.ts`
- Create: `src/games/colony/domain/traits.ts`
- Create: `src/games/colony/domain/skills.ts`
- Create: `src/games/colony/data/balance.ts`
- Test: `tests/colony.types.test.ts`

- [ ] **Step 1: Создать типы** `src/games/colony/domain/types.ts`

```ts
export type Terrain = 'grass' | 'forest' | 'rock' | 'water';
export type ResourceId = 'food' | 'wood' | 'science';
export type SkillId =
  | 'farming' | 'woodcutting' | 'building' | 'research'
  | 'cooking' | 'medicine' | 'shooting' | 'melee';
export type TraitId = 'hardworker' | 'frail' | 'lazy' | 'optimist' | 'bloodlust' | 'clumsy';
export type BuildingType = 'farm' | 'bedroom' | 'storage' | 'lab';
/** Назначаемые игроком категории работ (приоритеты 0..3). */
export type JobType = 'farm' | 'woodcut' | 'research' | 'build';
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
}

export interface Skill { level: number; xp: number; }
export interface Needs { hunger: number; fatigue: number; } // оба 0..100, выше = хуже
export interface Resource { amount: number; capacity: number; }

export interface Colonist {
  id: string;
  name: string;
  traits: TraitId[];
  skills: Record<SkillId, Skill>;
  needs: Needs;
  health: number;                         // 0..100 (Фаза 0: только голодание)
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
}

export interface ColonyHudState {
  day: number;
  phase: 'day' | 'night';
  speed: number;
  population: number;
  resources: Record<ResourceId, Resource>;
  colonists: ColonyHudColonist[];
  buildingCounts: Record<BuildingType, number>;
  log: LogEntry[];
  gameOver: boolean;
  victory: boolean;
}
```

- [ ] **Step 2: Создать черты** `src/games/colony/domain/traits.ts`

```ts
import type { TraitId } from './types';

export interface TraitDef {
  id: TraitId;
  name: string;
  desc: string;
  /** Множитель скорости любой работы. */
  workSpeed: number;
  /** Сдвиг к стартовому здоровью. */
  healthMod: number;
}

export const TRAITS: Record<TraitId, TraitDef> = {
  hardworker: { id: 'hardworker', name: 'Трудоголик', desc: '+20% к скорости работы', workSpeed: 1.2, healthMod: 0 },
  lazy:       { id: 'lazy',       name: 'Ленивый',    desc: '−20% к скорости работы', workSpeed: 0.8, healthMod: 0 },
  frail:      { id: 'frail',      name: 'Хрупкий',    desc: 'Слабое здоровье',        workSpeed: 1.0, healthMod: -20 },
  optimist:   { id: 'optimist',   name: 'Оптимист',   desc: 'Крепкое здоровье',       workSpeed: 1.0, healthMod: +10 },
  bloodlust:  { id: 'bloodlust',  name: 'Кровожадный', desc: 'Силён в бою (Фаза 3)',  workSpeed: 1.0, healthMod: 0 },
  clumsy:     { id: 'clumsy',     name: 'Неуклюжий',  desc: '−10% к скорости работы', workSpeed: 0.9, healthMod: 0 },
};

export const TRAIT_IDS = Object.keys(TRAITS) as TraitId[];
```

- [ ] **Step 3: Создать навыки** `src/games/colony/domain/skills.ts`

```ts
import type { SkillId, Skill } from './types';

export const SKILL_IDS: SkillId[] = [
  'farming', 'woodcutting', 'building', 'research', 'cooking', 'medicine', 'shooting', 'melee',
];

export const SKILL_NAMES: Record<SkillId, string> = {
  farming: 'Земледелие', woodcutting: 'Лесорубство', building: 'Строительство',
  research: 'Исследования', cooking: 'Готовка', medicine: 'Медицина',
  shooting: 'Стрельба', melee: 'Ближний бой',
};

export const emptySkills = (): Record<SkillId, Skill> =>
  SKILL_IDS.reduce((acc, id) => {
    acc[id] = { level: 0, xp: 0 };
    return acc;
  }, {} as Record<SkillId, Skill>);

/** Множитель выработки от уровня навыка: 1.0 на 0 уровне, +8% за уровень. */
export const skillMultiplier = (level: number): number => 1 + level * 0.08;

/** Начисляет xp и поднимает уровень каждые 100 xp (кап 20). */
export function grantXp(skill: Skill, amount: number): void {
  skill.xp += amount;
  while (skill.xp >= 100 && skill.level < 20) {
    skill.xp -= 100;
    skill.level += 1;
  }
  if (skill.level >= 20) skill.xp = 0;
}

export const topSkill = (skills: Record<SkillId, Skill>): { id: SkillId; level: number } => {
  let best: SkillId = SKILL_IDS[0];
  for (const id of SKILL_IDS) if (skills[id].level > skills[best].level) best = id;
  return { id: best, level: skills[best].level };
};
```

- [ ] **Step 4: Создать баланс** `src/games/colony/data/balance.ts`

```ts
import type { BuildingType, JobType, ResourceId } from '../domain/types';

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
  farm: { wood: 20 },
  bedroom: { wood: 25 },
  storage: { wood: 15 },
  lab: { wood: 35 },
};

export const BUILD_REQUIRED: Record<BuildingType, number> = {
  farm: 30, bedroom: 35, storage: 25, lab: 45,
};

export const BUILDING_WORK_SLOTS: Record<BuildingType, number> = {
  farm: 3, bedroom: 0, storage: 0, lab: 2,
};

export const BUILDING_JOB: Record<BuildingType, JobType | undefined> = {
  farm: 'farm', lab: 'research', bedroom: undefined, storage: undefined,
};

export const WIN_DAY_STUB = 12;       // заглушка победы (реальный арк — Фаза 4)

export const COLONIST_NAMES = [
  'Ada', 'Bo', 'Cy', 'Dax', 'Eli', 'Fen', 'Gio', 'Hana', 'Ivo', 'Juno',
  'Kai', 'Lux', 'Mira', 'Nox', 'Ory', 'Pax', 'Quill', 'Rhea', 'Sol', 'Tia',
];
```

- [ ] **Step 5: Smoke-тест типов** `tests/colony.types.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { TRAITS, TRAIT_IDS } from '@/games/colony/domain/traits';
import { SKILL_IDS, emptySkills, grantXp, skillMultiplier } from '@/games/colony/domain/skills';

describe('domain primitives', () => {
  it('exposes every trait by its id', () => {
    for (const id of TRAIT_IDS) expect(TRAITS[id].id).toBe(id);
  });

  it('starts every skill at level 0', () => {
    const s = emptySkills();
    expect(SKILL_IDS.every((id) => s[id].level === 0 && s[id].xp === 0)).toBe(true);
  });

  it('levels a skill every 100 xp', () => {
    const s = emptySkills();
    grantXp(s.farming, 250);
    expect(s.farming.level).toBe(2);
    expect(s.farming.xp).toBe(50);
  });

  it('skill multiplier grows with level', () => {
    expect(skillMultiplier(0)).toBeCloseTo(1.0, 5);
    expect(skillMultiplier(5)).toBeCloseTo(1.4, 5);
  });
});
```

- [ ] **Step 6: Прогнать тест и typecheck**

Run: `npx vitest run tests/colony.types.test.ts` → Expected: PASS (4 теста).
Run: `npm run typecheck` → Expected: без ошибок в новых файлах.

- [ ] **Step 7: Commit**

```bash
git add src/games/colony/domain/types.ts src/games/colony/domain/traits.ts src/games/colony/domain/skills.ts src/games/colony/data/balance.ts tests/colony.types.test.ts
git commit -m "feat(colony): phase0 domain model, traits, skills, balance"
```

---

## Task 2: Помощники сетки (`grid.ts`)

**Files:**
- Create: `src/games/colony/systems/grid.ts`
- Test: `tests/colony.grid.test.ts`

- [ ] **Step 1: Написать падающий тест** `tests/colony.grid.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { idx, inBounds, tileAt, neighbors4 } from '@/games/colony/systems/grid';
import type { Tile } from '@/games/colony/domain/types';

const grid = (w: number, h: number): { w: number; h: number; tiles: Tile[] } => {
  const tiles: Tile[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      tiles.push({ x, y, terrain: 'grass', fertility: 0.5, passable: true });
  return { w, h, tiles };
};

describe('grid helpers', () => {
  it('maps (x,y) to a flat index', () => {
    expect(idx(3, 2, 10)).toBe(23);
  });

  it('detects bounds', () => {
    const g = grid(5, 5);
    expect(inBounds(0, 0, g)).toBe(true);
    expect(inBounds(4, 4, g)).toBe(true);
    expect(inBounds(-1, 0, g)).toBe(false);
    expect(inBounds(5, 0, g)).toBe(false);
  });

  it('returns the tile at coordinates and undefined out of bounds', () => {
    const g = grid(5, 5);
    expect(tileAt(2, 1, g)?.y).toBe(1);
    expect(tileAt(9, 9, g)).toBeUndefined();
  });

  it('returns 4-neighbours within bounds', () => {
    const g = grid(5, 5);
    expect(neighbors4(0, 0, g)).toEqual([{ x: 1, y: 0 }, { x: 0, y: 1 }]);
    expect(neighbors4(2, 2, g)).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Прогнать — убедиться, что падает**

Run: `npx vitest run tests/colony.grid.test.ts` → Expected: FAIL («does not provide an export named 'idx'»).

- [ ] **Step 3: Реализовать** `src/games/colony/systems/grid.ts`

```ts
import type { Pt, Tile } from '../domain/types';

export type Grid = { w: number; h: number; tiles: Tile[] };

export const idx = (x: number, y: number, w: number): number => y * w + x;

export const inBounds = (x: number, y: number, g: Grid): boolean =>
  x >= 0 && y >= 0 && x < g.w && y < g.h;

export const tileAt = (x: number, y: number, g: Grid): Tile | undefined =>
  inBounds(x, y, g) ? g.tiles[idx(x, y, g.w)] : undefined;

const DIRS: Pt[] = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

export function neighbors4(x: number, y: number, g: Grid): Pt[] {
  const out: Pt[] = [];
  for (const d of DIRS) {
    const nx = x + d.x;
    const ny = y + d.y;
    if (inBounds(nx, ny, g)) out.push({ x: nx, y: ny });
  }
  return out;
}
```

> Примечание: порядок в `neighbors4(0,0)` — сначала `+x`, затем `+y` (соответствует тесту), потому что `-x`/`-y` вне границ.

- [ ] **Step 4: Прогнать — PASS**

Run: `npx vitest run tests/colony.grid.test.ts` → Expected: PASS (4).

- [ ] **Step 5: Commit**

```bash
git add src/games/colony/systems/grid.ts tests/colony.grid.test.ts
git commit -m "feat(colony): grid helpers"
```

---

## Task 3: Поиск пути A* (`pathfinding.ts`)

**Files:**
- Create: `src/games/colony/systems/pathfinding.ts`
- Test: `tests/colony.pathfinding.test.ts`

- [ ] **Step 1: Написать падающий тест** `tests/colony.pathfinding.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { findPath } from '@/games/colony/systems/pathfinding';
import type { Tile } from '@/games/colony/domain/types';

const grid = (w: number, h: number, blocked: [number, number][] = []) => {
  const set = new Set(blocked.map(([x, y]) => `${x},${y}`));
  const tiles: Tile[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      tiles.push({ x, y, terrain: 'grass', fertility: 0.5, passable: !set.has(`${x},${y}`) });
  return { w, h, tiles };
};

describe('A* pathfinding', () => {
  it('finds a straight path on open ground', () => {
    const g = grid(5, 1);
    const path = findPath(g, { x: 0, y: 0 }, { x: 4, y: 0 });
    expect(path).not.toBeNull();
    expect(path!.at(-1)).toEqual({ x: 4, y: 0 });
    expect(path![0]).toEqual({ x: 1, y: 0 }); // стартовая клетка исключена
    expect(path!).toHaveLength(4);
  });

  it('routes around an obstacle', () => {
    // Стена по x=2, кроме (2,2) — путь обязан пройти через щель.
    const g = grid(5, 5, [[2, 0], [2, 1], [2, 3], [2, 4]]);
    const path = findPath(g, { x: 0, y: 0 }, { x: 4, y: 0 });
    expect(path).not.toBeNull();
    expect(path!.some((p) => p.x === 2 && p.y === 2)).toBe(true);
  });

  it('returns null when target is unreachable', () => {
    const g = grid(3, 3, [[1, 0], [1, 1], [1, 2]]); // стена делит карту
    expect(findPath(g, { x: 0, y: 0 }, { x: 2, y: 0 })).toBeNull();
  });

  it('returns an empty path when start equals goal', () => {
    const g = grid(3, 3);
    expect(findPath(g, { x: 1, y: 1 }, { x: 1, y: 1 })).toEqual([]);
  });
});
```

- [ ] **Step 2: Прогнать — FAIL**

Run: `npx vitest run tests/colony.pathfinding.test.ts` → Expected: FAIL (нет экспорта `findPath`).

- [ ] **Step 3: Реализовать** `src/games/colony/systems/pathfinding.ts`

```ts
import type { Pt } from '../domain/types';
import { type Grid, idx, neighbors4, tileAt } from './grid';

const key = (x: number, y: number) => y * 100000 + x;
const manhattan = (ax: number, ay: number, bx: number, by: number) =>
  Math.abs(ax - bx) + Math.abs(ay - by);

/**
 * A* по 4-связной сетке. Возвращает список путевых точек БЕЗ стартовой клетки
 * (включая цель), пустой массив если старт == цель, или null если пути нет.
 * Целевая клетка может быть непроходимой (чтобы можно было дойти «к» зданию):
 * соседи цели проверяются на проходимость, сама цель — допустима как финал.
 */
export function findPath(g: Grid, start: Pt, goal: Pt): Pt[] | null {
  if (start.x === goal.x && start.y === goal.y) return [];

  const open: { x: number; y: number; f: number }[] = [{ x: start.x, y: start.y, f: 0 }];
  const came = new Map<number, number>();
  const gScore = new Map<number, number>([[key(start.x, start.y), 0]]);

  while (open.length) {
    // Извлечь узел с минимальным f (линейный поиск — сетка мала).
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];

    if (cur.x === goal.x && cur.y === goal.y) return reconstruct(came, start, goal);

    const cg = gScore.get(key(cur.x, cur.y)) ?? Infinity;
    for (const n of neighbors4(cur.x, cur.y, g)) {
      const isGoal = n.x === goal.x && n.y === goal.y;
      const tile = tileAt(n.x, n.y, g);
      if (!isGoal && (!tile || !tile.passable)) continue; // в цель можно войти даже если непроходима
      const nk = key(n.x, n.y);
      const tentative = cg + 1;
      if (tentative < (gScore.get(nk) ?? Infinity)) {
        came.set(nk, key(cur.x, cur.y));
        gScore.set(nk, tentative);
        const f = tentative + manhattan(n.x, n.y, goal.x, goal.y);
        const existing = open.find((o) => o.x === n.x && o.y === n.y);
        if (existing) existing.f = Math.min(existing.f, f);
        else open.push({ x: n.x, y: n.y, f });
      }
    }
  }
  return null;
}

function reconstruct(came: Map<number, number>, start: Pt, goal: Pt): Pt[] {
  const path: Pt[] = [];
  let ck = key(goal.x, goal.y);
  const startK = key(start.x, start.y);
  while (ck !== startK) {
    path.push({ x: ck % 100000, y: Math.floor(ck / 100000) });
    const prev = came.get(ck);
    if (prev === undefined) break;
    ck = prev;
  }
  path.reverse();
  return path;
}

export { idx } from './grid';
```

- [ ] **Step 4: Прогнать — PASS**

Run: `npx vitest run tests/colony.pathfinding.test.ts` → Expected: PASS (4).

- [ ] **Step 5: Commit**

```bash
git add src/games/colony/systems/pathfinding.ts tests/colony.pathfinding.test.ts
git commit -m "feat(colony): A* pathfinding"
```

---

## Task 4: Генерация мира и колонистов (`createColony.ts`)

**Files:**
- Create: `src/games/colony/domain/createColony.ts` (заменит старый — старый пока не трогаем, новый кладём рядом и переключаемся в Задаче 12; но имя файла то же, поэтому **сначала** переименуй старый: см. Step 0)
- Test: `tests/colony.createColony.test.ts`

- [ ] **Step 0: Сохранить старый генератор под временным именем**

```bash
git mv src/games/colony/domain/createColony.ts src/games/colony/domain/createColony.legacy.ts
```

Затем обнови импорт в старом коде, чтобы сборка не падала:
- `src/games/colony/systems/simulation.ts` — заменить `from '../domain/createColony'` на `from '../domain/createColony.legacy'`.
- `src/games/colony/scenes/WorldScene.ts` — заменить `from '../domain/createColony'` на `from '../domain/createColony.legacy'`.
- `src/games/colony/ColonyGameModule.ts` — заменить `from './domain/createColony'` на `from './domain/createColony.legacy'`.
- `tests/colony.test.ts` — заменить `from '@/games/colony/domain/createColony'` на `from '@/games/colony/domain/createColony.legacy'`.

Run: `npm run typecheck` → Expected: без ошибок. Run: `npm test` → Expected: старые тесты зелёные.

- [ ] **Step 1: Написать падающий тест** `tests/colony.createColony.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { START_COLONISTS, MAP_W, MAP_H } from '@/games/colony/data/balance';

describe('createColony', () => {
  it('is deterministic for a given seed', () => {
    const a = createColony(999);
    const b = createColony(999);
    expect(a.map.tiles.map((t) => t.terrain)).toEqual(b.map.tiles.map((t) => t.terrain));
  });

  it('spawns the starting colonists with names, traits and skills', () => {
    const s = createColony(1);
    expect(s.colonists).toHaveLength(START_COLONISTS);
    for (const c of s.colonists) {
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.traits.length).toBeGreaterThanOrEqual(1);
      expect(c.alive).toBe(true);
      expect(c.task).toBe('idle');
      expect(c.skills.farming).toBeDefined();
    }
  });

  it('keeps the central spawn area passable grass', () => {
    const s = createColony(3);
    const cx = Math.floor(MAP_W / 2);
    const cy = Math.floor(MAP_H / 2);
    const center = s.map.tiles[cy * MAP_W + cx];
    expect(center.terrain).toBe('grass');
    expect(center.passable).toBe(true);
  });

  it('marks water and rock impassable, forest carries wood', () => {
    const s = createColony(5);
    for (const t of s.map.tiles) {
      if (t.terrain === 'water' || t.terrain === 'rock') expect(t.passable).toBe(false);
      if (t.terrain === 'forest') expect(t.wood ?? 0).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Прогнать — FAIL**

Run: `npx vitest run tests/colony.createColony.test.ts` → Expected: FAIL (нет нового `createColony`).

- [ ] **Step 3: Реализовать** `src/games/colony/domain/createColony.ts`

```ts
import { Rng } from '@/core/utils/rng';
import { makeId } from '@/core/utils';
import type { Colonist, ColonyState, JobType, Terrain, Tile, TraitId } from './types';
import { emptySkills } from './skills';
import { TRAIT_IDS } from './traits';
import { COLONIST_NAMES, MAP_W, MAP_H, START_COLONISTS, START_RESOURCES } from '../data/balance';

const JOB_TYPES: JobType[] = ['farm', 'woodcut', 'research', 'build'];

function genTile(rng: Rng, x: number, y: number): Tile {
  const r = rng.next();
  let terrain: Terrain = 'grass';
  if (r > 0.85) terrain = 'water';
  else if (r > 0.7) terrain = 'rock';
  else if (r > 0.4) terrain = 'forest';
  const passable = terrain !== 'water' && terrain !== 'rock';
  const fertility = terrain === 'grass' ? 0.4 + rng.next() * 0.6 : 0.2 + rng.next() * 0.3;
  const tile: Tile = { x, y, terrain, fertility, passable };
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
        tiles.push({ x, y, terrain: 'grass', fertility: 0.6, passable: true });
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
      needs: { hunger: 10 + rng.int(0, 10), fatigue: 10 + rng.int(0, 10) },
      health: 100,
      priorities: startingPriorities(rng),
      pos: { x: cx + (i - 2) * 0.6, y: cy },
      task: 'idle',
      path: [],
      alive: true,
    } satisfies Colonist;
  });

  return {
    version: 3,
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
    log: [{ day: 1, text: 'Колония основана. Удачи.', tone: 'neutral' }],
    flags: { gameOver: false, victory: false },
  };
}
```

> `startingPriorities` принимает `rng` для будущей вариации, но пока детерминирован — это нормально (параметр оставлен для Фазы 4). Если линтер ругается на неиспользуемый параметр, переименуй в `_rng`.

- [ ] **Step 4: Прогнать — PASS + typecheck**

Run: `npx vitest run tests/colony.createColony.test.ts` → Expected: PASS (4).
Run: `npm run typecheck` → Expected: без ошибок.

- [ ] **Step 5: Commit**

```bash
git add src/games/colony/domain/createColony.ts src/games/colony/domain/createColony.legacy.ts tests/colony.createColony.test.ts src/games/colony/systems/simulation.ts src/games/colony/scenes/WorldScene.ts src/games/colony/ColonyGameModule.ts tests/colony.test.ts
git commit -m "feat(colony): new world+colonist generation; isolate legacy generator"
```

---

## Task 5: Система нужд (`needs.ts`)

**Files:**
- Create: `src/games/colony/systems/needs.ts`
- Test: `tests/colony.needs.test.ts`

Отвечает за: декей `hunger`/`fatigue`; разрешение задач `eat`/`sleep`; прерывание работы при критических нуждах (поиск еды/кровати); голодание→урон здоровью; реген здоровья.

- [ ] **Step 1: Написать падающий тест** `tests/colony.needs.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { runNeeds } from '@/games/colony/systems/needs';
import { HUNGER_EAT_THRESHOLD } from '@/games/colony/data/balance';

describe('needs system', () => {
  it('increases hunger and fatigue over time', () => {
    const s = createColony(1);
    const c = s.colonists[0];
    c.needs.hunger = 0;
    c.needs.fatigue = 0;
    runNeeds(s);
    expect(c.needs.hunger).toBeGreaterThan(0);
    expect(c.needs.fatigue).toBeGreaterThan(0);
  });

  it('sends a starving idle colonist to eat when food is available', () => {
    const s = createColony(1);
    s.resources.food.amount = 100;
    const c = s.colonists[0];
    c.task = 'idle';
    c.needs.hunger = HUNGER_EAT_THRESHOLD + 5;
    runNeeds(s);
    expect(['goto_eat', 'eat']).toContain(c.task);
  });

  it('consuming a meal clears hunger and spends food', () => {
    const s = createColony(1);
    s.resources.food.amount = 50;
    const c = s.colonists[0];
    c.task = 'eat';
    c.needs.hunger = 90;
    runNeeds(s);
    expect(c.needs.hunger).toBe(0);
    expect(s.resources.food.amount).toBeLessThan(50);
    expect(c.task).toBe('idle');
  });

  it('damages health while hunger is maxed and food is gone', () => {
    const s = createColony(1);
    s.resources.food.amount = 0;
    const c = s.colonists[0];
    c.needs.hunger = 100;
    const before = c.health;
    runNeeds(s);
    expect(c.health).toBeLessThan(before);
  });
});
```

- [ ] **Step 2: Прогнать — FAIL**

Run: `npx vitest run tests/colony.needs.test.ts` → Expected: FAIL (нет `runNeeds`).

- [ ] **Step 3: Реализовать** `src/games/colony/systems/needs.ts`

```ts
import { clamp } from '@/core/utils';
import type { Building, Colonist, ColonyState, Pt } from '../domain/types';
import {
  FATIGUE_PER_TICK, FATIGUE_SLEEP_THRESHOLD, FOOD_PER_MEAL,
  HEALTH_REGEN_PER_TICK, HUNGER_EAT_THRESHOLD, HUNGER_PER_TICK,
  SLEEP_RECOVERY_PER_TICK, SLEEP_WAKE_FATIGUE, STARVE_DAMAGE_PER_TICK,
} from '../data/balance';
import { findPath } from './pathfinding';

const tileOf = (c: Colonist): Pt => ({ x: Math.round(c.pos.x), y: Math.round(c.pos.y) });

function nearestBuilding(s: ColonyState, from: Pt, type: Building['type']): Building | undefined {
  let best: Building | undefined;
  let bestD = Infinity;
  for (const b of s.buildings) {
    if (b.type !== type || !b.built) continue;
    const d = Math.abs(b.tile.x - from.x) + Math.abs(b.tile.y - from.y);
    if (d < bestD) { bestD = d; best = b; }
  }
  return best;
}

function routeTo(s: ColonyState, c: Colonist, target: Pt, task: Colonist['task']): void {
  const path = findPath(s.map, tileOf(c), target);
  if (path === null) return; // недостижимо — остаёмся как есть
  c.targetTile = target;
  c.path = path;
  c.task = task;
}

/** Декей нужд + разрешение eat/sleep + прерывания. Без RNG (детерминирован). */
export function runNeeds(s: ColonyState): void {
  for (const c of s.colonists) {
    if (!c.alive) continue;

    // 1) Декей.
    c.needs.hunger = clamp(c.needs.hunger + HUNGER_PER_TICK, 0, 100);
    c.needs.fatigue = clamp(c.needs.fatigue + FATIGUE_PER_TICK, 0, 100);

    // 2) Разрешение текущих «need»-задач.
    if (c.task === 'eat') {
      if (s.resources.food.amount >= FOOD_PER_MEAL) {
        s.resources.food.amount -= FOOD_PER_MEAL;
        c.needs.hunger = 0;
      }
      c.task = 'idle';
      c.targetBuildingId = undefined;
      c.targetTile = undefined;
      continue;
    }
    if (c.task === 'sleep') {
      c.needs.fatigue = clamp(c.needs.fatigue - SLEEP_RECOVERY_PER_TICK, 0, 100);
      if (c.needs.fatigue <= SLEEP_WAKE_FATIGUE) {
        c.task = 'idle';
        c.targetTile = undefined;
      }
      continue;
    }

    // 3) Голодание → урон/реген здоровья.
    if (c.needs.hunger >= 100 && s.resources.food.amount < FOOD_PER_MEAL) {
      c.health = clamp(c.health - STARVE_DAMAGE_PER_TICK, 0, 100);
      if (c.health <= 0) {
        c.alive = false;
        s.log.push({ day: s.day, text: `${c.name} умер(ла) от голода.`, tone: 'bad' });
        continue;
      }
    } else if (c.health < 100) {
      c.health = clamp(c.health + HEALTH_REGEN_PER_TICK, 0, 100);
    }

    // 4) Прерывания: не трогаем уже идущих есть/спать.
    if (c.task === 'goto_eat' || c.task === 'goto_sleep') continue;

    const hungry = c.needs.hunger >= HUNGER_EAT_THRESHOLD;
    const tired = c.needs.fatigue >= FATIGUE_SLEEP_THRESHOLD;
    if (!hungry && !tired) continue;

    if (hungry && s.resources.food.amount >= FOOD_PER_MEAL) {
      const storage = nearestBuilding(s, tileOf(c), 'storage');
      if (storage) routeTo(s, c, storage.tile, 'goto_eat');
      else c.task = 'eat'; // склада нет — едим на месте (разрешится в следующий тик)
    } else if (tired) {
      const bed = nearestBuilding(s, tileOf(c), 'bedroom');
      if (bed) routeTo(s, c, bed.tile, 'goto_sleep');
      else c.task = 'sleep'; // спим на месте
    }
  }
}
```

- [ ] **Step 4: Прогнать — PASS**

Run: `npx vitest run tests/colony.needs.test.ts` → Expected: PASS (4).

- [ ] **Step 5: Commit**

```bash
git add src/games/colony/systems/needs.ts tests/colony.needs.test.ts
git commit -m "feat(colony): needs system (hunger/fatigue, eat/sleep, starvation)"
```

---

## Task 6: Планировщик работ (`jobScheduler.ts`) + здания

**Files:**
- Create: `src/games/colony/data/buildings.ts`
- Create: `src/games/colony/systems/jobScheduler.ts`
- Test: `tests/colony.jobs.test.ts`

Отвечает за: назначение свободным (`idle`) колонистам работы с наивысшим приоритетом, для которой есть доступная цель и свободный слот; построение пути; установка `task='goto_work'`.

- [ ] **Step 1: Определения зданий** `src/games/colony/data/buildings.ts`

```ts
import type { BuildingType } from '../domain/types';
import { BUILDING_JOB, BUILDING_WORK_SLOTS } from './balance';

export const BUILDABLE: BuildingType[] = ['farm', 'bedroom', 'storage', 'lab'];

export const BUILDING_LABEL: Record<BuildingType, string> = {
  farm: 'Ферма', bedroom: 'Спальня', storage: 'Склад', lab: 'Лаборатория',
};

export const buildingJob = (t: BuildingType) => BUILDING_JOB[t];
export const buildingSlots = (t: BuildingType) => BUILDING_WORK_SLOTS[t];
```

- [ ] **Step 2: Написать падающий тест** `tests/colony.jobs.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { runJobScheduler } from '@/games/colony/systems/jobScheduler';
import type { Building } from '@/games/colony/domain/types';
import { MAP_W, MAP_H } from '@/games/colony/data/balance';

const farmAt = (x: number, y: number): Building => ({
  id: 'farm1', type: 'farm', tile: { x, y }, workSlots: 3, jobType: 'farm',
  built: true, buildProgress: 30, buildRequired: 30,
});

describe('job scheduler', () => {
  it('assigns an idle colonist to an available farm', () => {
    const s = createColony(1);
    const cx = Math.floor(MAP_W / 2);
    const cy = Math.floor(MAP_H / 2);
    s.buildings.push(farmAt(cx + 1, cy));
    s.colonists.forEach((c) => { c.task = 'idle'; c.priorities.farm = 3; });
    runJobScheduler(s);
    const working = s.colonists.filter((c) => c.targetBuildingId === 'farm1');
    expect(working.length).toBeGreaterThan(0);
    expect(working[0].task).toBe('goto_work');
  });

  it('never assigns more workers than the building has slots', () => {
    const s = createColony(1);
    const cx = Math.floor(MAP_W / 2);
    const cy = Math.floor(MAP_H / 2);
    s.buildings.push(farmAt(cx + 1, cy));
    s.colonists.forEach((c) => { c.task = 'idle'; c.priorities.farm = 3; c.priorities.woodcut = 0; c.priorities.research = 0; c.priorities.build = 0; });
    runJobScheduler(s);
    expect(s.colonists.filter((c) => c.targetBuildingId === 'farm1').length).toBeLessThanOrEqual(3);
  });

  it('skips colonists whose only job priority is 0', () => {
    const s = createColony(1);
    s.colonists.forEach((c) => {
      c.task = 'idle';
      c.priorities.farm = 0; c.priorities.woodcut = 0; c.priorities.research = 0; c.priorities.build = 0;
    });
    runJobScheduler(s);
    expect(s.colonists.every((c) => c.task === 'idle')).toBe(true);
  });
});
```

- [ ] **Step 3: Прогнать — FAIL**

Run: `npx vitest run tests/colony.jobs.test.ts` → Expected: FAIL (нет `runJobScheduler`).

- [ ] **Step 4: Реализовать** `src/games/colony/systems/jobScheduler.ts`

```ts
import type { Building, Colonist, ColonyState, JobType, Pt, Tile } from '../domain/types';
import { findPath } from './pathfinding';
import { tileAt } from './grid';

const tileOf = (c: Colonist): Pt => ({ x: Math.round(c.pos.x), y: Math.round(c.pos.y) });
const dist = (a: Pt, b: Pt) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** Сколько колонистов уже закреплено за зданием (идут или работают). */
function workersOn(s: ColonyState, buildingId: string): number {
  return s.colonists.filter(
    (c) => c.alive && c.targetBuildingId === buildingId && (c.task === 'goto_work' || c.task === 'work'),
  ).length;
}

/** Доступная цель для конкретного типа работы или null. */
function findTarget(s: ColonyState, from: Pt, job: JobType): { tile: Pt; buildingId?: string } | null {
  if (job === 'farm' || job === 'research') {
    let best: Building | undefined;
    let bestD = Infinity;
    for (const b of s.buildings) {
      if (!b.built || b.jobType !== job) continue;
      if (workersOn(s, b.id) >= b.workSlots) continue;
      const d = dist(from, b.tile);
      if (d < bestD) { bestD = d; best = b; }
    }
    return best ? { tile: best.tile, buildingId: best.id } : null;
  }
  if (job === 'build') {
    let best: Building | undefined;
    let bestD = Infinity;
    for (const b of s.buildings) {
      if (b.built) continue;
      if (workersOn(s, b.id) >= 1) continue; // одно блюпринт — один строитель (Фаза 0)
      const d = dist(from, b.tile);
      if (d < bestD) { bestD = d; best = b; }
    }
    return best ? { tile: best.tile, buildingId: best.id } : null;
  }
  if (job === 'woodcut') {
    let best: Tile | undefined;
    let bestD = Infinity;
    for (const t of s.map.tiles) {
      if (t.terrain !== 'forest' || (t.wood ?? 0) <= 0) continue;
      const d = dist(from, t);
      if (d < bestD) { bestD = d; best = t; }
    }
    return best ? { tile: { x: best.x, y: best.y } } : null;
  }
  return null;
}

const JOB_ORDER: JobType[] = ['build', 'farm', 'woodcut', 'research'];

/** Назначает работу всем idle-колонистам по убыванию приоритета. Без RNG. */
export function runJobScheduler(s: ColonyState): void {
  for (const c of s.colonists) {
    if (!c.alive || c.task !== 'idle') continue;

    // Список типов работ, отсортированный по приоритету (выше — раньше),
    // при равенстве — фиксированный JOB_ORDER (детерминизм).
    const jobs = JOB_ORDER
      .filter((j) => (c.priorities[j] ?? 0) > 0)
      .sort((a, b) => (c.priorities[b] - c.priorities[a]) || (JOB_ORDER.indexOf(a) - JOB_ORDER.indexOf(b)));

    const from = tileOf(c);
    for (const job of jobs) {
      const target = findTarget(s, from, job);
      if (!target) continue;
      const path = findPath(s.map, from, target.tile);
      if (path === null) continue;
      c.targetTile = target.tile;
      c.targetBuildingId = target.buildingId;
      c.path = path;
      c.task = 'goto_work';
      break;
    }
  }
}

export { tileAt };
```

- [ ] **Step 5: Прогнать — PASS**

Run: `npx vitest run tests/colony.jobs.test.ts` → Expected: PASS (3).

- [ ] **Step 6: Commit**

```bash
git add src/games/colony/data/buildings.ts src/games/colony/systems/jobScheduler.ts tests/colony.jobs.test.ts
git commit -m "feat(colony): job scheduler + building defs"
```

---

## Task 7: Движение и переходы задач (`agent.ts`)

**Files:**
- Create: `src/games/colony/systems/agent.ts`
- Test: `tests/colony.agent.test.ts`

Отвечает за: продвижение колониста по `path` для задач `goto_*`; по прибытии — переход в `work`/`eat`/`sleep`.

- [ ] **Step 1: Написать падающий тест** `tests/colony.agent.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { stepAgents } from '@/games/colony/systems/agent';

describe('agent movement', () => {
  it('advances a colonist along its path and arrives at work', () => {
    const s = createColony(1);
    const c = s.colonists[0];
    c.task = 'goto_work';
    c.pos = { x: 0, y: 0 };
    c.path = [{ x: 1, y: 0 }, { x: 2, y: 0 }];
    // Прогоняем достаточно тиков, чтобы дойти.
    for (let i = 0; i < 100 && c.task === 'goto_work'; i++) stepAgents(s);
    expect(c.task).toBe('work');
    expect(c.path).toHaveLength(0);
    expect(Math.round(c.pos.x)).toBe(2);
  });

  it('transitions goto_eat -> eat on arrival', () => {
    const s = createColony(1);
    const c = s.colonists[0];
    c.task = 'goto_eat';
    c.pos = { x: 0, y: 0 };
    c.path = [{ x: 1, y: 0 }];
    for (let i = 0; i < 100 && c.task === 'goto_eat'; i++) stepAgents(s);
    expect(c.task).toBe('eat');
  });

  it('does nothing for idle/working colonists', () => {
    const s = createColony(1);
    const c = s.colonists[0];
    c.task = 'work';
    const pos = { ...c.pos };
    stepAgents(s);
    expect(c.pos).toEqual(pos);
  });
});
```

- [ ] **Step 2: Прогнать — FAIL**

Run: `npx vitest run tests/colony.agent.test.ts` → Expected: FAIL (нет `stepAgents`).

- [ ] **Step 3: Реализовать** `src/games/colony/systems/agent.ts`

```ts
import type { Colonist, ColonyState, TaskKind } from '../domain/types';
import { ARRIVE_EPS, MOVE_SPEED } from '../data/balance';

const ARRIVAL: Partial<Record<TaskKind, TaskKind>> = {
  goto_work: 'work',
  goto_eat: 'eat',
  goto_sleep: 'sleep',
};

function advance(c: Colonist): void {
  if (c.path.length === 0) return;
  const next = c.path[0];
  const dx = next.x - c.pos.x;
  const dy = next.y - c.pos.y;
  const d = Math.hypot(dx, dy);
  if (d <= MOVE_SPEED + ARRIVE_EPS) {
    c.pos = { x: next.x, y: next.y };
    c.path.shift();
  } else {
    c.pos = { x: c.pos.x + (dx / d) * MOVE_SPEED, y: c.pos.y + (dy / d) * MOVE_SPEED };
  }
}

/** Двигает идущих колонистов; по достижении цели переключает задачу. Без RNG. */
export function stepAgents(s: ColonyState): void {
  for (const c of s.colonists) {
    if (!c.alive) continue;
    if (c.task !== 'goto_work' && c.task !== 'goto_eat' && c.task !== 'goto_sleep') continue;
    advance(c);
    if (c.path.length === 0) {
      c.task = ARRIVAL[c.task] ?? 'idle';
    }
  }
}
```

- [ ] **Step 4: Прогнать — PASS**

Run: `npx vitest run tests/colony.agent.test.ts` → Expected: PASS (3).

- [ ] **Step 5: Commit**

```bash
git add src/games/colony/systems/agent.ts tests/colony.agent.test.ts
git commit -m "feat(colony): agent movement + task transitions"
```

---

## Task 8: Система работы (`work.ts`)

**Files:**
- Create: `src/games/colony/systems/work.ts`
- Test: `tests/colony.work.test.ts`

Отвечает за: применение работы для задачи `work` — урожай/наука/рубка/стройка, начисление xp, влияние навыка/черт/террейна, завершение (лес истощился / блюпринт построен).

- [ ] **Step 1: Написать падающий тест** `tests/colony.work.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { runWork } from '@/games/colony/systems/work';
import type { Building } from '@/games/colony/domain/types';
import { MAP_W, MAP_H } from '@/games/colony/data/balance';

const center = () => ({ x: Math.floor(MAP_W / 2), y: Math.floor(MAP_H / 2) });

describe('work system', () => {
  it('a farmer working at a farm raises food and gains farming xp', () => {
    const s = createColony(1);
    const t = center();
    const farm: Building = { id: 'f1', type: 'farm', tile: t, workSlots: 3, jobType: 'farm', built: true, buildProgress: 30, buildRequired: 30 };
    s.buildings.push(farm);
    s.map.tiles[t.y * MAP_W + t.x].buildingId = 'f1';
    const c = s.colonists[0];
    c.task = 'work'; c.targetBuildingId = 'f1'; c.targetTile = t; c.pos = { ...t };
    const food0 = s.resources.food.amount;
    const xp0 = c.skills.farming.xp + c.skills.farming.level * 100;
    runWork(s);
    expect(s.resources.food.amount).toBeGreaterThan(food0);
    expect(c.skills.farming.xp + c.skills.farming.level * 100).toBeGreaterThan(xp0);
  });

  it('chopping a forest tile yields wood and depletes the tile', () => {
    const s = createColony(1);
    // Найти лесной тайл.
    const forest = s.map.tiles.find((t) => t.terrain === 'forest' && (t.wood ?? 0) > 0)!;
    const c = s.colonists[0];
    c.task = 'work'; c.targetTile = { x: forest.x, y: forest.y }; c.targetBuildingId = undefined; c.pos = { x: forest.x, y: forest.y };
    const wood0 = s.resources.wood.amount;
    const left0 = forest.wood!;
    runWork(s);
    expect(s.resources.wood.amount).toBeGreaterThan(wood0);
    expect(forest.wood!).toBeLessThan(left0);
  });

  it('builds a blueprint to completion, then it becomes built', () => {
    const s = createColony(1);
    const t = center();
    const bp: Building = { id: 'b1', type: 'storage', tile: t, workSlots: 0, jobType: undefined, built: false, buildProgress: 0, buildRequired: 5 };
    s.buildings.push(bp);
    const c = s.colonists[0];
    c.task = 'work'; c.targetBuildingId = 'b1'; c.targetTile = t; c.pos = { ...t };
    for (let i = 0; i < 200 && !bp.built; i++) runWork(s);
    expect(bp.built).toBe(true);
    expect(c.task).toBe('idle'); // освободился после стройки
  });
});
```

- [ ] **Step 2: Прогнать — FAIL**

Run: `npx vitest run tests/colony.work.test.ts` → Expected: FAIL (нет `runWork`).

- [ ] **Step 3: Реализовать** `src/games/colony/systems/work.ts`

```ts
import { clamp } from '@/core/utils';
import type { Building, Colonist, ColonyState, Tile } from '../domain/types';
import { grantXp, skillMultiplier } from '../domain/skills';
import { TRAITS } from '../domain/traits';
import {
  BUILD_BASE, FARM_BASE, RESEARCH_BASE, STORAGE_CAPACITY_BONUS,
  WOODCUT_BASE, XP_PER_WORK_TICK,
} from '../data/balance';
import { tileAt } from './grid';

const workSpeed = (c: Colonist): number =>
  c.traits.reduce((m, t) => m * (TRAITS[t]?.workSpeed ?? 1), 1);

const addResource = (s: ColonyState, id: 'food' | 'wood' | 'science', amt: number) => {
  const r = s.resources[id];
  r.amount = clamp(r.amount + amt, 0, r.capacity);
};

function finishWork(c: Colonist): void {
  c.task = 'idle';
  c.targetBuildingId = undefined;
  c.targetTile = undefined;
}

function applyStorageCapacity(s: ColonyState): void {
  const built = s.buildings.filter((b) => b.type === 'storage' && b.built).length;
  const cap = 200 + built * STORAGE_CAPACITY_BONUS;
  for (const id of ['food', 'wood', 'science'] as const) s.resources[id].capacity = cap;
}

/** Применяет работу для всех колонистов в задаче 'work'. Без RNG. */
export function runWork(s: ColonyState): void {
  for (const c of s.colonists) {
    if (!c.alive || c.task !== 'work') continue;
    const building = c.targetBuildingId
      ? s.buildings.find((b) => b.id === c.targetBuildingId)
      : undefined;

    // Стройка блюпринта.
    if (building && !building.built) {
      building.buildProgress += BUILD_BASE * skillMultiplier(c.skills.building.level) * workSpeed(c);
      grantXp(c.skills.building, XP_PER_WORK_TICK);
      if (building.buildProgress >= building.buildRequired) {
        building.built = true;
        const t = tileAt(building.tile.x, building.tile.y, s.map);
        if (t) t.buildingId = building.id;
        applyStorageCapacity(s);
        s.log.push({ day: s.day, text: `Построено: ${building.type}.`, tone: 'good' });
        finishWork(c);
      }
      continue;
    }

    // Производство в здании.
    if (building && building.built) {
      if (building.jobType === 'farm') {
        const t = tileAt(building.tile.x, building.tile.y, s.map);
        const fert = t ? 0.5 + t.fertility : 1;
        addResource(s, 'food', FARM_BASE * skillMultiplier(c.skills.farming.level) * workSpeed(c) * fert);
        grantXp(c.skills.farming, XP_PER_WORK_TICK);
      } else if (building.jobType === 'research') {
        addResource(s, 'science', RESEARCH_BASE * skillMultiplier(c.skills.research.level) * workSpeed(c));
        grantXp(c.skills.research, XP_PER_WORK_TICK);
      }
      continue;
    }

    // Рубка леса на тайле-цели.
    if (!building && c.targetTile) {
      const t: Tile | undefined = tileAt(c.targetTile.x, c.targetTile.y, s.map);
      if (t && t.terrain === 'forest' && (t.wood ?? 0) > 0) {
        const take = Math.min(t.wood!, WOODCUT_BASE * skillMultiplier(c.skills.woodcutting.level) * workSpeed(c));
        t.wood! -= take;
        addResource(s, 'wood', take);
        grantXp(c.skills.woodcutting, XP_PER_WORK_TICK);
        if (t.wood! <= 0) {
          t.terrain = 'grass';
          t.wood = undefined;
          finishWork(c); // делянка кончилась
        }
      } else {
        finishWork(c); // цель невалидна
      }
      continue;
    }

    // Нет валидной цели.
    finishWork(c);
  }
}
```

- [ ] **Step 4: Прогнать — PASS**

Run: `npx vitest run tests/colony.work.test.ts` → Expected: PASS (3).

- [ ] **Step 5: Commit**

```bash
git add src/games/colony/systems/work.ts tests/colony.work.test.ts
git commit -m "feat(colony): work system (farm/research/woodcut/build + xp)"
```

---

## Task 9: Постановка зданий кликом (`build.ts`)

**Files:**
- Create: `src/games/colony/systems/build.ts`
- Test: `tests/colony.build.test.ts`

Отвечает за: валидацию тайла, списание ресурсов, создание блюпринта (`built=false`). Сам блюпринт достраивается системой работы (Задача 7/8).

- [ ] **Step 1: Написать падающий тест** `tests/colony.build.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { canPlace, placeBlueprint } from '@/games/colony/systems/build';
import { MAP_W, MAP_H } from '@/games/colony/data/balance';

const center = () => ({ x: Math.floor(MAP_W / 2), y: Math.floor(MAP_H / 2) });

describe('build placement', () => {
  it('places a farm blueprint on valid grass and spends wood', () => {
    const s = createColony(1);
    const t = center();
    const wood0 = s.resources.wood.amount;
    const res = placeBlueprint(s, 'farm', t.x, t.y);
    expect(res.ok).toBe(true);
    expect(s.resources.wood.amount).toBeLessThan(wood0);
    const b = s.buildings.at(-1)!;
    expect(b.type).toBe('farm');
    expect(b.built).toBe(false);
  });

  it('rejects placement on water', () => {
    const s = createColony(1);
    const water = s.map.tiles.find((t) => t.terrain === 'water');
    if (!water) return; // на редком сиде воды может не быть в кадре теста
    expect(canPlace(s, water.x, water.y)).toBe(false);
    const res = placeBlueprint(s, 'farm', water.x, water.y);
    expect(res.ok).toBe(false);
  });

  it('rejects placement on an occupied tile', () => {
    const s = createColony(1);
    const t = center();
    placeBlueprint(s, 'farm', t.x, t.y);
    expect(canPlace(s, t.x, t.y)).toBe(false);
  });

  it('rejects when wood is insufficient', () => {
    const s = createColony(1);
    const t = center();
    s.resources.wood.amount = 0;
    const res = placeBlueprint(s, 'lab', t.x, t.y);
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/дерев/i);
  });
});
```

- [ ] **Step 2: Прогнать — FAIL**

Run: `npx vitest run tests/colony.build.test.ts` → Expected: FAIL (нет `placeBlueprint`).

- [ ] **Step 3: Реализовать** `src/games/colony/systems/build.ts`

```ts
import { makeId } from '@/core/utils';
import type { BuildingType, ColonyState } from '../domain/types';
import {
  BUILD_COST, BUILD_REQUIRED, BUILDING_JOB, BUILDING_WORK_SLOTS,
} from '../data/balance';
import { tileAt } from './grid';

export function canPlace(s: ColonyState, x: number, y: number): boolean {
  const t = tileAt(x, y, s.map);
  if (!t) return false;
  if (t.terrain === 'water' || t.terrain === 'rock') return false;
  if (t.buildingId) return false;
  if (s.buildings.some((b) => b.tile.x === x && b.tile.y === y)) return false;
  return true;
}

export function placeBlueprint(
  s: ColonyState,
  type: BuildingType,
  x: number,
  y: number,
): { ok: boolean; reason?: string } {
  if (!canPlace(s, x, y)) return { ok: false, reason: 'нельзя строить здесь' };
  const cost = BUILD_COST[type];
  for (const [res, amt] of Object.entries(cost) as [keyof typeof s.resources, number][]) {
    if (s.resources[res].amount < amt) {
      return { ok: false, reason: res === 'wood' ? 'мало дерева' : `мало ${res}` };
    }
  }
  for (const [res, amt] of Object.entries(cost) as [keyof typeof s.resources, number][]) {
    s.resources[res].amount -= amt;
  }
  s.buildings.push({
    id: makeId('bld'),
    type,
    tile: { x, y },
    workSlots: BUILDING_WORK_SLOTS[type],
    jobType: BUILDING_JOB[type],
    built: false,
    buildProgress: 0,
    buildRequired: BUILD_REQUIRED[type],
  });
  return { ok: true };
}
```

- [ ] **Step 4: Прогнать — PASS**

Run: `npx vitest run tests/colony.build.test.ts` → Expected: PASS (4).

- [ ] **Step 5: Commit**

```bash
git add src/games/colony/systems/build.ts tests/colony.build.test.ts
git commit -m "feat(colony): click-to-place building blueprints"
```

---

## Task 10: Оркестрация тика + день + победа/поражение (`tick.ts`)

**Files:**
- Create: `src/games/colony/systems/tick.ts`
- Test: `tests/colony.tick.test.ts`

Порядок конвейера: `needs → jobScheduler → agent → work → день/победа/поражение`.

- [ ] **Step 1: Написать падающий тест** `tests/colony.tick.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { tick } from '@/games/colony/systems/tick';
import { TICKS_PER_DAY } from '@/games/colony/data/balance';

const run = (seed: number, n: number) => {
  const s = createColony(seed);
  for (let i = 0; i < n; i++) tick(s);
  return s;
};

describe('tick orchestration', () => {
  it('rolls over a new day after TICKS_PER_DAY', () => {
    const s = createColony(1);
    for (let i = 0; i < TICKS_PER_DAY; i++) tick(s);
    expect(s.day).toBe(2);
  });

  it('is deterministic for a given seed', () => {
    const a = run(4242, TICKS_PER_DAY * 2);
    const b = run(4242, TICKS_PER_DAY * 2);
    expect(a.resources.food.amount).toBeCloseTo(b.resources.food.amount, 5);
    expect(a.resources.wood.amount).toBeCloseTo(b.resources.wood.amount, 5);
    expect(a.colonists.filter((c) => c.alive).length).toBe(b.colonists.filter((c) => c.alive).length);
    expect(a.day).toBe(b.day);
  });

  it('ends in defeat when everyone starves', () => {
    const s = createColony(7);
    s.resources.food.amount = 0;
    s.colonists.forEach((c) => { c.needs.hunger = 100; (['farm','woodcut','research','build'] as const).forEach((j) => (c.priorities[j] = 0)); });
    for (let i = 0; i < TICKS_PER_DAY * 4 && !s.flags.gameOver; i++) tick(s);
    expect(s.flags.gameOver).toBe(true);
    expect(s.flags.victory).toBe(false);
  });

  it('colonists actually move (positions change) over a day', () => {
    const s = createColony(11);
    const before = s.colonists.map((c) => `${c.pos.x.toFixed(2)},${c.pos.y.toFixed(2)}`);
    for (let i = 0; i < TICKS_PER_DAY; i++) tick(s);
    const after = s.colonists.map((c) => `${c.pos.x.toFixed(2)},${c.pos.y.toFixed(2)}`);
    expect(after).not.toEqual(before);
  });
});
```

- [ ] **Step 2: Прогнать — FAIL**

Run: `npx vitest run tests/colony.tick.test.ts` → Expected: FAIL (нет `tick`).

- [ ] **Step 3: Реализовать** `src/games/colony/systems/tick.ts`

```ts
import type { ColonyState } from '../domain/types';
import { TICKS_PER_DAY, WIN_DAY_STUB } from '../data/balance';
import { runNeeds } from './needs';
import { runJobScheduler } from './jobScheduler';
import { stepAgents } from './agent';
import { runWork } from './work';

export const alive = (s: ColonyState) => s.colonists.filter((c) => c.alive);

/** Один тик симуляции. Возвращает true, если начался новый день. */
export function tick(s: ColonyState): boolean {
  if (s.flags.gameOver) return false;
  s.tick += 1;
  s.phase = s.tick % TICKS_PER_DAY < TICKS_PER_DAY / 2 ? 'day' : 'night';

  runNeeds(s);
  runJobScheduler(s);
  stepAgents(s);
  runWork(s);

  if (s.tick % TICKS_PER_DAY === 0) {
    s.day += 1;
    onNewDay(s);
    return true;
  }
  return false;
}

function onNewDay(s: ColonyState): void {
  if (alive(s).length === 0) {
    s.flags.gameOver = true;
    s.log.push({ day: s.day, text: 'Колония вымерла. Игра окончена.', tone: 'bad' });
  } else if (s.day >= WIN_DAY_STUB) {
    s.flags.gameOver = true;
    s.flags.victory = true;
    s.log.push({ day: s.day, text: `Колония продержалась ${s.day} дней!`, tone: 'good' });
  }
  if (s.log.length > 60) s.log = s.log.slice(-60);
}
```

- [ ] **Step 4: Прогнать — PASS**

Run: `npx vitest run tests/colony.tick.test.ts` → Expected: PASS (4).

- [ ] **Step 5: Commit**

```bash
git add src/games/colony/systems/tick.ts tests/colony.tick.test.ts
git commit -m "feat(colony): tick pipeline + day rollover + win/lose stub"
```

---

## Task 11: Проекция в HUD (`projection.ts`)

**Files:**
- Create: `src/games/colony/systems/projection.ts`
- Test: `tests/colony.projection.test.ts`

- [ ] **Step 1: Написать падающий тест** `tests/colony.projection.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { computeHud } from '@/games/colony/systems/projection';
import { START_COLONISTS } from '@/games/colony/data/balance';

describe('hud projection', () => {
  it('projects population, resources and colonists', () => {
    const s = createColony(1);
    const hud = computeHud(s);
    expect(hud.population).toBe(START_COLONISTS);
    expect(hud.resources.food.amount).toBe(s.resources.food.amount);
    expect(hud.colonists).toHaveLength(START_COLONISTS);
    expect(hud.colonists[0].topSkill.level).toBeGreaterThanOrEqual(0);
  });

  it('counts only alive colonists', () => {
    const s = createColony(1);
    s.colonists[0].alive = false;
    expect(computeHud(s).population).toBe(START_COLONISTS - 1);
  });

  it('reports building counts by type', () => {
    const s = createColony(1);
    s.buildings.push({ id: 'f', type: 'farm', tile: { x: 0, y: 0 }, workSlots: 3, jobType: 'farm', built: true, buildProgress: 30, buildRequired: 30 });
    expect(computeHud(s).buildingCounts.farm).toBe(1);
  });
});
```

- [ ] **Step 2: Прогнать — FAIL**

Run: `npx vitest run tests/colony.projection.test.ts` → Expected: FAIL (нет `computeHud`).

- [ ] **Step 3: Реализовать** `src/games/colony/systems/projection.ts`

```ts
import type { BuildingType, ColonyHudState, ColonyState } from '../domain/types';
import { topSkill } from '../domain/skills';

export function computeHud(s: ColonyState): ColonyHudState {
  const alive = s.colonists.filter((c) => c.alive);
  const buildingCounts: Record<BuildingType, number> = { farm: 0, bedroom: 0, storage: 0, lab: 0 };
  for (const b of s.buildings) if (b.built) buildingCounts[b.type] += 1;

  return {
    day: s.day,
    phase: s.phase,
    speed: s.speed,
    population: alive.length,
    resources: {
      food: { ...s.resources.food },
      wood: { ...s.resources.wood },
      science: { ...s.resources.science },
    },
    colonists: alive.map((c) => ({
      id: c.id,
      name: c.name,
      traits: [...c.traits],
      task: c.task,
      hunger: Math.round(c.needs.hunger),
      fatigue: Math.round(c.needs.fatigue),
      health: Math.round(c.health),
      topSkill: topSkill(c.skills),
      priorities: { ...c.priorities },
    })),
    buildingCounts,
    log: s.log.slice(-8).reverse(),
    gameOver: s.flags.gameOver,
    victory: s.flags.victory,
  };
}
```

- [ ] **Step 4: Прогнать — PASS + typecheck**

Run: `npx vitest run tests/colony.projection.test.ts` → Expected: PASS (3).
Run: `npm run typecheck` → Expected: без ошибок.

- [ ] **Step 5: Commit**

```bash
git add src/games/colony/systems/projection.ts tests/colony.projection.test.ts
git commit -m "feat(colony): HUD projection"
```

---

## Task 12: Подключение модуля + рендер сцены (`WorldScene.ts`, `ColonyGameModule.ts`)

**Files:**
- Modify (rewrite): `src/games/colony/scenes/WorldScene.ts`
- Modify: `src/games/colony/ColonyGameModule.ts`

Здесь нет юнит-тестов (рендер/ввод) — проверка ручная через запуск приложения.

- [ ] **Step 1: Переписать сцену** `src/games/colony/scenes/WorldScene.ts`

```ts
import Phaser from 'phaser';
import type { GameContext } from '@/types/game-module';
import type { BuildingType, ColonyState, Colonist } from '../domain/types';
import { TILE } from '../data/balance';
import { tick, alive } from '../systems/tick';
import { computeHud } from '../systems/projection';
import { placeBlueprint, canPlace } from '../systems/build';
import { createColony } from '../domain/createColony';
import { randomSeed } from '@/core/utils/rng';

const TERRAIN_COLOR: Record<string, number> = {
  grass: 0x223018, forest: 0x1b2a12, rock: 0x2c2c26, water: 0x16263a,
};
const BUILDING_COLOR: Record<BuildingType, number> = {
  farm: 0x84de5a, bedroom: 0xf0a840, storage: 0xc8b88a, lab: 0x4ad0ff,
};
const BUILDING_GLYPH: Record<BuildingType, string> = { farm: 'F', bedroom: 'H', storage: 'S', lab: 'L' };
const TASK_COLOR: Record<string, number> = {
  work: 0x84de5a, goto_work: 0xbfe89a, eat: 0xf0a840, goto_eat: 0xf0c890,
  sleep: 0x6aa0ff, goto_sleep: 0x9ab8ff, idle: 0x8aa884,
};

interface Dot { go: Phaser.GameObjects.Arc; ref: Colonist; }

export class WorldScene extends Phaser.Scene {
  private state!: ColonyState;
  private ctx!: GameContext;
  private accumulator = 0;
  private emitAccum = 0;
  private readonly tickMs = 1000 / 8;
  private dots: Dot[] = [];
  private mapPxW = 0;
  private mapPxH = 0;
  private buildingLayer!: Phaser.GameObjects.Container;
  private dotLayer!: Phaser.GameObjects.Container;
  private lastBuildSig = '';
  private placingType: BuildingType | null = null;
  private ghost!: Phaser.GameObjects.Rectangle;

  constructor() { super('world'); }

  init(data: { state: ColonyState; ctx: GameContext }) {
    this.state = data.state;
    this.ctx = data.ctx;
  }

  create() {
    this.mapPxW = this.state.map.w * TILE;
    this.mapPxH = this.state.map.h * TILE;
    this.cameras.main.setBackgroundColor('#0d140c');
    this.drawMap();
    this.buildingLayer = this.add.container(0, 0);
    this.dotLayer = this.add.container(0, 0);
    this.spawnDots();

    this.ghost = this.add.rectangle(0, 0, TILE, TILE, 0xffffff, 0.25).setVisible(false);
    this.ghost.setStrokeStyle(1, 0xffffff, 0.6);

    this.fitCamera();
    this.scale.on('resize', this.fitCamera, this);

    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerdown', this.onPointerDown, this);

    this.ctx.events.on('ui:command', this.onCommand);
    this.ctx.events.emit('game:state', computeHud(this.state));
  }

  private drawMap() {
    const g = this.add.graphics();
    for (const t of this.state.map.tiles) {
      g.fillStyle(TERRAIN_COLOR[t.terrain] ?? 0x222222, 1);
      g.fillRect(t.x * TILE, t.y * TILE, TILE - 1, TILE - 1);
    }
    g.lineStyle(1, 0x000000, 0.15);
    g.strokeRect(0, 0, this.mapPxW, this.mapPxH);
  }

  private buildSig() {
    return this.state.buildings.map((b) => `${b.id}:${b.built ? 1 : 0}`).join('|');
  }

  private syncBuildings() {
    const sig = this.buildSig();
    if (sig === this.lastBuildSig) return;
    this.lastBuildSig = sig;
    this.buildingLayer.removeAll(true);
    for (const b of this.state.buildings) {
      const x = b.tile.x * TILE;
      const y = b.tile.y * TILE;
      const rect = this.add.rectangle(x + TILE / 2, y + TILE / 2, TILE - 2, TILE - 2, BUILDING_COLOR[b.type], b.built ? 0.92 : 0.35);
      rect.setStrokeStyle(1, 0x000000, 0.3);
      const text = this.add.text(x + TILE / 2, y + TILE / 2, BUILDING_GLYPH[b.type], {
        fontFamily: 'monospace', fontSize: '12px', color: '#0d140c',
      }).setOrigin(0.5);
      this.buildingLayer.add([rect, text]);
    }
  }

  private spawnDots() {
    this.dotLayer.removeAll(true);
    this.dots = [];
    for (const c of this.state.colonists) {
      if (!c.alive) continue;
      const go = this.add.circle(c.pos.x * TILE + TILE / 2, c.pos.y * TILE + TILE / 2, 4, TASK_COLOR[c.task]);
      go.setStrokeStyle(1, 0x000000, 0.4);
      this.dotLayer.add(go);
      this.dots.push({ go, ref: c });
    }
  }

  private fitCamera = () => {
    const cam = this.cameras.main;
    const zoom = Math.min(cam.width / this.mapPxW, cam.height / this.mapPxH) * 0.92;
    cam.setZoom(Math.max(0.5, zoom));
    cam.centerOn(this.mapPxW / 2, this.mapPxH / 2);
  };

  private worldToTile(px: number, py: number) {
    const p = this.cameras.main.getWorldPoint(px, py);
    return { x: Math.floor(p.x / TILE), y: Math.floor(p.y / TILE) };
  }

  private onPointerMove = (p: Phaser.Input.Pointer) => {
    if (!this.placingType) { this.ghost.setVisible(false); return; }
    const t = this.worldToTile(p.x, p.y);
    const ok = canPlace(this.state, t.x, t.y);
    this.ghost.setPosition(t.x * TILE + TILE / 2, t.y * TILE + TILE / 2);
    this.ghost.setFillStyle(ok ? 0x84de5a : 0xff5a5a, 0.3);
    this.ghost.setVisible(true);
  };

  private onPointerDown = (p: Phaser.Input.Pointer) => {
    const t = this.worldToTile(p.x, p.y);
    if (this.placingType) {
      const res = placeBlueprint(this.state, this.placingType, t.x, t.y);
      if (!res.ok) this.ctx.events.emit('toast', { kind: 'warning', title: 'Стройка', message: res.reason });
      else this.ctx.achievements.unlock('colony.first_building');
      this.placingType = null;
      this.ghost.setVisible(false);
      this.ctx.events.emit('game:state', computeHud(this.state));
      return;
    }
    // Иначе — выбор колониста рядом с кликом.
    let best: Colonist | undefined; let bestD = 1.2;
    for (const c of this.state.colonists) {
      if (!c.alive) continue;
      const d = Math.hypot(c.pos.x - t.x, c.pos.y - t.y);
      if (d < bestD) { bestD = d; best = c; }
    }
    if (best) this.ctx.events.emit('colony:select', best.id);
  };

  private onCommand = (msg: { type: string; payload?: any }) => {
    const s = this.state;
    switch (msg.type) {
      case 'speed': s.speed = msg.payload.value; break;
      case 'placeBuilding': this.placingType = msg.payload.building as BuildingType; break;
      case 'cancelPlace': this.placingType = null; this.ghost.setVisible(false); break;
      case 'setPriority': {
        const c = s.colonists.find((x) => x.id === msg.payload.colonistId);
        if (c) c.priorities[msg.payload.job as keyof typeof c.priorities] = msg.payload.value;
        break;
      }
      case 'restart':
        this.lastBuildSig = '';
        this.scene.restart({ state: createColony(randomSeed()), ctx: this.ctx });
        return;
    }
    this.ctx.events.emit('game:state', computeHud(s));
  };

  update(_t: number, delta: number) {
    const s = this.state;
    if (!s.flags.gameOver && s.speed > 0) {
      this.accumulator += delta * s.speed;
      let safety = 0;
      while (this.accumulator >= this.tickMs && safety < 600) {
        this.accumulator -= this.tickMs;
        safety += 1;
        const newDay = tick(s);
        if (newDay) this.onNewDay();
        if (s.flags.gameOver) break;
      }
    }

    this.syncBuildings();
    if (this.dots.filter((d) => d.ref.alive).length !== alive(s).length) this.spawnDots();
    for (const d of this.dots) {
      d.go.setPosition(d.ref.pos.x * TILE + TILE / 2, d.ref.pos.y * TILE + TILE / 2);
      d.go.setFillStyle(TASK_COLOR[d.ref.task] ?? 0x8aa884);
      d.go.setAlpha(d.ref.health < 35 ? 0.45 : 0.95);
    }

    this.emitAccum += delta;
    if (this.emitAccum >= 150) {
      this.emitAccum = 0;
      this.ctx.events.emit('game:state', computeHud(s));
    }
  }

  private onNewDay() {
    const s = this.state;
    const pop = alive(s).length;
    this.ctx.achievements.progress('colony.survive_10_days', s.day);
    this.ctx.achievements.progress('colony.population_20', pop);
    this.ctx.records.set('colony.bestDay', s.day, 'max');
    this.ctx.records.set('colony.bestPop', pop, 'max');
    this.ctx.save.autosave(s, `День ${s.day} · ${pop} жит.`);

    if (s.flags.gameOver) {
      if (s.flags.victory) this.ctx.records.set('colony.victories', 1, 'inc');
      this.ctx.events.emit('game:state', computeHud(s));
      this.ctx.events.emit('toast', {
        kind: s.flags.victory ? 'success' : 'error',
        title: s.flags.victory ? 'Победа' : 'Колония пала',
        message: s.flags.victory ? `Продержались до дня ${s.day}` : `Пали на день ${s.day}`,
        icon: s.flags.victory ? '🏆' : '💀',
      });
    }
  }

  shutdown() {
    this.ctx.events.off('ui:command', this.onCommand);
    this.scale.off('resize', this.fitCamera, this);
    this.input.off('pointermove', this.onPointerMove, this);
    this.input.off('pointerdown', this.onPointerDown, this);
  }
}
```

- [ ] **Step 2: Обновить модуль** `src/games/colony/ColonyGameModule.ts`

Заменить импорты и `COLONY_PAYLOAD_VERSION`:

```ts
import Phaser from 'phaser';
import { createElement } from 'react';
import type { GameContext, GameInstance, GameModule } from '@/types/game-module';
import { randomSeed } from '@/core/utils/rng';
import { COLONY_DEFINITION } from './definition';
import type { ColonyState } from './domain/types';
import { createColony } from './domain/createColony';
import { WorldScene } from './scenes/WorldScene';
import { ColonyHud } from './ui/ColonyHud';

const COLONY_PAYLOAD_VERSION = 3;

export const colonyModule: GameModule = {
  definition: COLONY_DEFINITION,
  payloadVersion: COLONY_PAYLOAD_VERSION,

  async mount(container: HTMLElement, ctx: GameContext): Promise<GameInstance> {
    let state: ColonyState | null = null;
    if (ctx.mode === 'load') {
      const loaded = (await ctx.save.load(ctx.slot)) as ColonyState | null;
      if (loaded && loaded.version === COLONY_PAYLOAD_VERSION) state = loaded;
    }
    if (!state) state = createColony(randomSeed());

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: container,
      backgroundColor: '#0d140c',
      scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
      render: { antialias: true, pixelArt: false },
      scene: [],
    });
    game.scene.add('world', WorldScene, true, { state, ctx });

    return {
      pause() { game.scene.getScene('world')?.scene.pause(); },
      resume() { game.scene.getScene('world')?.scene.resume(); },
      destroy() { game.destroy(true); },
    };
  },

  Hud: ({ ctx }) => createElement(ColonyHud, { ctx }),
};
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck` → Expected: ошибки только из старого `ui/ColonyHud.tsx` (старый HUD ещё ссылается на удалённые типы — починим в Задаче 13). Если ошибок нет — отлично. Если есть только в `ui/ColonyHud.tsx`, продолжай.

- [ ] **Step 4: Ручная проверка (после Задачи 13)**

Пометка: запуск приложения и визуальная проверка делается в конце Задачи 13, когда HUD готов. Здесь только коммит кода сцены/модуля.

- [ ] **Step 5: Commit**

```bash
git add src/games/colony/scenes/WorldScene.ts src/games/colony/ColonyGameModule.ts
git commit -m "feat(colony): render moving agents, click placement, wire payload v3"
```

---

## Task 13: React HUD (`ColonyHud.tsx` + панели)

**Files:**
- Modify (rewrite): `src/games/colony/ui/ColonyHud.tsx`
- Create: `src/games/colony/ui/panels/BuildMenu.tsx`
- Create: `src/games/colony/ui/panels/Roster.tsx`
- Create: `src/games/colony/ui/panels/Inspector.tsx`

Проверка ручная (запуск приложения).

- [ ] **Step 1: BuildMenu** `src/games/colony/ui/panels/BuildMenu.tsx`

```tsx
import type { BuildingType } from '../../domain/types';
import { BUILD_COST } from '../../data/balance';
import { BUILDABLE, BUILDING_LABEL } from '../../data/buildings';

const GLYPH: Record<BuildingType, string> = { farm: '🌾', bedroom: '🛏️', storage: '📦', lab: '🔬' };

export function BuildMenu({ onPick }: { onPick: (b: BuildingType) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {BUILDABLE.map((b) => (
        <button
          key={b}
          onClick={() => onPick(b)}
          className="rounded-xl border border-edge/60 p-2 text-center transition-all hover:border-accent/50"
        >
          <span className="block text-lg">{GLYPH[b]}</span>
          <span className="block font-display text-[0.7rem] text-ink">{BUILDING_LABEL[b]}</span>
          <span className="block font-mono text-[0.6rem] text-muted">{BUILD_COST[b].wood ?? 0}🪵</span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Roster** `src/games/colony/ui/panels/Roster.tsx`

```tsx
import type { ColonyHudColonist } from '../../domain/types';
import { ProgressBar } from '@/ui/primitives/ProgressBar';
import { SKILL_NAMES } from '../../domain/skills';

const TASK_LABEL: Record<string, string> = {
  idle: 'свободен', goto_work: 'идёт', work: 'работает',
  goto_eat: 'идёт есть', eat: 'ест', goto_sleep: 'идёт спать', sleep: 'спит',
};

export function Roster({ colonists, onSelect }: { colonists: ColonyHudColonist[]; onSelect: (id: string) => void }) {
  return (
    <div className="space-y-1.5">
      {colonists.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c.id)}
          className="panel-inset flex w-full items-center gap-2 p-2 text-left hover:border-accent/50"
        >
          <span className="w-16 truncate font-display text-sm text-ink">{c.name}</span>
          <span className="w-20 font-mono text-[0.6rem] text-muted">{TASK_LABEL[c.task] ?? c.task}</span>
          <span className="flex-1">
            <span className="mb-0.5 block font-mono text-[0.55rem] text-muted">♥ {c.health}</span>
            <ProgressBar value={c.health / 100} tone="good" />
          </span>
          <span className="w-14 font-mono text-[0.55rem] text-muted">
            {SKILL_NAMES[c.topSkill.id].slice(0, 4)} {c.topSkill.level}
          </span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Inspector** `src/games/colony/ui/panels/Inspector.tsx`

```tsx
import type { ColonyHudColonist, JobType } from '../../domain/types';
import { ProgressBar } from '@/ui/primitives/ProgressBar';
import { TRAITS } from '../../domain/traits';
import { cx } from '@/core/utils';

const JOBS: { id: JobType; label: string }[] = [
  { id: 'build', label: 'Стройка' },
  { id: 'farm', label: 'Ферма' },
  { id: 'woodcut', label: 'Рубка' },
  { id: 'research', label: 'Наука' },
];

export function Inspector({
  colonist,
  onSetPriority,
}: {
  colonist: ColonyHudColonist;
  onSetPriority: (job: JobType, value: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="font-display text-lg text-ink">{colonist.name}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {colonist.traits.map((t) => (
            <span key={t} className="rounded-md border border-edge/60 px-1.5 py-0.5 font-mono text-[0.55rem] text-muted">
              {TRAITS[t]?.name ?? t}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <NeedBar label="Голод" value={colonist.hunger} invert />
        <NeedBar label="Усталость" value={colonist.fatigue} invert />
        <NeedBar label="Здоровье" value={colonist.health} />
      </div>

      <div>
        <p className="label-mono mb-1">Приоритеты работ</p>
        {JOBS.map((j) => (
          <div key={j.id} className="flex items-center gap-2 py-0.5">
            <span className="flex-1 text-xs text-ink">{j.label}</span>
            {[0, 1, 2, 3].map((v) => (
              <button
                key={v}
                onClick={() => onSetPriority(j.id, v)}
                className={cx(
                  'h-6 w-6 rounded-md border font-mono text-xs',
                  colonist.priorities[j.id] === v
                    ? 'border-accent/60 bg-accent/20 text-accent'
                    : 'border-edge/50 text-muted hover:text-ink',
                )}
              >
                {v}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function NeedBar({ label, value, invert }: { label: string; value: number; invert?: boolean }) {
  const tone = invert ? (value > 70 ? 'warn' : 'accent') : value < 35 ? 'warn' : 'good';
  return (
    <div>
      <div className="flex justify-between font-mono text-[0.55rem] text-muted">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <ProgressBar value={value / 100} tone={tone as 'good' | 'warn' | 'accent'} />
    </div>
  );
}
```

- [ ] **Step 4: Переписать** `src/games/colony/ui/ColonyHud.tsx`

```tsx
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { GameContext } from '@/types/game-module';
import type { ColonyHudState, ResourceId, BuildingType, JobType } from '../domain/types';
import { Button } from '@/ui/primitives/Button';
import { ProgressBar } from '@/ui/primitives/ProgressBar';
import { Modal } from '@/ui/primitives/Modal';
import { cx } from '@/core/utils';
import { IconPause, IconPlay } from '@/ui/icons';
import { BuildMenu } from './panels/BuildMenu';
import { Roster } from './panels/Roster';
import { Inspector } from './panels/Inspector';

const RES_META: Record<ResourceId, { label: string; glyph: string; tone: 'good' | 'warn' | 'accent' }> = {
  food: { label: 'Еда', glyph: '🌾', tone: 'good' },
  wood: { label: 'Дерево', glyph: '🪵', tone: 'warn' },
  science: { label: 'Наука', glyph: '🔬', tone: 'accent' },
};

export function ColonyHud({ ctx }: { ctx: GameContext }) {
  const [hud, setHud] = useState<ColonyHudState | null>(null);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const offState = ctx.events.on('game:state', (s: ColonyHudState) => setHud(s));
    const offSel = ctx.events.on('colony:select', (id: string) => setSelectedId(id));
    return () => { offState(); offSel(); };
  }, [ctx]);

  if (!hud) return null;

  const cmd = (type: string, payload?: unknown) => ctx.events.emit('ui:command', { type, payload });
  const selected = hud.colonists.find((c) => c.id === selectedId) ?? null;

  return (
    <>
      {/* Верхний бар ресурсов */}
      <div className="pointer-events-none absolute left-0 right-0 top-16 z-10 px-4 md:px-8">
        <div className="pointer-events-auto mx-auto flex max-w-4xl flex-wrap items-center gap-3 rounded-2xl border border-edge/60 bg-panel/80 p-3 backdrop-blur">
          {(Object.keys(RES_META) as ResourceId[]).map((id) => {
            const r = hud.resources[id];
            const m = RES_META[id];
            return (
              <div key={id} className="min-w-[120px] flex-1">
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="text-muted">{m.glyph} {m.label}</span>
                  <span className="text-ink">{Math.floor(r.amount)}/{r.capacity}</span>
                </div>
                <ProgressBar className="mt-1" value={r.amount / r.capacity} tone={m.tone} />
              </div>
            );
          })}
          <div className="flex items-center gap-3 border-l border-edge/50 pl-3 font-mono text-xs text-muted">
            <span>День {hud.day}</span>
            <span>{hud.phase === 'day' ? '🌞' : '🌙'}</span>
            <span>👥 {hud.population}</span>
          </div>
        </div>
      </div>

      {/* Правая панель */}
      <div className="absolute bottom-4 right-4 top-32 z-10 hidden w-72 md:block">
        <div className="panel flex h-full flex-col gap-4 overflow-y-auto p-4">
          <div>
            <p className="label-mono mb-2">Строительство</p>
            <BuildMenu onPick={(b: BuildingType) => cmd('placeBuilding', { building: b })} />
            <p className="mt-1 font-mono text-[0.55rem] text-muted">кликни здание, затем тайл на карте</p>
          </div>

          <div>
            <p className="label-mono mb-2">Жители ({hud.population})</p>
            <button
              className="mb-2 w-full rounded-lg border border-edge/60 py-1.5 font-mono text-[0.65rem] text-muted hover:text-ink"
              onClick={() => setRosterOpen(true)}
            >
              открыть полный список →
            </button>
            {selected ? (
              <Inspector
                colonist={selected}
                onSetPriority={(job: JobType, value: number) =>
                  cmd('setPriority', { colonistId: selected.id, job, value })
                }
              />
            ) : (
              <p className="font-mono text-[0.65rem] text-muted">кликни колониста на карте, чтобы осмотреть</p>
            )}
          </div>

          <div>
            <p className="label-mono mb-2">Журнал</p>
            <div className="space-y-1">
              {hud.log.map((l, i) => (
                <p key={i} className={cx('font-mono text-[0.65rem]', l.tone === 'good' ? 'text-good' : l.tone === 'bad' ? 'text-bad' : 'text-muted')}>
                  д{l.day}: {l.text}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Скорость */}
      <div className="absolute bottom-4 left-4 z-10 flex items-center gap-1 rounded-2xl border border-edge/60 bg-panel/80 p-1.5 backdrop-blur">
        <button
          className={cx('grid h-9 w-9 place-items-center rounded-xl', hud.speed === 0 ? 'bg-accent/20 text-accent' : 'text-muted hover:text-ink')}
          onClick={() => cmd('speed', { value: 0 })}
          aria-label="Пауза"
        >
          <IconPause width={16} height={16} />
        </button>
        {[1, 2, 3].map((sp) => (
          <button
            key={sp}
            className={cx('grid h-9 w-9 place-items-center rounded-xl font-mono text-sm', hud.speed === sp ? 'bg-accent/20 text-accent' : 'text-muted hover:text-ink')}
            onClick={() => cmd('speed', { value: sp })}
          >
            {sp === 1 ? <IconPlay width={14} height={14} /> : `${sp}×`}
          </button>
        ))}
      </div>

      {/* Конец игры */}
      {hud.gameOver && (
        <motion.div className="absolute inset-0 z-30 grid place-items-center bg-bg/85 backdrop-blur" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="panel max-w-sm p-8 text-center">
            <p className="mb-1 font-display text-5xl">{hud.victory ? '🏆' : '💀'}</p>
            <h2 className={cx('font-display text-2xl font-bold', hud.victory ? 'text-good' : 'text-bad')}>
              {hud.victory ? 'Колония выстояла' : 'Колония пала'}
            </h2>
            <p className="mt-2 font-mono text-sm text-muted">День {hud.day} · {hud.population} жителей</p>
            <div className="mt-6 flex justify-center gap-3">
              <Button variant="ghost" onClick={() => cmd('restart')}>Новая колония</Button>
              <Button onClick={() => ctx.exit()}>На портал</Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Полный ростер */}
      <Modal open={rosterOpen} onClose={() => setRosterOpen(false)} title="Жители колонии">
        <div className="max-h-[60vh] overflow-y-auto pr-1">
          <Roster
            colonists={hud.colonists}
            onSelect={(id) => { setSelectedId(id); setRosterOpen(false); }}
          />
        </div>
      </Modal>
    </>
  );
}
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck` → Expected: без ошибок.

- [ ] **Step 6: Ручная проверка в приложении**

Run: `npm run dev`, открой портал, запусти Colony. Проверь:
- Колонисты **двигаются** по карте к лесу/зданиям (не случайное блуждание).
- Клик по зданию в меню → клик по тайлу ставит блюпринт (полупрозрачный), строитель доходит и достраивает (становится ярким).
- Клик по колонисту → инспектор показывает черты/нужды/здоровье; кнопки приоритетов 0–3 меняют поведение.
- Ресурсы еды/дерева/науки меняются; скорость 0/1/2/3 работает; журнал обновляется.
- На дне 12 — экран победы; если уморить голодом — поражение.

- [ ] **Step 7: Commit**

```bash
git add src/games/colony/ui/ColonyHud.tsx src/games/colony/ui/panels/
git commit -m "feat(colony): react HUD (build menu, roster, inspector, priorities)"
```

---

## Task 14: Удаление легаси, обновление копирайта, проверка зелёной сборки

**Files:**
- Delete: `src/games/colony/systems/simulation.ts`, `src/games/colony/data/tech.ts`, `src/games/colony/data/events.ts`, `src/games/colony/domain/createColony.legacy.ts`, `tests/colony.test.ts`
- Modify: `src/games/colony/definition.ts`

- [ ] **Step 1: Удалить легаси-файлы**

```bash
git rm src/games/colony/systems/simulation.ts src/games/colony/data/tech.ts src/games/colony/data/events.ts src/games/colony/domain/createColony.legacy.ts tests/colony.test.ts
```

- [ ] **Step 2: Обновить копирайт** `src/games/colony/definition.ts`

```ts
import type { GameDefinition } from '@/types/game-module';

export const COLONY_DEFINITION: GameDefinition = {
  id: 'colony',
  title: 'Colony Survival',
  tagline: 'Выживи. Веди своих людей сквозь зиму, болезни и набеги.',
  description:
    'Симулятор выживания колонии: колонисты-личности с чертами, навыками и нуждами ходят ' +
    'по миру, работают и борются за жизнь. Управляй приоритетами, стройся, готовься к зиме.',
  theme: 'colony',
  status: 'available',
  tags: ['strategy', 'colony-sim', 'survival'],
  bootHint: 'Генерируем мир…',
};
```

- [ ] **Step 3: Полная проверка**

Run: `npm test` → Expected: все новые наборы зелёные, старый `tests/colony.test.ts` отсутствует, других падений нет.
Run: `npm run typecheck` → Expected: без ошибок.
Run: `npm run build` → Expected: успешная сборка.

- [ ] **Step 4: Ручная регрессия**

Run: `npm run dev` → проверь, что игра грузится из нового модуля, автосейв пишется (день N), перезапуск «Новая колония» работает.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(colony): remove legacy sim/tech/events; update copy; green build"
```

---

## Самопроверка плана (выполнена при написании)

- **Покрытие спеки (Фазы 0):** сетка+террейн со смыслом (Задачи 2,4,7) · колонисты-личности: черты/навыки/нужды (Задачи 1,4,5) · работа=движение: scheduler+A*+work (Задачи 3,6,7,8) · приоритеты работ (Задачи 1,6,13) · строительство кликом (Задачи 9,12,13) · рендер движущихся агентов (Задача 12) · HUD ростер+инспектор+меню (Задача 13) · win/lose заглушка (Задача 10) · тесты pathfinding/jobs/needs/work (Задачи 3,5,6,7) — **все покрыты**.
- **Плейсхолдеры:** числовые константы конкретны (черновой баланс — не плейсхолдер); незавершённых блоков/«TODO» нет.
- **Согласованность типов:** поля (`needs.hunger/fatigue`, `agent: pos/task/path/targetTile/targetBuildingId`, `Building.tile/built/buildProgress/buildRequired/jobType/workSlots`, `priorities: Record<JobType,number>`) одинаковы во всех задачах; функции (`findPath`, `runNeeds`, `runJobScheduler`, `stepAgents`, `runWork`, `placeBlueprint/canPlace`, `tick`, `computeHud`) названы единообразно между реализацией, тестами и сценой/HUD.
- **Порядок сборки:** легаси изолируется в Задаче 4 и удаляется в Задаче 14 — сборка остаётся зелёной после каждой задачи.

---

*Следующая фаза (отдельная спека + план): Фаза 1 — Среда (комнаты, температура, сезоны, одежда, порча еды).*
