# Colony Phase 1 — Environment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить климат как стратегический вызов: комнаты, по-комнатная температура, сезоны (зима замораживает уличные фермы), нужда «холод», тёплая одежда (пошив), порча еды.

**Architecture:** Расширяем движок систем Фазы 0 — новые поля в `ColonyState` + новые/обновлённые чистые системы (`season`, `rooms`, `temperature`, обновления `needs`/`work`/`jobScheduler`/`tick`), детерминированные через сид-`Rng`. `payloadVersion` 3 → 4.

**Tech Stack:** TypeScript, Phaser 3, React 18, Vitest. `@/` → `src/`. Тесты: `npx vitest run <file>`; полный прогон `npm test`; типы `npm run typecheck`.

---

## Предусловия

- **Git:** репозиторий не инициализирован — шаги `git commit` приведены для полноты; пропускай их (или сначала `git init`). Тесты/typecheck прогоняй всегда.
- **Зелёная база:** Фаза 0 завершена; `npm run typecheck`, `npm test` (78+ тестов), `npm run build` — зелёные. В отличие от Фазы 0, здесь typecheck должен **оставаться полностью зелёным после каждой задачи** (легаси уже удалён). Новые обязательные поля модели добавляются вместе с инициализацией во всех конструкторах в одной задаче (T1), чтобы не ломать сборку.
- **Семантика:** `needs.cold` 0..100 (0 — комфорт, 100 — замерзает). Температуры в °C. Топливо обогрева = `wood`.

## Карта файлов

Изменяем:
- `src/games/colony/domain/types.ts` — +`env`, +`Room`, +`Tile.roomId/temp`, +`needs.cold`, +`Colonist.clothed`, +`stock`, +`rooms`, +`roomSig`, +`tailorProgress`, +`BuildingType` (`wall|door|heater|tailor`), +`JobType` (`tailor`), +HUD-поля.
- `src/games/colony/data/balance.ts` — +сезоны/температуры/пороги холода/топливо/порча/одежда + стоимости новых зданий.
- `src/games/colony/data/buildings.ts` — +новые типы в `BUILDABLE`/лейблы.
- `src/games/colony/domain/createColony.ts` — инициализация новых полей; `version: 4`; `JOB_TYPES` += `tailor`.
- `src/games/colony/systems/needs.ts` — +нужда холода, авто-одевание, урон при замерзании, экспорт `coldWorkFactor`.
- `src/games/colony/systems/work.ts` — +зимняя заморозка ферм, +cold-множитель, +tailoring, +непроходимость достроенной стены.
- `src/games/colony/systems/jobScheduler.ts` — +работа `tailor`.
- `src/games/colony/systems/tick.ts` — +`season`/`rooms`/`temperature` в конвейер, +порча еды в `onNewDay`.
- `src/games/colony/systems/projection.ts` — проекция `env`/температуры/`cold`/`clothing`.
- `src/games/colony/scenes/WorldScene.ts` — рендер новых зданий + оверлей температуры + сезон.
- `src/games/colony/ui/ColonyHud.tsx` + `ui/panels/Inspector.tsx` — сезон/прогноз/оверлей/одежда; холод+одет в инспекторе.
- `src/games/colony/ColonyGameModule.ts` — `payloadVersion = 4`.

Создаём:
- `src/games/colony/systems/season.ts`, `systems/rooms.ts`, `systems/temperature.ts`.
- `tests/colony.season.test.ts`, `colony.rooms.test.ts`, `colony.temperature.test.ts`, `colony.cold.test.ts`, `colony.spoilage.test.ts`. Расширяем `tests/colony.work.test.ts`, `tests/colony.jobs.test.ts`, `tests/colony.playtest.test.ts`.

---

## Task 1: Расширение модели, баланса, генерации, проекции

Кохезивная миграция данных: добавить все новые поля и инициализировать их во всех конструкторах за одну задачу, чтобы typecheck оставался зелёным.

**Files:**
- Modify: `src/games/colony/domain/types.ts`
- Modify: `src/games/colony/data/balance.ts`
- Modify: `src/games/colony/data/buildings.ts`
- Modify: `src/games/colony/domain/createColony.ts`
- Modify: `src/games/colony/systems/projection.ts`
- Modify: `src/games/colony/ColonyGameModule.ts`
- Test: `tests/colony.migration.test.ts`

- [ ] **Step 1: Расширить типы** — в `src/games/colony/domain/types.ts`:

Заменить строку `export type BuildingType = 'farm' | 'bedroom' | 'storage' | 'lab';` на:
```ts
export type BuildingType = 'farm' | 'bedroom' | 'storage' | 'lab' | 'wall' | 'door' | 'heater' | 'tailor';
```
Заменить строку `export type JobType = 'farm' | 'woodcut' | 'research' | 'build';` на:
```ts
export type JobType = 'farm' | 'woodcut' | 'research' | 'build' | 'tailor';
```
В `interface Tile` добавить два поля (после `buildingId?`):
```ts
  roomId: number;   // 0 = улица; >0 = id комнаты
  temp: number;     // °C текущая температура тайла
```
В `interface Needs` добавить `cold`:
```ts
export interface Needs { hunger: number; fatigue: number; cold: number; } // все 0..100, выше = хуже
```
В `interface Colonist` добавить (после `health`):
```ts
  clothed: boolean;
```
Добавить интерфейс `Room` (после `Building`):
```ts
export interface Room { id: number; tiles: number[]; temp: number; area: number; }
```
В `interface ColonyState` добавить поля (после `buildings`):
```ts
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
```
В `interface ColonyHudColonist` добавить:
```ts
  cold: number;
  clothed: boolean;
```
В `interface ColonyHudState` добавить (после `population`):
```ts
  env: ColonyState['env'];
  clothing: number;
```

- [ ] **Step 2: Расширить баланс** — добавить в конец `src/games/colony/data/balance.ts`:
```ts
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
```
Затем обновить существующие записи `BUILD_COST`, `BUILD_REQUIRED`, `BUILDING_WORK_SLOTS`, `BUILDING_JOB`, чтобы они включали новые типы зданий (TS-`Record<BuildingType,...>` теперь требует все 8 ключей). Заменить эти четыре константы на версии со слитыми Phase 1-записями:
```ts
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
```

- [ ] **Step 3: Обновить `data/buildings.ts`** — заменить содержимое на:
```ts
import type { BuildingType } from '../domain/types';
import { BUILDING_JOB, BUILDING_WORK_SLOTS } from './balance';

export const BUILDABLE: BuildingType[] = ['farm', 'bedroom', 'storage', 'lab', 'wall', 'door', 'heater', 'tailor'];

export const BUILDING_LABEL: Record<BuildingType, string> = {
  farm: 'Ферма', bedroom: 'Спальня', storage: 'Склад', lab: 'Лаборатория',
  wall: 'Стена', door: 'Дверь', heater: 'Обогреватель', tailor: 'Верстак',
};

export const buildingJob = (t: BuildingType) => BUILDING_JOB[t];
export const buildingSlots = (t: BuildingType) => BUILDING_WORK_SLOTS[t];
```

- [ ] **Step 4: Обновить генерацию** `src/games/colony/domain/createColony.ts`:
  - Изменить `const JOB_TYPES: JobType[] = ['farm', 'woodcut', 'research', 'build'];` на `['farm', 'woodcut', 'research', 'build', 'tailor']`.
  - В `genTile` и в центральном грас-тайле добавить инициализацию `roomId: 0, temp: 16` к создаваемым тайлам. Конкретно: в `genTile` финальный объект — добавить `roomId: 0, temp: 16` (рядом с `passable`); и в центральном `tiles.push({ x, y, terrain: 'grass', fertility: 0.6, passable: true, roomId: 0, temp: 16 });`.
  - В объект колониста добавить `clothed: false` (рядом с `health: 100`) и в `needs` — `cold: 0`: `needs: { hunger: 10 + rng.int(0, 10), fatigue: 10 + rng.int(0, 10), cold: 0 }`.
  - В возвращаемый `ColonyState` изменить `version: 3` → `version: 4` и добавить поля:
```ts
    rooms: [],
    roomSig: '',
    tailorProgress: 0,
    stock: { clothing: 0 },
    env: { season: 'spring', dayInSeason: 0, outdoorTemp: SEASON_BASE_TEMP.spring, weather: 'clear' },
```
  - Добавить импорт `SEASON_BASE_TEMP` из `../data/balance`.

- [ ] **Step 5: Обновить проекцию** `src/games/colony/systems/projection.ts` — в возвращаемый объект `computeHud` добавить после `population: alive.length,`:
```ts
    env: { ...s.env },
    clothing: s.stock.clothing,
```
и в маппинге колониста добавить `cold: Math.round(c.needs.cold), clothed: c.clothed,`.

- [ ] **Step 6: Бамп версии** `src/games/colony/ColonyGameModule.ts` — `const COLONY_PAYLOAD_VERSION = 3;` → `= 4;`.

- [ ] **Step 7: Тест миграции** `tests/colony.migration.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { computeHud } from '@/games/colony/systems/projection';

describe('phase 1 model migration', () => {
  it('initializes env, rooms, stock and tailorProgress', () => {
    const s = createColony(1);
    expect(s.version).toBe(4);
    expect(s.env.season).toBe('spring');
    expect(s.rooms).toEqual([]);
    expect(s.roomSig).toBe('');
    expect(s.stock.clothing).toBe(0);
    expect(s.tailorProgress).toBe(0);
  });

  it('initializes new tile and colonist fields', () => {
    const s = createColony(1);
    expect(s.map.tiles.every((t) => t.roomId === 0 && typeof t.temp === 'number')).toBe(true);
    expect(s.colonists.every((c) => c.clothed === false && c.needs.cold === 0)).toBe(true);
  });

  it('projects env and clothing into the HUD', () => {
    const hud = computeHud(createColony(1));
    expect(hud.env.season).toBe('spring');
    expect(hud.clothing).toBe(0);
    expect(typeof hud.colonists[0].cold).toBe('number');
    expect(hud.colonists[0].clothed).toBe(false);
  });
});
```

- [ ] **Step 8: Проверка**

Run: `npx vitest run tests/colony.migration.test.ts` → PASS (3).
Run: `npm run typecheck` → **полностью зелёный** (0 ошибок). Если есть — почини (обычно недостающие ключи в `Record<BuildingType,...>`).

- [ ] **Step 9: Commit**
```bash
git add -A && git commit -m "feat(colony): phase1 model + balance + migration"
```

---

## Task 2: Система сезонов (`season.ts`)

**Files:**
- Create: `src/games/colony/systems/season.ts`
- Modify: `src/games/colony/systems/tick.ts`
- Test: `tests/colony.season.test.ts`

- [ ] **Step 1: Падающий тест** `tests/colony.season.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { advanceSeason, updateOutdoorTemp } from '@/games/colony/systems/season';
import { SEASON_LENGTH, SEASON_BASE_TEMP } from '@/games/colony/data/balance';
import { Rng } from '@/core/utils/rng';

describe('season system', () => {
  it('advances to the next season after SEASON_LENGTH days', () => {
    const s = createColony(1);
    const rng = new Rng(s.rngState);
    for (let d = 0; d < SEASON_LENGTH; d++) advanceSeason(s, rng);
    expect(s.env.season).toBe('summer');
    expect(s.env.dayInSeason).toBe(0);
  });

  it('outdoor temp tracks the season and drops at night', () => {
    const s = createColony(1);
    s.env.season = 'winter';
    s.env.weather = 'clear';
    s.phase = 'day';
    updateOutdoorTemp(s);
    const dayTemp = s.env.outdoorTemp;
    s.phase = 'night';
    updateOutdoorTemp(s);
    expect(s.env.outdoorTemp).toBeLessThan(dayTemp);
    expect(dayTemp).toBeLessThanOrEqual(SEASON_BASE_TEMP.winter);
  });
});
```

- [ ] **Step 2: Прогнать — FAIL** (`npx vitest run tests/colony.season.test.ts`).

- [ ] **Step 3: Реализовать** `src/games/colony/systems/season.ts`:
```ts
import type { ColonyState } from '../domain/types';
import type { Rng } from '@/core/utils/rng';
import {
  NIGHT_TEMP_DROP, SEASON_BASE_TEMP, SEASON_LENGTH, SEASON_ORDER, WEATHER_TEMP_DROP,
} from '../data/balance';

/** Вызывается раз в день из onNewDay. Двигает сезон и катит погоду. */
export function advanceSeason(s: ColonyState, rng: Rng): void {
  s.env.dayInSeason += 1;
  if (s.env.dayInSeason >= SEASON_LENGTH) {
    s.env.dayInSeason = 0;
    const i = SEASON_ORDER.indexOf(s.env.season);
    s.env.season = SEASON_ORDER[(i + 1) % SEASON_ORDER.length];
  }
  s.env.weather = rng.chance(0.15) ? 'cold_snap' : rng.chance(0.3) ? 'snow' : 'clear';
}

/** Пересчёт уличной температуры из сезона/фазы/погоды. Дёшево, каждый тик. */
export function updateOutdoorTemp(s: ColonyState): void {
  let t = SEASON_BASE_TEMP[s.env.season];
  if (s.phase === 'night') t -= NIGHT_TEMP_DROP;
  t -= WEATHER_TEMP_DROP[s.env.weather];
  s.env.outdoorTemp = t;
}
```

- [ ] **Step 4: Подключить в тик** `src/games/colony/systems/tick.ts`:
  - Импортировать: `import { advanceSeason, updateOutdoorTemp } from './season';` и `import { Rng } from '@/core/utils/rng';`.
  - В начале `tick`, после установки `s.phase`, добавить `updateOutdoorTemp(s);`.
  - В `onNewDay(s)` в начало добавить:
```ts
  const rng = new Rng(s.rngState);
  advanceSeason(s, rng);
  s.rngState = rng.seed;
```

- [ ] **Step 5: Прогнать — PASS** (`npx vitest run tests/colony.season.test.ts` → 2) и `npx vitest run tests/colony.tick.test.ts` (4, не сломали детерминизм). Run `npm run typecheck`.

- [ ] **Step 6: Commit**
```bash
git add -A && git commit -m "feat(colony): season system + outdoor temperature"
```

---

## Task 3: Система комнат (`rooms.ts`)

**Files:**
- Create: `src/games/colony/systems/rooms.ts`
- Modify: `src/games/colony/systems/tick.ts`
- Test: `tests/colony.rooms.test.ts`

- [ ] **Step 1: Падающий тест** `tests/colony.rooms.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { wallsDoorsSig, recomputeRooms } from '@/games/colony/systems/rooms';
import type { Building } from '@/games/colony/domain/types';
import { idx } from '@/games/colony/systems/grid';

const wall = (id: string, x: number, y: number): Building => ({
  id, type: 'wall', tile: { x, y }, workSlots: 0, jobType: undefined,
  built: true, buildProgress: 8, buildRequired: 8,
});

describe('rooms system', () => {
  it('detects an enclosed 1x1 interior as a room', () => {
    const s = createColony(1);
    // Стены вокруг (10,10): (9,10),(11,10),(10,9),(10,11) — диагонали не нужны для 4-связности.
    s.buildings.push(wall('w1', 9, 10), wall('w2', 11, 10), wall('w3', 10, 9), wall('w4', 10, 11));
    recomputeRooms(s);
    const t = s.map.tiles[idx(10, 10, s.map.w)];
    expect(t.roomId).toBeGreaterThan(0);
    const room = s.rooms.find((r) => r.id === t.roomId)!;
    expect(room.area).toBe(1);
  });

  it('a tile with no walls around it stays outdoor (roomId 0)', () => {
    const s = createColony(1);
    recomputeRooms(s);
    expect(s.map.tiles.every((t) => t.roomId === 0)).toBe(true);
    expect(s.rooms).toHaveLength(0);
  });

  it('breaching a wall removes the room', () => {
    const s = createColony(1);
    s.buildings.push(wall('w1', 9, 10), wall('w2', 11, 10), wall('w3', 10, 9), wall('w4', 10, 11));
    recomputeRooms(s);
    expect(s.map.tiles[idx(10, 10, s.map.w)].roomId).toBeGreaterThan(0);
    s.buildings = s.buildings.filter((b) => b.id !== 'w1'); // пролом
    recomputeRooms(s);
    expect(s.map.tiles[idx(10, 10, s.map.w)].roomId).toBe(0);
  });

  it('signature changes only with walls/doors', () => {
    const s = createColony(1);
    const a = wallsDoorsSig(s);
    s.buildings.push(wall('w1', 9, 10));
    expect(wallsDoorsSig(s)).not.toBe(a);
  });
});
```

- [ ] **Step 2: Прогнать — FAIL.**

- [ ] **Step 3: Реализовать** `src/games/colony/systems/rooms.ts`:
```ts
import type { ColonyState, Room } from '../domain/types';
import { idx } from './grid';

/** Сигнатура набора построенных стен/дверей — меняется только при их изменении. */
export function wallsDoorsSig(s: ColonyState): string {
  return s.buildings
    .filter((b) => b.built && (b.type === 'wall' || b.type === 'door'))
    .map((b) => `${b.tile.x},${b.tile.y}`)
    .sort()
    .join('|');
}

/** Пересчёт комнат flood-fill'ом. Тайлы стен/дверей — барьеры; всё, до чего
 *  дотягивается заливка от границы карты, — улица (roomId 0); замкнутые
 *  внутренние области нумеруются как комнаты. */
export function recomputeRooms(s: ColonyState): void {
  const { w, h, tiles } = s.map;
  const barrier = new Uint8Array(w * h);
  for (const b of s.buildings) {
    if (b.built && (b.type === 'wall' || b.type === 'door')) barrier[idx(b.tile.x, b.tile.y, w)] = 1;
  }

  const outside = new Uint8Array(w * h);
  const stack: number[] = [];
  const seed = (x: number, y: number) => {
    const i = idx(x, y, w);
    if (!barrier[i] && !outside[i]) { outside[i] = 1; stack.push(i); }
  };
  for (let x = 0; x < w; x++) { seed(x, 0); seed(x, h - 1); }
  for (let y = 0; y < h; y++) { seed(0, y); seed(w - 1, y); }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w, y = Math.floor(i / w);
    const push = (nx: number, ny: number) => {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) return;
      const ni = idx(nx, ny, w);
      if (!barrier[ni] && !outside[ni]) { outside[ni] = 1; stack.push(ni); }
    };
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }

  for (const t of tiles) t.roomId = 0;
  const rooms: Room[] = [];
  let nextId = 1;
  for (let i = 0; i < w * h; i++) {
    if (barrier[i] || outside[i] || tiles[i].roomId !== 0) continue;
    // Новая комната: BFS по не-барьерным внутренним тайлам.
    const comp: number[] = [];
    const q = [i];
    tiles[i].roomId = nextId;
    while (q.length) {
      const j = q.pop()!;
      comp.push(j);
      const x = j % w, y = Math.floor(j / w);
      const visit = (nx: number, ny: number) => {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) return;
        const nj = idx(nx, ny, w);
        if (barrier[nj] || outside[nj] || tiles[nj].roomId !== 0) return;
        tiles[nj].roomId = nextId;
        q.push(nj);
      };
      visit(x + 1, y); visit(x - 1, y); visit(x, y + 1); visit(x, y - 1);
    }
    rooms.push({ id: nextId, tiles: comp, temp: s.env.outdoorTemp, area: comp.length });
    nextId += 1;
  }
  s.rooms = rooms;
}
```

- [ ] **Step 4: Подключить в тик** `tick.ts` — импортировать `import { recomputeRooms, wallsDoorsSig } from './rooms';` и в `tick`, после `updateOutdoorTemp(s)`, добавить:
```ts
  const sig = wallsDoorsSig(s);
  if (sig !== s.roomSig) { recomputeRooms(s); s.roomSig = sig; }
```

- [ ] **Step 5: Прогнать — PASS** (`npx vitest run tests/colony.rooms.test.ts` → 4); `npx vitest run tests/colony.tick.test.ts`; `npm run typecheck`.

- [ ] **Step 6: Commit**
```bash
git add -A && git commit -m "feat(colony): room detection (flood-fill)"
```

---

## Task 4: Система температуры (`temperature.ts`)

**Files:**
- Create: `src/games/colony/systems/temperature.ts`
- Modify: `src/games/colony/systems/tick.ts`
- Test: `tests/colony.temperature.test.ts`

- [ ] **Step 1: Падающий тест** `tests/colony.temperature.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { recomputeRooms } from '@/games/colony/systems/rooms';
import { runTemperature } from '@/games/colony/systems/temperature';
import type { Building } from '@/games/colony/domain/types';

const wall = (id: string, x: number, y: number): Building => ({
  id, type: 'wall', tile: { x, y }, workSlots: 0, jobType: undefined, built: true, buildProgress: 8, buildRequired: 8,
});
const heater = (id: string, x: number, y: number): Building => ({
  id, type: 'heater', tile: { x, y }, workSlots: 0, jobType: undefined, built: true, buildProgress: 25, buildRequired: 25,
});

function enclose(s: ReturnType<typeof createColony>) {
  // Комната-кольцо вокруг (10,10): стены по периметру 3x3 рамки, интерьер (10,10).
  s.buildings.push(wall('a', 9, 9), wall('b', 10, 9), wall('c', 11, 9), wall('d', 9, 10), wall('e', 11, 10), wall('f', 9, 11), wall('g', 10, 11), wall('h', 11, 11));
}

describe('temperature system', () => {
  it('a heated enclosed room gets warmer than outside', () => {
    const s = createColony(1);
    s.env.outdoorTemp = -10;
    enclose(s);
    s.buildings.push(heater('ht', 10, 10));
    recomputeRooms(s);
    for (let i = 0; i < 200; i++) runTemperature(s);
    const room = s.rooms.find((r) => r.tiles.length > 0)!;
    expect(room.temp).toBeGreaterThan(s.env.outdoorTemp);
  });

  it('a heater with no wood does not heat', () => {
    const s = createColony(1);
    s.env.outdoorTemp = -10;
    s.resources.wood.amount = 0;
    enclose(s);
    s.buildings.push(heater('ht', 10, 10));
    recomputeRooms(s);
    for (let i = 0; i < 200; i++) runTemperature(s);
    const room = s.rooms[0];
    expect(room.temp).toBeLessThanOrEqual(s.env.outdoorTemp + 0.5);
  });

  it('outdoor tiles equal outdoorTemp', () => {
    const s = createColony(1);
    s.env.outdoorTemp = 5;
    recomputeRooms(s);
    runTemperature(s);
    expect(s.map.tiles[0].temp).toBe(5);
  });
});
```

- [ ] **Step 2: Прогнать — FAIL.**

- [ ] **Step 3: Реализовать** `src/games/colony/systems/temperature.ts`:
```ts
import type { ColonyState } from '../domain/types';
import { idx } from './grid';
import { AREA_NORM, HEATER_FUEL_PER_TICK, HEATER_OUTPUT, TEMP_LERP } from '../data/balance';

/** По-комнатная температура + сжигание дерева обогревателями. Без RNG. */
export function runTemperature(s: ColonyState): void {
  const outdoor = s.env.outdoorTemp;

  // Активные обогреватели по комнатам (жгут дерево).
  const activeByRoom = new Map<number, number>();
  for (const b of s.buildings) {
    if (b.type !== 'heater' || !b.built) continue;
    const t = s.map.tiles[idx(b.tile.x, b.tile.y, s.map.w)];
    const rid = t ? t.roomId : 0;
    if (rid === 0) continue; // уличный обогреватель бесполезен
    if (s.resources.wood.amount >= HEATER_FUEL_PER_TICK) {
      s.resources.wood.amount -= HEATER_FUEL_PER_TICK;
      activeByRoom.set(rid, (activeByRoom.get(rid) ?? 0) + 1);
    }
  }

  for (const room of s.rooms) {
    const active = activeByRoom.get(room.id) ?? 0;
    const heatPower = active * HEATER_OUTPUT * (AREA_NORM / Math.max(AREA_NORM, room.area));
    const target = outdoor + heatPower;
    room.temp += (target - room.temp) * TEMP_LERP;
  }

  // Запись температуры в тайлы.
  const roomTemp = new Map<number, number>();
  for (const room of s.rooms) roomTemp.set(room.id, room.temp);
  for (const t of s.map.tiles) {
    t.temp = t.roomId === 0 ? outdoor : roomTemp.get(t.roomId) ?? outdoor;
  }
}
```

- [ ] **Step 4: Подключить в тик** `tick.ts` — импортировать `import { runTemperature } from './temperature';` и вызвать `runTemperature(s);` сразу после блока пересчёта комнат (перед `runNeeds`).

- [ ] **Step 5: Прогнать — PASS** (`npx vitest run tests/colony.temperature.test.ts` → 3); `npm run typecheck`.

- [ ] **Step 6: Commit**
```bash
git add -A && git commit -m "feat(colony): per-room temperature + heater fuel"
```

---

## Task 5: Нужда холода (обновление `needs.ts`)

**Files:**
- Modify: `src/games/colony/systems/needs.ts`
- Test: `tests/colony.cold.test.ts`

- [ ] **Step 1: Падающий тест** `tests/colony.cold.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { runNeeds, coldWorkFactor } from '@/games/colony/systems/needs';

function freezeColonist(s: ReturnType<typeof createColony>) {
  // Поставить все тайлы холодными.
  for (const t of s.map.tiles) t.temp = -10;
}

describe('cold need', () => {
  it('cold rises when the colonist stands on a cold tile', () => {
    const s = createColony(1);
    freezeColonist(s);
    const c = s.colonists[0];
    c.needs.cold = 0;
    runNeeds(s);
    expect(c.needs.cold).toBeGreaterThan(0);
  });

  it('clothing reduces cold accumulation (auto-equips from stock)', () => {
    const s = createColony(1);
    freezeColonist(s);
    s.stock.clothing = 5;
    const c = s.colonists[0];
    c.needs.cold = 40; // выше CLOTHE_THRESHOLD
    runNeeds(s);
    expect(c.clothed).toBe(true);
    expect(s.stock.clothing).toBe(4);
  });

  it('warmth lowers cold', () => {
    const s = createColony(1);
    for (const t of s.map.tiles) t.temp = 22;
    const c = s.colonists[0];
    c.needs.cold = 50;
    runNeeds(s);
    expect(c.needs.cold).toBeLessThan(50);
  });

  it('freezing damages health', () => {
    const s = createColony(1);
    for (const t of s.map.tiles) t.temp = -10;
    const c = s.colonists[0];
    const before = c.health;
    runNeeds(s);
    expect(c.health).toBeLessThan(before);
  });

  it('coldWorkFactor drops below 1 only above the threshold', () => {
    const s = createColony(1);
    const c = s.colonists[0];
    c.needs.cold = 0;
    expect(coldWorkFactor(c)).toBeCloseTo(1, 5);
    c.needs.cold = 100;
    expect(coldWorkFactor(c)).toBeLessThan(1);
  });
});
```

- [ ] **Step 2: Прогнать — FAIL** (нет `coldWorkFactor`, нет холодовой логики).

- [ ] **Step 3: Реализовать.** Открыть `src/games/colony/systems/needs.ts`. Добавить импорты в существующий список из `../data/balance`:
```ts
  CLOTHE_THRESHOLD, CLOTHING_WARMTH, COLD_DAMAGE_PER_TICK, COLD_PER_DEGREE,
  COLD_RECOVER, COLD_SLOW_MIN, COLD_SLOW_THRESHOLD, COMFORT_MIN, FREEZING_TEMP,
```
и добавить импорт `import { idx } from './grid';` (если ещё нет), и тип `Colonist`.

Добавить экспортируемый хелпер (в конец файла):
```ts
/** Множитель скорости работы от холода: 1 ниже порога, до COLD_SLOW_MIN при cold=100. */
export function coldWorkFactor(c: Colonist): number {
  if (c.needs.cold <= COLD_SLOW_THRESHOLD) return 1;
  const t = (c.needs.cold - COLD_SLOW_THRESHOLD) / (100 - COLD_SLOW_THRESHOLD);
  return 1 - t * (1 - COLD_SLOW_MIN);
}
```
Внутри `runNeeds`, в цикле по колонистам — **после** блока декея `hunger`/`fatigue` (Step 1 «1) Декей») добавить блок холода:
```ts
    // Холод: эффективная температура = тайл под колонистом + одежда.
    const ct = s.map.tiles[idx(Math.round(c.pos.x), Math.round(c.pos.y), s.map.w)];
    const tileTemp = ct ? ct.temp : s.env.outdoorTemp;
    const effTemp = tileTemp + (c.clothed ? CLOTHING_WARMTH : 0);
    if (effTemp < COMFORT_MIN) {
      c.needs.cold = clamp(c.needs.cold + (COMFORT_MIN - effTemp) * COLD_PER_DEGREE, 0, 100);
    } else {
      c.needs.cold = clamp(c.needs.cold - COLD_RECOVER, 0, 100);
    }
    if (c.needs.cold >= CLOTHE_THRESHOLD && !c.clothed && s.stock.clothing > 0) {
      c.clothed = true;
      s.stock.clothing -= 1;
    }
    if (effTemp <= FREEZING_TEMP) {
      c.health = clamp(c.health - COLD_DAMAGE_PER_TICK, 0, 100);
      if (c.health <= 0) {
        c.alive = false;
        s.log.push({ day: s.day, text: `${c.name} замёрз(ла) насмерть.`, tone: 'bad' });
        continue;
      }
    }
```
> Этот блок идёт до разрешения `eat`/`sleep` (которые делают `continue`), чтобы холод считался каждый тик. Импорт `Colonist` нужен только для `coldWorkFactor` — добавь в `import type { ... } from '../domain/types'`.

- [ ] **Step 4: Прогнать — PASS** (`npx vitest run tests/colony.cold.test.ts` → 5); `npx vitest run tests/colony.needs.test.ts` (4, не сломали); `npm run typecheck`.

- [ ] **Step 5: Commit**
```bash
git add -A && git commit -m "feat(colony): cold need, clothing, freezing damage"
```

---

## Task 6: Обновление работы — зима, холод, пошив (`work.ts`, `jobScheduler.ts`)

**Files:**
- Modify: `src/games/colony/systems/work.ts`
- Modify: `src/games/colony/systems/jobScheduler.ts`
- Test: расширить `tests/colony.work.test.ts`, `tests/colony.jobs.test.ts`

- [ ] **Step 1: Расширить тесты.** Добавь в `describe('work system', ...)` в `tests/colony.work.test.ts` следующие тесты (новых импортов не требуется — `createColony`/`runWork` уже импортированы):
```ts
  it('a farm on a frozen tile produces no food', () => {
    const s = createColony(1);
    const t = { x: Math.floor(s.map.w / 2), y: Math.floor(s.map.h / 2) };
    const farm = { id: 'f1', type: 'farm' as const, tile: t, workSlots: 3, jobType: 'farm' as const, built: true, buildProgress: 30, buildRequired: 30 };
    s.buildings.push(farm);
    s.map.tiles[t.y * s.map.w + t.x].temp = -5; // мороз
    const c = s.colonists[0];
    c.task = 'work'; c.targetBuildingId = 'f1'; c.targetTile = t; c.pos = { ...t };
    const before = s.resources.food.amount;
    runWork(s);
    expect(s.resources.food.amount).toBe(before);
  });

  it('a tailor bench turns wood into clothing', () => {
    const s = createColony(1);
    const t = { x: Math.floor(s.map.w / 2), y: Math.floor(s.map.h / 2) };
    s.buildings.push({ id: 't1', type: 'tailor', tile: t, workSlots: 2, jobType: 'tailor', built: true, buildProgress: 30, buildRequired: 30 });
    s.resources.wood.amount = 100;
    const c = s.colonists[0];
    c.task = 'work'; c.targetBuildingId = 't1'; c.targetTile = t; c.pos = { ...t };
    const wood0 = s.resources.wood.amount;
    for (let i = 0; i < 400 && s.stock.clothing === 0; i++) runWork(s);
    expect(s.stock.clothing).toBeGreaterThan(0);
    expect(s.resources.wood.amount).toBeLessThan(wood0);
  });
```
Добавь в `tests/colony.jobs.test.ts` тест назначения пошива:
```ts
  it('assigns a colonist to a tailor bench', () => {
    const s = createColony(1);
    const cx = Math.floor(MAP_W / 2), cy = Math.floor(MAP_H / 2);
    s.buildings.push({ id: 't1', type: 'tailor', tile: { x: cx + 1, y: cy }, workSlots: 2, jobType: 'tailor', built: true, buildProgress: 30, buildRequired: 30 });
    s.colonists.forEach((c) => { c.task = 'idle'; (['farm','woodcut','research','build','tailor'] as const).forEach((j) => (c.priorities[j] = 0)); c.priorities.tailor = 3; });
    runJobScheduler(s);
    expect(s.colonists.some((c) => c.targetBuildingId === 't1' && c.task === 'goto_work')).toBe(true);
  });
```

- [ ] **Step 2: Прогнать — FAIL** (`npx vitest run tests/colony.work.test.ts tests/colony.jobs.test.ts`).

- [ ] **Step 3: Обновить `work.ts`.** Добавить импорты: `coldWorkFactor` из `./needs`, и из `../data/balance`: `CLOTHING_REQUIRED, CLOTHING_WOOD_COST, FARM_FREEZE_TEMP, TAILOR_BASE`.
  - В `runWork`, в самом начале тела цикла (после получения `building`), вычислить холодовой множитель: `const cf = coldWorkFactor(c);`.
  - **Заморозка ферм:** в ветке farm — перед добавлением еды проверить температуру тайла фермы:
```ts
      if (building.jobType === 'farm') {
        const t = tileAt(building.tile.x, building.tile.y, s.map);
        if (!t || t.temp <= FARM_FREEZE_TEMP) { /* мёрзлая земля — ничего */ }
        else {
          const fert = 0.5 + t.fertility;
          addResource(s, 'food', FARM_BASE * skillMultiplier(c.skills.farming.level) * workSpeed(c) * fert * cf);
          grantXp(c.skills.farming, XP_PER_WORK_TICK);
        }
      } else if (building.jobType === 'research') {
        addResource(s, 'science', RESEARCH_BASE * skillMultiplier(c.skills.research.level) * workSpeed(c) * cf);
        grantXp(c.skills.research, XP_PER_WORK_TICK);
      } else if (building.jobType === 'tailor') {
        s.tailorProgress += TAILOR_BASE * skillMultiplier(c.skills.building.level) * workSpeed(c) * cf;
        grantXp(c.skills.building, XP_PER_WORK_TICK);
        if (s.tailorProgress >= CLOTHING_REQUIRED && s.resources.wood.amount >= CLOTHING_WOOD_COST) {
          s.tailorProgress -= CLOTHING_REQUIRED;
          s.resources.wood.amount -= CLOTHING_WOOD_COST;
          s.stock.clothing += 1;
        }
      }
```
  - **Холод-множитель для рубки и стройки:** домножить woodcut-выработку и build-прогресс на `cf` тоже (в их `+=` добавить `* cf`).
  - **Непроходимость достроенной стены:** в ветке завершения блюпринта, после `t.buildingId = building.id`, добавить:
```ts
        if (building.type === 'wall' && t) t.passable = false;
```

- [ ] **Step 4: Обновить `jobScheduler.ts`** — в `findTarget`, ветку `if (job === 'farm' || job === 'research')` расширить до `if (job === 'farm' || job === 'research' || job === 'tailor')` (логика «built здание с этим jobType и свободным слотом» уже подходит). В `JOB_ORDER` добавить `'tailor'`: `const JOB_ORDER: JobType[] = ['build', 'farm', 'woodcut', 'research', 'tailor'];`.

- [ ] **Step 5: Прогнать — PASS** (`npx vitest run tests/colony.work.test.ts tests/colony.jobs.test.ts`); `npm run typecheck`.

- [ ] **Step 6: Commit**
```bash
git add -A && git commit -m "feat(colony): winter farm freeze, cold slowdown, tailoring"
```

---

## Task 7: Порча еды (`tick.ts onNewDay`)

**Files:**
- Modify: `src/games/colony/systems/tick.ts`
- Test: `tests/colony.spoilage.test.ts`

- [ ] **Step 1: Падающий тест** `tests/colony.spoilage.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { applyFoodSpoilage } from '@/games/colony/systems/tick';

describe('food spoilage', () => {
  it('food spoils when warm and unstored', () => {
    const s = createColony(1);
    s.env.outdoorTemp = 20;
    s.resources.food.amount = 100;
    s.buildings = [];
    applyFoodSpoilage(s);
    expect(s.resources.food.amount).toBeLessThan(100);
  });

  it('storage slows spoilage', () => {
    const warm = createColony(1); warm.env.outdoorTemp = 20; warm.resources.food.amount = 100; warm.buildings = [];
    applyFoodSpoilage(warm);
    const stored = createColony(1); stored.env.outdoorTemp = 20; stored.resources.food.amount = 100;
    stored.buildings = [{ id: 's1', type: 'storage', tile: { x: 0, y: 0 }, workSlots: 0, jobType: undefined, built: true, buildProgress: 25, buildRequired: 25 }];
    applyFoodSpoilage(stored);
    expect(stored.resources.food.amount).toBeGreaterThan(warm.resources.food.amount);
  });

  it('cold preserves food', () => {
    const s = createColony(1);
    s.env.outdoorTemp = -10;
    s.resources.food.amount = 100;
    s.buildings = [];
    applyFoodSpoilage(s);
    expect(s.resources.food.amount).toBeGreaterThan(99); // почти не испортилась
  });
});
```

- [ ] **Step 2: Прогнать — FAIL** (нет `applyFoodSpoilage`).

- [ ] **Step 3: Реализовать.** В `src/games/colony/systems/tick.ts`:
  - Импортировать из `../data/balance`: `BASE_SPOIL, SPOIL_COLD_TEMP`.
  - Добавить экспортируемую функцию:
```ts
/** Дневная порча еды: меньше при складах и в холод. */
export function applyFoodSpoilage(s: ColonyState): void {
  const builtStorages = s.buildings.filter((b) => b.type === 'storage' && b.built).length;
  const storageFactor = 1 / (1 + builtStorages * 0.6);
  const tempFactor = s.env.outdoorTemp <= SPOIL_COLD_TEMP ? 0.1 : 1;
  const frac = BASE_SPOIL * storageFactor * tempFactor;
  s.resources.food.amount = Math.max(0, s.resources.food.amount * (1 - frac));
}
```
  - Вызвать `applyFoodSpoilage(s);` в `onNewDay(s)` (после `advanceSeason`).

- [ ] **Step 4: Прогнать — PASS** (`npx vitest run tests/colony.spoilage.test.ts` → 3); `npx vitest run tests/colony.tick.test.ts`; `npm run typecheck`.

- [ ] **Step 5: Commit**
```bash
git add -A && git commit -m "feat(colony): food spoilage (storage + cold)"
```

---

## Task 8: Рендер сцены — новые здания + оверлей температуры

**Files:**
- Modify: `src/games/colony/scenes/WorldScene.ts`

Без юнит-тестов; проверка ручная (в Задаче 10).

- [ ] **Step 1: Цвета/глифы новых зданий.** В `WorldScene.ts` расширить `BUILDING_COLOR` и `BUILDING_GLYPH` всеми ключами `BuildingType`:
```ts
const BUILDING_COLOR: Record<BuildingType, number> = {
  farm: 0x84de5a, bedroom: 0xf0a840, storage: 0xc8b88a, lab: 0x4ad0ff,
  wall: 0x6b6b63, door: 0xa6895b, heater: 0xff6a3d, tailor: 0xb98bd9,
};
const BUILDING_GLYPH: Record<BuildingType, string> = {
  farm: 'F', bedroom: 'H', storage: 'S', lab: 'L', wall: '#', door: '/', heater: '*', tailor: 'T',
};
```

- [ ] **Step 2: Оверлей температуры.** Добавить поле `private tempOverlay = false;` и графику оверлея. В `create()` после `drawMap()` создать слой:
```ts
    this.tempLayer = this.add.graphics();
```
(объявить `private tempLayer!: Phaser.GameObjects.Graphics;`). Добавить метод:
```ts
  private drawTempOverlay() {
    this.tempLayer.clear();
    if (!this.tempOverlay) return;
    for (const t of this.state.map.tiles) {
      // синий (холод) → красный (тепло), диапазон -20..30
      const k = Math.max(0, Math.min(1, (t.temp + 20) / 50));
      const r = Math.floor(k * 255), b = Math.floor((1 - k) * 255);
      this.tempLayer.fillStyle((r << 16) | (0x30 << 8) | b, 0.35);
      this.tempLayer.fillRect(t.x * TILE, t.y * TILE, TILE - 1, TILE - 1);
    }
  }
```
Вызывать `this.drawTempOverlay();` в `update()` (после `syncBuildings()`), и в `onCommand` добавить кейс:
```ts
      case 'toggleTempOverlay': this.tempOverlay = !!msg.payload?.value; break;
```

- [ ] **Step 3: Передавать env в HUD.** Проекция уже включает `env` (Task 1). Ничего дополнительно в сцене не требуется — `computeHud` уже шлёт `env`.

- [ ] **Step 4: Typecheck.** Run `npm run typecheck` → зелёный. (Ручной прогон — в Задаче 10.)

- [ ] **Step 5: Commit**
```bash
git add -A && git commit -m "feat(colony): render new buildings + temperature overlay"
```

---

## Task 9: HUD — сезон, прогноз, оверлей, одежда, холод

**Files:**
- Modify: `src/games/colony/ui/ColonyHud.tsx`
- Modify: `src/games/colony/ui/panels/Inspector.tsx`

Проверка ручная (Задача 10).

- [ ] **Step 1: Инспектор — холод + одет.** В `src/games/colony/ui/panels/Inspector.tsx`, в блок «нужд» добавить полосу холода и значок одежды:
```tsx
        <NeedBar label="Холод" value={colonist.cold} invert />
```
(после строк Голод/Усталость/Здоровье). И рядом с именем/чертами показать значок, если одет:
```tsx
        {colonist.clothed && <span className="font-mono text-[0.55rem] text-accent">🧥 одет</span>}
```

- [ ] **Step 2: HUD — сезон/прогноз/оверлей/одежда.** В `src/games/colony/ui/ColonyHud.tsx`:
  - В верхнем баре, в блок справа, добавить сезон, уличную °C и счётчик одежды:
```tsx
            <span>{SEASON_LABEL[hud.env.season]} {Math.round(hud.env.outdoorTemp)}°</span>
            <span>🧥 {hud.clothing}</span>
```
  - Добавить рядом константу:
```tsx
const SEASON_LABEL: Record<string, string> = { spring: '🌱 Весна', summer: '☀️ Лето', autumn: '🍂 Осень', winter: '❄️ Зима' };
```
  - Добавить кнопку-тоггл оверлея температуры (рядом со скоростью или в правой панели). Минимально — в правую панель, новый блок:
```tsx
          <div>
            <button
              className="w-full rounded-lg border border-edge/60 py-1.5 font-mono text-[0.65rem] text-muted hover:text-ink"
              onClick={() => { setTempOn((v) => { cmd('toggleTempOverlay', { value: !v }); return !v; }); }}
            >
              оверлей температуры: {tempOn ? 'вкл' : 'выкл'}
            </button>
          </div>
```
  - Добавить состояние: `const [tempOn, setTempOn] = useState(false);`.

- [ ] **Step 3: Typecheck** `npm run typecheck` → зелёный.

- [ ] **Step 4: Commit**
```bash
git add -A && git commit -m "feat(colony): HUD season/forecast/temp-overlay/clothing"
```

---

## Task 10: Зелёная сборка + зимний плейтест

**Files:**
- Modify: `tests/colony.playtest.test.ts`

- [ ] **Step 1: Зимний плейтест.** Добавить в `tests/colony.playtest.test.ts` тест выживания при наступлении зимы с подготовкой:
```ts
  it('survives into winter with a heated room and clothing buffer', () => {
    const s = createColony(777);
    const cx = Math.floor(MAP_W / 2), cy = Math.floor(MAP_H / 2);
    // фермы для еды
    placeBlueprint(s, 'farm', cx + 1, cy);
    placeBlueprint(s, 'farm', cx, cy + 1);
    // запас одежды и дерева, чтобы пережить холод
    s.stock.clothing = 5;
    s.resources.wood.amount = 200;
    s.colonists.forEach((c) => { c.priorities.build = 3; c.priorities.farm = 3; });
    for (let i = 0; i < TICKS_PER_DAY * 8 && !s.flags.gameOver; i++) tick(s);
    expect(alive(s).length).toBeGreaterThan(0);
  });
```

- [ ] **Step 2: Полная проверка.**

Run: `npm run typecheck` → **0 ошибок**.
Run: `npm test` → все зелёные (Phase 0 + Phase 1 наборы). Зафиксируй число тестов.
Run: `npm run build` → успех.

- [ ] **Step 3: Ручная проверка в приложении.**

Run `npm run dev`. Проверь:
- Построй стены вокруг площадки + дверь + обогреватель — внутри теплеет (включи оверлей температуры).
- Дойди до зимы (ускорь время): уличные фермы перестают давать еду; колонисты без тепла набирают «холод» и теряют здоровье.
- Верстак шьёт одежду (нужен приоритет `tailor` и дерево); мёрзнущие авто-одеваются (🧥).
- Еда без склада в тепле убывает; зимой почти не портится.

- [ ] **Step 4: Commit**
```bash
git add -A && git commit -m "test(colony): winter playtest; phase1 green"
```

---

## Самопроверка плана

- **Покрытие спеки:** сезоны+уличная темп (T2) · комнаты flood-fill (T3) · по-комнатная температура+топливо (T4) · нужда холода+одежда+замерзание (T5) · зимняя заморозка ферм+cold-множитель+пошив (T6) · порча еды (T7) · новые здания рендер+оверлей (T8) · HUD сезон/прогноз/оверлей/одежда/холод (T9) · модель+миграция (T1) · зимний плейтест (T10) — **всё покрыто**.
- **Плейсхолдеры:** числа черновые (намеренно); незавершённых блоков/«TODO» нет. `Record<BuildingType,...>` заданы слитыми (все 8 типов) — отдельных `PHASE1_*` констант нет.
- **Согласованность типов:** новые поля (`env`, `Room`, `Tile.roomId/temp`, `needs.cold`, `Colonist.clothed`, `stock.clothing`, `rooms`, `roomSig`, `tailorProgress`) и функции (`advanceSeason`, `updateOutdoorTemp`, `recomputeRooms`, `wallsDoorsSig`, `runTemperature`, `coldWorkFactor`, `applyFoodSpoilage`) единообразны между задачами, тестами и обновлёнными системами. Слитые `Record<BuildingType,...>` покрывают все 8 типов зданий.
- **Зелёная сборка после каждой задачи:** T1 добавляет поля и инициализирует их во всех конструкторах разом → typecheck зелёный; дальше каждая задача самодостаточна.

---

*Следующие фазы (свои спека+план): Фаза 2 — Здоровье (травмы/болезни/лечение), Фаза 3 — Угрозы и социум, Фаза 4 — Арк и контент.*
