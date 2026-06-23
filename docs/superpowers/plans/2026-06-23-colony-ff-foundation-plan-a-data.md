# Colony FF Foundation · План A — Слой данных (биом-мир, аксессоры, сейвы) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Переключить колонию на процедурный биом-мир (noise→биомы→реки→залежи→стартовая площадка) и регенерацию-из-сида в сейвах, проведя все системы через единый шов-аксессоров в `grid.ts` — при сохранении текущего поведения и зелёных тестов.

**Architecture:** Вводим биом-модель (`Biome`, `ResourceNode`) поверх существующего `Tile[]`. Все чтения/точечные мутации тайлов идут **только** через аксессоры `grid.ts` (`biomeAt/passableAt/tempAt/nodeAt/setPassable/...`). Это «шов»: в Плане B бэкенд аксессоров меняется на типизированные массивы (SoA) и масштаб 256² без правки вызывающих систем. Сейв перестаёт сериализовать сетку — вместо неё хранятся сид + разреженные оверрайды тайлов (`toSave`/`fromSave`), а мир регенерируется детерминированно.

**Tech Stack:** TypeScript (strict), Vitest (TDD), Phaser (рендер — в Плане A только адаптация чтения, без переписывания), сид-`Rng` (`@/core/utils/rng`).

## Global Constraints

- **Детерминизм:** единственные источники случайности в `domain/`+`systems/` — сид-`Rng` и новый `core/utils/noise.ts` (чистая функция от сида). **Запрещены** `Date.now()`, `Math.random()` в доменной/системной логике. Один сид → идентичный мир и прогон.
- **Шов-аксессоров:** после миграции **ни одна** система не читает `state.map.tiles[i].<field>` напрямую — только через `grid.ts`. Это условие проверяется грепом в финальной задаче.
- **payloadVersion:** бамп `4 → 5` в `ColonyGameModule.ts`; старые сейвы отвергаются (поведение уже есть).
- **Размер карты в Плане A — умеренный (28×28, как сейчас).** Масштаб 256² — План B. Worldgen параметризован размером, числа баланса — в `data/balance.ts`.
- **TDD:** тест-первый; `npm test` зелёный после каждой задачи; не переходить к следующей задаче с красными тестами.
- **Комментарии в коде — на русском** (как в существующем коде колонии).
- **Каждый коммит завершается строкой-трейлером:**
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
  (в командах ниже показан `-m "…"` без трейлера для краткости — трейлер добавлять всегда).

---

## File Structure

**Новые файлы:**
- `core/utils/noise.ts` — сид-шум (`fbm`, value-noise). Одна ответственность: детерминированный шум.
- `src/games/colony/domain/worldgen.ts` — `regenerateWorld(seed)` + `pickStartSite`. Генерация мира.
- `src/games/colony/domain/save.ts` — `toSave`/`fromSave`. Граница сериализации.
- `tests/colony.noise.test.ts`, `tests/colony.worldgen.test.ts`, `tests/colony.save.roundtrip.test.ts` — новые наборы.

**Изменяемые файлы:**
- `src/games/colony/domain/types.ts` — `Biome` (вместо `Terrain`), `ResourceNode`/`NodeKind`, `Tile.biome/elevation/node`, `version`.
- `src/games/colony/systems/grid.ts` — шов-аксессоры (read/write/iter/`findNearestNode`).
- `src/games/colony/data/balance.ts` — параметры генерации, биом-таблицы.
- `src/games/colony/domain/createColony.ts` — через `regenerateWorld` + старт-площадку.
- `src/games/colony/systems/{pathfinding,jobScheduler,work,needs,temperature,rooms,build}.ts` — на аксессоры.
- `src/games/colony/scenes/WorldScene.ts` — чтение через аксессоры + биом-цвета (рендер-стиль прежний).
- `src/games/colony/ColonyGameModule.ts` — `toSave`/`fromSave`, `payloadVersion 5`.
- Существующие тесты: `colony.types`, `colony.grid`, `colony.createColony`, `colony.build`, `colony.work`, `colony.jobs`, `colony.pathfinding`, `colony.temperature`, `colony.needs`, `colony.cold`, `colony.playtest`, `colony.tick`, `colony.migration` — адаптация к биом-модели.

---

## Task 1: Сид-шум (`core/utils/noise.ts`)

**Files:**
- Create: `core/utils/noise.ts`
- Test: `tests/colony.noise.test.ts`

**Interfaces:**
- Produces: `fbm(seed: number, x: number, y: number, octaves?: number): number` → `[0,1)`; `valueNoise(seed, x, y): number` → `[0,1)`.

- [ ] **Step 1: Написать падающий тест**

```ts
// tests/colony.noise.test.ts
import { describe, it, expect } from 'vitest';
import { fbm, valueNoise } from '@/core/utils/noise';

describe('noise', () => {
  it('детерминирован: одинаковые аргументы → одинаковый результат', () => {
    expect(fbm(42, 1.5, 2.5)).toBe(fbm(42, 1.5, 2.5));
    expect(valueNoise(7, 3.2, 9.1)).toBe(valueNoise(7, 3.2, 9.1));
  });
  it('в диапазоне [0,1)', () => {
    for (let i = 0; i < 200; i++) {
      const v = fbm(1, i * 0.3, i * 0.7, 4);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it('меняется по координатам и по сиду', () => {
    expect(fbm(1, 0.1, 0.1)).not.toBe(fbm(1, 5.7, 8.3));
    expect(fbm(1, 2.2, 2.2)).not.toBe(fbm(2, 2.2, 2.2));
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npm test -- colony.noise`
Expected: FAIL — `Cannot find module '@/core/utils/noise'`.

- [ ] **Step 3: Реализовать `noise.ts`**

```ts
// core/utils/noise.ts
/** Детерминированный сид-шум: value-noise + fbm. Чистые функции от сида. */

/** Целочисленный хеш (x, y, seed) → [0,1). Детерминирован, без состояния. */
function hash2(seed: number, x: number, y: number): number {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 362437);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

/** Value-noise с билинейной сглаженной интерполяцией. Возвращает [0,1). */
export function valueNoise(seed: number, x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const u = smooth(x - xi);
  const v = smooth(y - yi);
  const a = hash2(seed, xi, yi);
  const b = hash2(seed, xi + 1, yi);
  const c = hash2(seed, xi, yi + 1);
  const d = hash2(seed, xi + 1, yi + 1);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

/** Фрактальный шум (сумма октав). Возвращает [0,1). */
export function fbm(seed: number, x: number, y: number, octaves = 4): number {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(seed + i * 1013, x * freq, y * freq);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}
```

- [ ] **Step 4: Запустить — зелёный**

Run: `npm test -- colony.noise`
Expected: PASS (3 теста).

- [ ] **Step 5: Коммит**

```bash
git add core/utils/noise.ts tests/colony.noise.test.ts
git commit -m "feat(colony): seeded value-noise + fbm for worldgen"
```

---

## Task 2: Биом-модель в типах (`domain/types.ts`)

**Files:**
- Modify: `src/games/colony/domain/types.ts`
- Test: `tests/colony.types.test.ts` (адаптация)

**Interfaces:**
- Produces: `Biome = 'water'|'marsh'|'meadow'|'grass'|'forest'|'rock'|'mountain'`; `NodeKind = 'wood'|'stone'|'clay'|'iron'|'gold'|'berries'|'fish'`; `ResourceNode { kind: NodeKind; amount: number; max: number }`; `Tile` получает `biome: Biome`, `elevation: number`, `node?: ResourceNode`; поле `terrain`/`wood` удалены.

- [ ] **Step 1: Обновить тест типов под биомы**

Открыть `tests/colony.types.test.ts`. Заменить любые ссылки `terrain: 'grass'` на `biome: 'grass'` и проверки `tile.wood` на `tile.node`. Добавить кейс:

```ts
it('Tile несёт биом, высоту и опц. узел ресурса', () => {
  const t: import('@/games/colony/domain/types').Tile = {
    x: 0, y: 0, biome: 'forest', elevation: 0.5, fertility: 0.4,
    passable: true, roomId: 0, temp: 16, node: { kind: 'wood', amount: 30, max: 30 },
  };
  expect(t.biome).toBe('forest');
  expect(t.node?.kind).toBe('wood');
});
```

- [ ] **Step 2: Запустить — падает (тип `terrain` ещё существует / `biome` нет)**

Run: `npm test -- colony.types`
Expected: FAIL (ошибка типов: `biome` отсутствует).

- [ ] **Step 3: Изменить `types.ts`**

Заменить строку 1 и интерфейс `Tile`:

```ts
// было: export type Terrain = 'grass' | 'forest' | 'rock' | 'water';
export type Biome = 'water' | 'marsh' | 'meadow' | 'grass' | 'forest' | 'rock' | 'mountain';
export type NodeKind = 'wood' | 'stone' | 'clay' | 'iron' | 'gold' | 'berries' | 'fish';
export interface ResourceNode { kind: NodeKind; amount: number; max: number; }
```

```ts
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
```

Если `Terrain` импортируется где-то ещё — это вскроется компилятором в следующих задачах (миграции). Здесь правим только `types.ts`.

- [ ] **Step 4: Запустить тест типов**

Run: `npm test -- colony.types`
Expected: PASS. (Полный `npm test` ещё красный — это нормально; чиним по задачам 3–16.)

- [ ] **Step 5: Коммит**

```bash
git add src/games/colony/domain/types.ts tests/colony.types.test.ts
git commit -m "feat(colony): biome model (Biome/ResourceNode) on Tile"
```

---

## Task 3: Шов-аксессоры (`systems/grid.ts`)

**Files:**
- Modify: `src/games/colony/systems/grid.ts`
- Test: `tests/colony.grid.test.ts` (расширить)

**Interfaces:**
- Consumes: `Tile`, `Biome`, `NodeKind`, `ResourceNode`, `Pt` (Task 2).
- Produces:
  - `type ColonyMap = { w: number; h: number; tiles: Tile[] }`; `type Grid = ColonyMap`.
  - `idx(x,y,w)`, `inBounds(x,y,m)`, `tileAt(x,y,m): Tile|undefined`, `neighbors4(x,y,m): Pt[]` (как раньше).
  - Чтения: `biomeAt(m,x,y): Biome|undefined`, `elevationAt(m,x,y): number`, `fertilityAt(m,x,y): number`, `passableAt(m,x,y): boolean`, `tempAt(m,x,y): number`, `roomIdAt(m,x,y): number`, `buildingIdAt(m,x,y): string|undefined`, `nodeAt(m,x,y): ResourceNode|undefined`.
  - Мутации: `setPassable(m,x,y,v)`, `setTemp(m,x,y,v)`, `setRoomId(m,x,y,v)`, `setBuildingId(m,x,y,id?)`, `setBiome(m,x,y,b)`, `setNode(m,x,y,n?)`, `depleteNode(m,x,y,amt): number` (берёт `min(amt, node.amount)`, уменьшает; при `<=0` очищает узел; возвращает фактически взятое).
  - Итерация/поиск: `forEachTile(m, fn:(i,x,y)=>void)`, `findNearestNode(m, from: Pt, kind: NodeKind): Pt | undefined` (План A — линейный; План B заменит на спатиал-индекс).

- [ ] **Step 1: Расширить тест grid**

Добавить в `tests/colony.grid.test.ts`:

```ts
import {
  biomeAt, passableAt, tempAt, nodeAt, setPassable, setBiome, setNode,
  depleteNode, findNearestNode, forEachTile,
} from '@/games/colony/systems/grid';
import type { ColonyMap } from '@/games/colony/systems/grid';

function makeMap(): ColonyMap {
  const w = 3, h = 1;
  const tiles = Array.from({ length: w * h }, (_, i) => ({
    x: i % w, y: 0, biome: 'grass' as const, elevation: 0.5, fertility: 0.4,
    passable: true, roomId: 0, temp: 16,
  }));
  return { w, h, tiles };
}

describe('grid accessors', () => {
  it('читают/пишут поля тайла', () => {
    const m = makeMap();
    expect(biomeAt(m, 0, 0)).toBe('grass');
    setBiome(m, 0, 0, 'forest');
    expect(biomeAt(m, 0, 0)).toBe('forest');
    setPassable(m, 1, 0, false);
    expect(passableAt(m, 1, 0)).toBe(false);
    expect(tempAt(m, 2, 0)).toBe(16);
  });
  it('узлы: установка, истощение, очистка', () => {
    const m = makeMap();
    setNode(m, 2, 0, { kind: 'wood', amount: 5, max: 10 });
    expect(nodeAt(m, 2, 0)?.amount).toBe(5);
    expect(depleteNode(m, 2, 0, 3)).toBe(3);
    expect(nodeAt(m, 2, 0)?.amount).toBe(2);
    expect(depleteNode(m, 2, 0, 99)).toBe(2);
    expect(nodeAt(m, 2, 0)).toBeUndefined();
  });
  it('findNearestNode возвращает ближайший тайл с узлом нужного вида', () => {
    const m = makeMap();
    setNode(m, 2, 0, { kind: 'wood', amount: 5, max: 5 });
    expect(findNearestNode(m, { x: 0, y: 0 }, 'wood')).toEqual({ x: 2, y: 0 });
    expect(findNearestNode(m, { x: 0, y: 0 }, 'stone')).toBeUndefined();
  });
  it('passableAt за границей — false', () => {
    const m = makeMap();
    expect(passableAt(m, -1, 0)).toBe(false);
    expect(passableAt(m, 9, 0)).toBe(false);
  });
});
```

- [ ] **Step 2: Запустить — падает**

Run: `npm test -- colony.grid`
Expected: FAIL — нет экспортов `biomeAt`/`findNearestNode`/…

- [ ] **Step 3: Переписать `grid.ts`**

```ts
import type { Biome, NodeKind, Pt, ResourceNode, Tile } from '../domain/types';

/** Хранилище карты. План A: массив тайлов. План B сменит бэкенд на типизированные
 *  массивы (SoA) — сигнатуры аксессоров ниже останутся прежними. */
export type ColonyMap = { w: number; h: number; tiles: Tile[] };
export type Grid = ColonyMap;

export const idx = (x: number, y: number, w: number): number => y * w + x;

export const inBounds = (x: number, y: number, m: ColonyMap): boolean =>
  x >= 0 && y >= 0 && x < m.w && y < m.h;

export const tileAt = (x: number, y: number, m: ColonyMap): Tile | undefined =>
  inBounds(x, y, m) ? m.tiles[idx(x, y, m.w)] : undefined;

// --- Чтения ---
export const biomeAt = (m: ColonyMap, x: number, y: number): Biome | undefined => tileAt(x, y, m)?.biome;
export const elevationAt = (m: ColonyMap, x: number, y: number): number => tileAt(x, y, m)?.elevation ?? 0;
export const fertilityAt = (m: ColonyMap, x: number, y: number): number => tileAt(x, y, m)?.fertility ?? 0;
export const passableAt = (m: ColonyMap, x: number, y: number): boolean => tileAt(x, y, m)?.passable ?? false;
export const tempAt = (m: ColonyMap, x: number, y: number): number => tileAt(x, y, m)?.temp ?? 0;
export const roomIdAt = (m: ColonyMap, x: number, y: number): number => tileAt(x, y, m)?.roomId ?? 0;
export const buildingIdAt = (m: ColonyMap, x: number, y: number): string | undefined => tileAt(x, y, m)?.buildingId;
export const nodeAt = (m: ColonyMap, x: number, y: number): ResourceNode | undefined => tileAt(x, y, m)?.node;

// --- Мутации (точечные) ---
export const setPassable = (m: ColonyMap, x: number, y: number, v: boolean): void => { const t = tileAt(x, y, m); if (t) t.passable = v; };
export const setTemp = (m: ColonyMap, x: number, y: number, v: number): void => { const t = tileAt(x, y, m); if (t) t.temp = v; };
export const setRoomId = (m: ColonyMap, x: number, y: number, v: number): void => { const t = tileAt(x, y, m); if (t) t.roomId = v; };
export const setBuildingId = (m: ColonyMap, x: number, y: number, id?: string): void => { const t = tileAt(x, y, m); if (t) t.buildingId = id; };
export const setBiome = (m: ColonyMap, x: number, y: number, b: Biome): void => { const t = tileAt(x, y, m); if (t) t.biome = b; };
export const setNode = (m: ColonyMap, x: number, y: number, n?: ResourceNode): void => { const t = tileAt(x, y, m); if (t) t.node = n; };

/** Уменьшает узел на `amt` (не больше остатка); очищает узел при <=0. Возвращает взятое. */
export function depleteNode(m: ColonyMap, x: number, y: number, amt: number): number {
  const t = tileAt(x, y, m);
  if (!t || !t.node) return 0;
  const take = Math.min(t.node.amount, amt);
  t.node.amount -= take;
  if (t.node.amount <= 0) t.node = undefined;
  return take;
}

const DIRS: Pt[] = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
export function neighbors4(x: number, y: number, m: ColonyMap): Pt[] {
  const out: Pt[] = [];
  for (const d of DIRS) {
    const nx = x + d.x;
    const ny = y + d.y;
    if (inBounds(nx, ny, m)) out.push({ x: nx, y: ny });
  }
  return out;
}

export function forEachTile(m: ColonyMap, fn: (i: number, x: number, y: number) => void): void {
  for (let i = 0; i < m.tiles.length; i++) fn(i, i % m.w, Math.floor(i / m.w));
}

/** Ближайший (манхэттен) тайл с узлом нужного вида. План A — линейный скан;
 *  План B заменит реализацию на спатиал-индекс (сигнатура неизменна). */
export function findNearestNode(m: ColonyMap, from: Pt, kind: NodeKind): Pt | undefined {
  let best: Pt | undefined;
  let bestD = Infinity;
  for (const t of m.tiles) {
    if (t.node?.kind !== kind || t.node.amount <= 0) continue;
    const d = Math.abs(t.x - from.x) + Math.abs(t.y - from.y);
    if (d < bestD) { bestD = d; best = { x: t.x, y: t.y }; }
  }
  return best;
}
```

- [ ] **Step 4: Запустить grid-тест**

Run: `npm test -- colony.grid`
Expected: PASS.

- [ ] **Step 5: Коммит**

```bash
git add src/games/colony/systems/grid.ts tests/colony.grid.test.ts
git commit -m "feat(colony): grid accessor seam (read/write/iter/findNearestNode)"
```

---

## Task 4: Параметры генерации и биом-таблицы (`data/balance.ts`)

**Files:**
- Modify: `src/games/colony/data/balance.ts`

**Interfaces:**
- Produces: `GEN` (объект параметров генерации), `BIOME_FERTILITY: Record<Biome, number>`. `MAP_W/MAP_H` остаются 28. `BUILD_COST`/etc. без изменений.

- [ ] **Step 1: Добавить параметры в `balance.ts`**

Дополнить существующий импорт типов сверху файла: добавить `Biome` к импорту из `../domain/types` (рядом с уже импортируемыми `BuildingType, JobType, ResourceId`):

```ts
import type { Biome } from '../domain/types';

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
```

- [ ] **Step 2: Проверка компиляции**

Run: `npm run typecheck` (или `npx tsc --noEmit`)
Expected: без новых ошибок в `balance.ts` (ошибки в системах, читающих `terrain`, — ожидаемы, чиним дальше).

- [ ] **Step 3: Коммит**

```bash
git add src/games/colony/data/balance.ts
git commit -m "feat(colony): worldgen params + biome fertility table"
```

---

## Task 5: Генерация мира (`domain/worldgen.ts`)

**Files:**
- Create: `src/games/colony/domain/worldgen.ts`
- Test: `tests/colony.worldgen.test.ts`

**Interfaces:**
- Consumes: `fbm` (Task 1), `Tile`/`Biome`/`ResourceNode` (Task 2), `GEN`/`BIOME_FERTILITY`/`MAP_W`/`MAP_H` (Task 4), `ColonyMap`/`idx`/`passableAt`/`neighbors4` (Task 3).
- Produces: `regenerateWorld(seed: number): ColonyMap`; `pickStartSite(m: ColonyMap): Pt`.

- [ ] **Step 1: Тест worldgen**

```ts
// tests/colony.worldgen.test.ts
import { describe, it, expect } from 'vitest';
import { regenerateWorld, pickStartSite } from '@/games/colony/domain/worldgen';
import { passableAt, biomeAt } from '@/games/colony/systems/grid';

describe('worldgen', () => {
  it('детерминирован: один сид → идентичная карта', () => {
    const a = regenerateWorld(123);
    const b = regenerateWorld(123);
    expect(a.tiles.map((t) => t.biome)).toEqual(b.tiles.map((t) => t.biome));
    expect(a.tiles.map((t) => t.node?.kind ?? null)).toEqual(b.tiles.map((t) => t.node?.kind ?? null));
  });
  it('разные сиды → разные карты', () => {
    const a = regenerateWorld(1).tiles.map((t) => t.biome).join('');
    const b = regenerateWorld(2).tiles.map((t) => t.biome).join('');
    expect(a).not.toBe(b);
  });
  it('биомы из допустимого набора; вода и горы непроходимы', () => {
    const m = regenerateWorld(7);
    const allowed = new Set(['water', 'marsh', 'meadow', 'grass', 'forest', 'rock', 'mountain']);
    for (const t of m.tiles) expect(allowed.has(t.biome)).toBe(true);
    for (const t of m.tiles) {
      if (t.biome === 'water' || t.biome === 'mountain') expect(t.passable).toBe(false);
    }
  });
  it('содержит леса с узлами дерева', () => {
    const m = regenerateWorld(7);
    expect(m.tiles.some((t) => t.node?.kind === 'wood')).toBe(true);
  });
  it('стартовая площадка проходима и не на воде', () => {
    const m = regenerateWorld(7);
    const s = pickStartSite(m);
    expect(passableAt(m, s.x, s.y)).toBe(true);
    expect(biomeAt(m, s.x, s.y)).not.toBe('water');
  });
});
```

- [ ] **Step 2: Запустить — падает**

Run: `npm test -- colony.worldgen`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать `worldgen.ts`**

```ts
// src/games/colony/domain/worldgen.ts
import { fbm } from '@/core/utils/noise';
import type { Biome, NodeKind, Pt, ResourceNode, Tile } from './types';
import { GEN, BIOME_FERTILITY, MAP_W, MAP_H } from '../data/balance';
import type { ColonyMap } from '../systems/grid';
import { idx, passableAt } from '../systems/grid';

/** Биом по высоте/влажности. */
function classify(elev: number, moist: number): Biome {
  if (elev < GEN.waterLevel) return 'water';
  if (elev < GEN.marshMax) return moist > 0.55 ? 'marsh' : 'grass';
  if (elev > GEN.mountainMin) return 'mountain';
  if (elev > GEN.rockMin) return 'rock';
  if (moist > GEN.forestMoist) return 'forest';
  if (moist > GEN.meadowMoist) return 'meadow';
  return 'grass';
}

/** Узел ресурса для тайла (детерминированно от сид-шума), либо undefined. */
function nodeFor(seed: number, x: number, y: number, biome: Biome): ResourceNode | undefined {
  const q = fbm(seed + 9001, x * 1.7, y * 1.7, 2); // отдельный поток шума под залежи
  const span = (min: number, max: number) => Math.floor(min + fbm(seed + 5, x, y, 2) * (max - min));
  const node = (kind: NodeKind, amount: number): ResourceNode => ({ kind, amount, max: amount });
  if (biome === 'forest') return node('wood', span(GEN.woodMin, GEN.woodMax));
  if (biome === 'rock' || biome === 'mountain') {
    if (q < GEN.pGold) return node('gold', span(GEN.oreMin, GEN.oreMax));
    if (q < GEN.pGold + GEN.pIron) return node('iron', span(GEN.oreMin, GEN.oreMax));
    if (q < GEN.pGold + GEN.pIron + GEN.pStone) return node('stone', span(GEN.oreMin, GEN.oreMax));
  }
  if (biome === 'marsh' && q < GEN.pClay) return node('clay', span(GEN.oreMin, GEN.oreMax));
  if ((biome === 'meadow' || biome === 'forest') && q > 1 - GEN.pBerries) return node('berries', span(10, 25));
  if (biome === 'water' && q < GEN.pFish) return node('fish', span(10, 25));
  return undefined;
}

/** Прорезает реки: из высоких точек спуск по градиенту высоты к воде. */
function carveRivers(seed: number, w: number, h: number, elev: Float64Array, isWater: Uint8Array): void {
  for (let r = 0; r < GEN.riverCount; r++) {
    // Детерминированный выбор истока из сид-шума.
    let x = 1 + Math.floor(fbm(seed + 100 + r, r * 13.3, 1.1, 2) * (w - 2));
    let y = 1 + Math.floor(fbm(seed + 200 + r, 2.2, r * 7.7, 2) * (h - 2));
    for (let step = 0; step < GEN.riverMaxSteps; step++) {
      isWater[idx(x, y, w)] = 1;
      let bx = x, by = y, be = elev[idx(x, y, w)];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const e = elev[idx(nx, ny, w)];
        if (e < be) { be = e; bx = nx; by = ny; }
      }
      if (bx === x && by === y) break;       // локальный минимум
      x = bx; y = by;
      if (elev[idx(x, y, w)] < GEN.waterLevel) break; // дошли до воды
    }
  }
}

export function regenerateWorld(seed: number): ColonyMap {
  const w = MAP_W, h = MAP_H;
  const elev = new Float64Array(w * h);
  const isWater = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const e = fbm(seed * 7 + 1, x / GEN.elevScale, y / GEN.elevScale, 5);
    elev[idx(x, y, w)] = e;
    if (e < GEN.waterLevel) isWater[idx(x, y, w)] = 1;
  }
  carveRivers(seed, w, h, elev, isWater);

  const tiles: Tile[] = new Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = idx(x, y, w);
    const e = elev[i];
    const moist = fbm(seed * 13 + 99, x / GEN.moistScale, y / GEN.moistScale, 4);
    const biome: Biome = isWater[i] ? 'water' : classify(e, moist);
    const passable = biome !== 'water' && biome !== 'mountain';
    const node = nodeFor(seed, x, y, biome);
    tiles[i] = {
      x, y, biome, elevation: e,
      fertility: BIOME_FERTILITY[biome],
      passable, roomId: 0, temp: 16,
      ...(node ? { node } : {}),
    };
  }
  return { w, h, tiles };
}

/** Стартовая площадка: проходимый луг/трава ближе к центру, рядом — вода и лес. */
export function pickStartSite(m: ColonyMap): Pt {
  const cx = m.w / 2, cy = m.h / 2;
  const near = (x: number, y: number, biome: Biome, rad: number): boolean => {
    for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) continue;
      if (m.tiles[idx(nx, ny, m.w)].biome === biome) return true;
    }
    return false;
  };
  let best: Pt | undefined;
  let bestScore = -Infinity;
  for (let y = 2; y < m.h - 2; y++) for (let x = 2; x < m.w - 2; x++) {
    const b = m.tiles[idx(x, y, m.w)].biome;
    if ((b !== 'meadow' && b !== 'grass') || !passableAt(m, x, y)) continue;
    let score = -(Math.abs(x - cx) + Math.abs(y - cy));      // ближе к центру лучше
    if (near(x, y, 'water', 6)) score += 5;
    if (near(x, y, 'forest', 8)) score += 5;
    if (score > bestScore) { bestScore = score; best = { x, y }; }
  }
  // Фолбэк: любой проходимый тайл ближе к центру (на случай вырожденной карты).
  if (!best) {
    for (let y = 0; y < m.h && !best; y++) for (let x = 0; x < m.w && !best; x++) {
      if (passableAt(m, x, y)) best = { x, y };
    }
  }
  return best ?? { x: Math.floor(cx), y: Math.floor(cy) };
}
```

- [ ] **Step 4: Запустить worldgen-тест**

Run: `npm test -- colony.worldgen`
Expected: PASS (5 тестов).

- [ ] **Step 5: Коммит**

```bash
git add src/games/colony/domain/worldgen.ts tests/colony.worldgen.test.ts
git commit -m "feat(colony): procedural worldgen (biomes/rivers/deposits/start-site)"
```

---

## Task 6: `createColony` на worldgen + старт-площадку

**Files:**
- Modify: `src/games/colony/domain/createColony.ts`
- Test: `tests/colony.createColony.test.ts` (адаптация)

**Interfaces:**
- Consumes: `regenerateWorld`, `pickStartSite` (Task 5); `passableAt` (Task 3).
- Produces: `createColony(seed)` с `state.map` от worldgen; колонисты — на проходимых тайлах вокруг старт-площадки; `state.version = 5`.

- [ ] **Step 1: Адаптировать тест createColony**

Открыть `tests/colony.createColony.test.ts`. Убрать ожидания вида «центр — grass с fertility 0.6». Заменить на инвариант «все колонисты на проходимых тайлах»:

```ts
import { passableAt } from '@/games/colony/systems/grid';
// ...
it('колонисты спавнятся на проходимых тайлах у старт-площадки', () => {
  const s = createColony(42);
  expect(s.colonists.length).toBeGreaterThan(0);
  for (const c of s.colonists) {
    expect(passableAt(s.map, Math.round(c.pos.x), Math.round(c.pos.y))).toBe(true);
  }
});
it('версия пейлоада = 5', () => {
  expect(createColony(1).version).toBe(5);
});
```

- [ ] **Step 2: Запустить — падает**

Run: `npm test -- colony.createColony`
Expected: FAIL (старые ожидания/версия).

- [ ] **Step 3: Переписать генерацию мира в `createColony.ts`**

Заменить импорт `genTile`/ручную сборку `tiles` на worldgen. Новый верх файла и тело:

```ts
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
```

- [ ] **Step 4: Запустить createColony-тест**

Run: `npm test -- colony.createColony`
Expected: PASS.

- [ ] **Step 5: Коммит**

```bash
git add src/games/colony/domain/createColony.ts tests/colony.createColony.test.ts
git commit -m "feat(colony): createColony uses worldgen + start-site, version 5"
```

---

## Task 7: Миграция `build.ts` на аксессоры

**Files:**
- Modify: `src/games/colony/systems/build.ts`
- Test: `tests/colony.build.test.ts` (адаптация под биомы)

**Interfaces:**
- Consumes: `biomeAt`, `buildingIdAt` (Task 3).
- Produces: `canPlace`/`placeBlueprint` без изменений сигнатур.

- [ ] **Step 1: Обновить тест build**

В `tests/colony.build.test.ts` заменить кейсы про `terrain: 'rock'`/`'water'` на биомы. Зафиксировать правило: строить нельзя на `water`/`mountain`; на `rock` — можно.

```ts
import { setBiome } from '@/games/colony/systems/grid';
// внутри теста, где готовится карта:
it('нельзя строить на воде и горах, можно на скале', () => {
  const s = createColony(1);
  setBiome(s.map, 5, 5, 'water');
  setBiome(s.map, 6, 5, 'mountain');
  setBiome(s.map, 7, 5, 'rock');
  expect(canPlace(s, 5, 5)).toBe(false);
  expect(canPlace(s, 6, 5)).toBe(false);
  expect(canPlace(s, 7, 5)).toBe(true);
});
```

- [ ] **Step 2: Запустить — падает (canPlace ещё смотрит `terrain`)**

Run: `npm test -- colony.build`
Expected: FAIL (компиляция: `t.terrain`).

- [ ] **Step 3: Переписать `canPlace`**

```ts
import { makeId } from '@/core/utils';
import type { BuildingType, ColonyState } from '../domain/types';
import { BUILD_COST, BUILD_REQUIRED, BUILDING_JOB, BUILDING_WORK_SLOTS } from '../data/balance';
import { biomeAt, buildingIdAt, inBounds } from './grid';

export function canPlace(s: ColonyState, x: number, y: number): boolean {
  if (!inBounds(x, y, s.map)) return false;
  const b = biomeAt(s.map, x, y);
  if (b === 'water' || b === 'mountain') return false;
  if (buildingIdAt(s.map, x, y)) return false;
  if (s.buildings.some((bl) => bl.tile.x === x && bl.tile.y === y)) return false;
  return true;
}
```

(`placeBlueprint` ниже без изменений.)

- [ ] **Step 4: Запустить build-тест**

Run: `npm test -- colony.build`
Expected: PASS.

- [ ] **Step 5: Коммит**

```bash
git add src/games/colony/systems/build.ts tests/colony.build.test.ts
git commit -m "refactor(colony): build.ts via grid accessors + biome rules"
```

---

## Task 8: Миграция `pathfinding.ts` на аксессоры

**Files:**
- Modify: `src/games/colony/systems/pathfinding.ts`
- Test: `tests/colony.pathfinding.test.ts` (адаптация конструкции карты)

**Interfaces:**
- Consumes: `passableAt`, `neighbors4`, `idx` (Task 3); тип `Grid = ColonyMap`.
- Produces: `findPath(g, start, goal)` — сигнатура неизменна.

- [ ] **Step 1: Адаптировать тест pathfinding**

Там, где тест собирает карту вручную, тайлы должны иметь `biome`/`elevation` вместо `terrain`. Заменить хелпер-конструктор. Поведенческие проверки (путь/обход/нет пути) не меняются. Пример конструктора:

```ts
import type { ColonyMap } from '@/games/colony/systems/grid';
function grid(w: number, h: number, blocked: [number, number][]): ColonyMap {
  const tiles = Array.from({ length: w * h }, (_, i) => ({
    x: i % w, y: Math.floor(i / w), biome: 'grass' as const, elevation: 0.5,
    fertility: 0.5, passable: true, roomId: 0, temp: 16,
  }));
  for (const [x, y] of blocked) tiles[y * w + x].passable = false;
  return { w, h, tiles };
}
```

- [ ] **Step 2: Запустить — падает (компиляция/`tileAt(...).passable`)**

Run: `npm test -- colony.pathfinding`
Expected: FAIL.

- [ ] **Step 3: Заменить чтение проходимости в `pathfinding.ts`**

В импортах: `import { type Grid, idx, neighbors4, passableAt } from './grid';` (убрать `tileAt`).
В цикле соседей заменить блок проверки проходимости:

```ts
    for (const n of neighbors4(cur.x, cur.y, g)) {
      const isGoal = n.x === goal.x && n.y === goal.y;
      if (!isGoal && !passableAt(g, n.x, n.y)) continue; // в цель можно войти даже если непроходима
      const nk = key(n.x, n.y);
      const tentative = cg + 1;
      // ... остальное без изменений
```

- [ ] **Step 4: Запустить pathfinding-тест**

Run: `npm test -- colony.pathfinding`
Expected: PASS.

- [ ] **Step 5: Коммит**

```bash
git add src/games/colony/systems/pathfinding.ts tests/colony.pathfinding.test.ts
git commit -m "refactor(colony): pathfinding via passableAt accessor"
```

---

## Task 9: Миграция `jobScheduler.ts` (рубка → узлы дерева)

**Files:**
- Modify: `src/games/colony/systems/jobScheduler.ts`
- Test: `tests/colony.jobs.test.ts` (адаптация: лес как узел дерева)

**Interfaces:**
- Consumes: `findNearestNode` (Task 3).
- Produces: `runJobScheduler(s)` — сигнатура неизменна; поиск цели рубки идёт через `findNearestNode(s.map, from, 'wood')`.

- [ ] **Step 1: Адаптировать тест jobs**

Где тест готовит лес для рубки — ставить узел дерева через `setNode`:

```ts
import { setNode } from '@/games/colony/systems/grid';
// ...
setNode(s.map, tx, ty, { kind: 'wood', amount: 30, max: 30 });
setBiome(s.map, tx, ty, 'forest'); // если тест проверяет биом
```

- [ ] **Step 2: Запустить — падает (старый скан `t.terrain==='forest'`/`t.wood`)**

Run: `npm test -- colony.jobs`
Expected: FAIL.

- [ ] **Step 3: Переписать ветку `woodcut` в `findTarget`**

Импорт: `import { findNearestNode } from './grid';` (плюс существующий `tileAt`).
Заменить блок `if (job === 'woodcut') { ... }`:

```ts
  if (job === 'woodcut') {
    const tile = findNearestNode(s.map, from, 'wood');
    return tile ? { tile } : null;
  }
```

(Ветки `farm/research/tailor/build` без изменений.)

- [ ] **Step 4: Запустить jobs-тест**

Run: `npm test -- colony.jobs`
Expected: PASS.

- [ ] **Step 5: Коммит**

```bash
git add src/games/colony/systems/jobScheduler.ts tests/colony.jobs.test.ts
git commit -m "refactor(colony): woodcut targeting via findNearestNode('wood')"
```

---

## Task 10: Миграция `work.ts` (фермы/рубка/стройка на аксессоры)

**Files:**
- Modify: `src/games/colony/systems/work.ts`
- Test: `tests/colony.work.test.ts` (адаптация)

**Interfaces:**
- Consumes: `fertilityAt`, `tempAt`, `nodeAt`, `depleteNode`, `setBiome`, `setNode`, `setBuildingId`, `setPassable` (Task 3).
- Produces: `runWork(s)` — поведение прежнее: ферма мёрзнет при `temp<=FARM_FREEZE_TEMP`, рубка истощает узел и переводит тайл в `grass`, стройка стены делает тайл непроходимым.

- [ ] **Step 1: Адаптировать тест work**

В кейсах рубки — узел дерева через `setNode`; проверка «делянка кончилась → биом grass, узел очищен». В кейсах фермы — `fertility`/`temp` ставить через тайл или `setTemp`. Пример рубки:

```ts
import { setNode, setBiome, nodeAt, biomeAt, setTemp } from '@/games/colony/systems/grid';
// ...
setBiome(s.map, tx, ty, 'forest');
setNode(s.map, tx, ty, { kind: 'wood', amount: 1, max: 30 }); // почти пусто
// прогнать work с колонистом, нацеленным на (tx,ty) ...
expect(biomeAt(s.map, tx, ty)).toBe('grass');
expect(nodeAt(s.map, tx, ty)).toBeUndefined();
```

- [ ] **Step 2: Запустить — падает (компиляция: `t.terrain`/`t.wood`/`t.temp`/`t.fertility`)**

Run: `npm test -- colony.work`
Expected: FAIL.

- [ ] **Step 3: Переписать чтения/мутации тайлов в `runWork`**

Импорт: заменить `import { tileAt } from './grid';` на
`import { fertilityAt, tempAt, nodeAt, depleteNode, setBiome, setNode, setBuildingId, setPassable } from './grid';`

Завершение стройки (блок `if (building.buildProgress >= building.buildRequired)`):

```ts
      if (building.buildProgress >= building.buildRequired) {
        building.built = true;
        setBuildingId(s.map, building.tile.x, building.tile.y, building.id);
        if (building.type === 'wall') setPassable(s.map, building.tile.x, building.tile.y, false);
        applyStorageCapacity(s);
        s.log.push({ day: s.day, text: `Построено: ${building.type}.`, tone: 'good' });
        finishWork(c);
      }
```

Ферма (ветка `building.jobType === 'farm'`):

```ts
      if (building.jobType === 'farm') {
        if (tempAt(s.map, building.tile.x, building.tile.y) <= FARM_FREEZE_TEMP) { /* мёрзлая земля */ }
        else {
          const fert = 0.5 + fertilityAt(s.map, building.tile.x, building.tile.y);
          addResource(s, 'food', FARM_BASE * skillMultiplier(c.skills.farming.level) * workSpeed(c) * fert * cf);
          grantXp(c.skills.farming, XP_PER_WORK_TICK);
        }
      }
```

Рубка (блок `if (!building && c.targetTile)`):

```ts
    if (!building && c.targetTile) {
      const tx = c.targetTile.x, ty = c.targetTile.y;
      const node = nodeAt(s.map, tx, ty);
      if (node && node.kind === 'wood' && node.amount > 0) {
        const want = WOODCUT_BASE * skillMultiplier(c.skills.woodcutting.level) * workSpeed(c) * cf;
        const took = depleteNode(s.map, tx, ty, want);
        addResource(s, 'wood', took);
        grantXp(c.skills.woodcutting, XP_PER_WORK_TICK);
        if (!nodeAt(s.map, tx, ty)) {     // делянка кончилась
          setBiome(s.map, tx, ty, 'grass');
          finishWork(c);
        }
      } else {
        finishWork(c);
      }
      continue;
    }
```

Удалить более не нужный импорт типа `Tile` из строки 2, если он остался неиспользованным.

- [ ] **Step 4: Запустить work-тест**

Run: `npm test -- colony.work`
Expected: PASS.

- [ ] **Step 5: Коммит**

```bash
git add src/games/colony/systems/work.ts tests/colony.work.test.ts
git commit -m "refactor(colony): work.ts via grid accessors (farm/woodcut/build)"
```

---

## Task 11: Миграция `needs.ts` (температура тайла через аксессор)

**Files:**
- Modify: `src/games/colony/systems/needs.ts`
- Test: `tests/colony.needs.test.ts`, `tests/colony.cold.test.ts` (адаптация при необходимости)

**Interfaces:**
- Consumes: `tempAt` (Task 3).
- Produces: `runNeeds(s)`, `coldWorkFactor(c)` — без изменений сигнатур.

- [ ] **Step 1: Запустить тесты needs/cold (проверить, что падает только на компиляции)**

Run: `npm test -- colony.needs colony.cold`
Expected: FAIL — компиляция: `s.map.tiles[idx(...)]` всё ещё валидно типово, но поле `.temp` читается напрямую. (Если тип ещё компилируется — тест может проходить; всё равно мигрируем на аксессор ради шва.)

- [ ] **Step 2: Заменить чтение температуры под колонистом**

Импорт: убрать `import { idx } from './grid';`, добавить `import { tempAt } from './grid';`.
Блок «холод» (строки ~44–45):

```ts
    // 1b) Холод: эффективная температура = тайл под колонистом + одежда.
    const tileTemp = tempAt(s.map, Math.round(c.pos.x), Math.round(c.pos.y));
    const effTemp = tileTemp + (c.clothed ? CLOTHING_WARMTH : 0);
```

- [ ] **Step 3: Запустить needs/cold-тесты**

Run: `npm test -- colony.needs colony.cold`
Expected: PASS.

- [ ] **Step 4: Коммит**

```bash
git add src/games/colony/systems/needs.ts
git commit -m "refactor(colony): needs.ts reads tile temp via tempAt"
```

---

## Task 12: Миграция `temperature.ts` на аксессоры

**Files:**
- Modify: `src/games/colony/systems/temperature.ts`
- Test: `tests/colony.temperature.test.ts`

**Interfaces:**
- Consumes: `roomIdAt`, `setTemp`, `forEachTile` (Task 3).
- Produces: `runTemperature(s)` — без изменений поведения.

- [ ] **Step 1: Запустить temperature-тест (увидеть провал/компиляцию)**

Run: `npm test -- colony.temperature`
Expected: FAIL после правок типов (или PASS, но мигрируем ради шва).

- [ ] **Step 2: Переписать чтение/запись температуры**

Импорт: `import { roomIdAt, setTemp, forEachTile } from './grid';` (убрать `idx`).
Определение комнаты обогревателя:

```ts
  for (const b of s.buildings) {
    if (b.type !== 'heater' || !b.built) continue;
    const rid = roomIdAt(s.map, b.tile.x, b.tile.y);
    if (rid === 0) continue;
    if (s.resources.wood.amount >= HEATER_FUEL_PER_TICK) {
      s.resources.wood.amount -= HEATER_FUEL_PER_TICK;
      activeByRoom.set(rid, (activeByRoom.get(rid) ?? 0) + 1);
    }
  }
```

Запись температуры в тайлы (заменить финальный цикл `for (const t of s.map.tiles)`):

```ts
  const roomTemp = new Map<number, number>();
  for (const room of s.rooms) roomTemp.set(room.id, room.temp);
  forEachTile(s.map, (_i, x, y) => {
    const rid = roomIdAt(s.map, x, y);
    setTemp(s.map, x, y, rid === 0 ? outdoor : roomTemp.get(rid) ?? outdoor);
  });
```

- [ ] **Step 3: Запустить temperature-тест**

Run: `npm test -- colony.temperature`
Expected: PASS.

- [ ] **Step 4: Коммит**

```bash
git add src/games/colony/systems/temperature.ts
git commit -m "refactor(colony): temperature.ts via grid accessors"
```

---

## Task 13: Миграция `rooms.ts` (roomId через аксессоры)

**Files:**
- Modify: `src/games/colony/systems/rooms.ts`
- Test: покрыт `colony.temperature`/`colony.tick` (отдельного `rooms`-теста нет).

**Interfaces:**
- Consumes: `idx`, `roomIdAt`, `setRoomId` (Task 3).
- Produces: `recomputeRooms(s)`, `wallsDoorsSig(s)` — без изменений поведения.

- [ ] **Step 1: Переписать чтения/записи `roomId` в `recomputeRooms`**

Барьер/`outside` остаются на локальных `Uint8Array` (это не состояние тайлов). Меняются только обращения к `tiles[i].roomId`.

Импорт: `import { idx, roomIdAt, setRoomId } from './grid';`

Сброс комнат (строка `for (const t of tiles) t.roomId = 0;`):

```ts
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) setRoomId(s.map, x, y, 0);
```

В главном цикле нумерации комнат заменить прямые `tiles[i].roomId`:

```ts
  for (let i = 0; i < w * h; i++) {
    const ix = i % w, iy = Math.floor(i / w);
    if (barrier[i] || outside[i] || roomIdAt(s.map, ix, iy) !== 0) continue;
    const comp: number[] = [];
    const q = [i];
    setRoomId(s.map, ix, iy, nextId);
    while (q.length) {
      const j = q.pop()!;
      comp.push(j);
      const x = j % w, y = Math.floor(j / w);
      const visit = (nx: number, ny: number) => {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) return;
        const nj = idx(nx, ny, w);
        if (barrier[nj] || outside[nj] || roomIdAt(s.map, nx, ny) !== 0) return;
        setRoomId(s.map, nx, ny, nextId);
        q.push(nj);
      };
      visit(x + 1, y); visit(x - 1, y); visit(x, y + 1); visit(x, y - 1);
    }
    rooms.push({ id: nextId, tiles: comp, temp: s.env.outdoorTemp, area: comp.length });
    nextId += 1;
  }
  s.rooms = rooms;
```

Заметь: верхняя строка `const { w, h, tiles } = s.map;` → `const { w, h } = s.map;` (переменная `tiles` больше не используется напрямую).

- [ ] **Step 2: Запустить зависимые тесты**

Run: `npm test -- colony.temperature colony.tick`
Expected: PASS.

- [ ] **Step 3: Коммит**

```bash
git add src/games/colony/systems/rooms.ts
git commit -m "refactor(colony): rooms.ts roomId via grid accessors"
```

---

## Task 14: Граница сериализации (`domain/save.ts`)

**Files:**
- Create: `src/games/colony/domain/save.ts`
- Test: `tests/colony.save.roundtrip.test.ts`

**Interfaces:**
- Consumes: `regenerateWorld` (Task 5); `ColonyState`/`Tile`/`Biome` (Task 2); `idx`, `setBuildingId`, `setPassable` (Task 3).
- Produces:
  - `interface ColonySave { version; seed; rngState; tick; day; phase; speed; resources; colonists; buildings; rooms; roomSig; tailorProgress; stock; env; log; flags; overrides: TileOverride[]; }`
  - `interface TileOverride { i: number; biome?: Biome; nodeAmount?: number | null; }`
  - `toSave(s: ColonyState): ColonySave` — сетка не сериализуется; пишутся разреженные оверрайды (тайлы, чей биом/узел отличается от свежей генерации).
  - `fromSave(p: ColonySave): ColonyState` — `regenerateWorld(p.seed)` → накат оверрайдов → восстановление `buildingId`/`passable` из `buildings` → `roomSig=''` (комнаты пересчитает система).

- [ ] **Step 1: Тест round-trip**

```ts
// tests/colony.save.roundtrip.test.ts
import { describe, it, expect } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { toSave, fromSave } from '@/games/colony/domain/save';
import { nodeAt, biomeAt } from '@/games/colony/systems/grid';
import { idx } from '@/games/colony/systems/grid';

describe('save round-trip', () => {
  it('мир регенерируется из сида идентично (биомы)', () => {
    const s = createColony(77);
    const r = fromSave(toSave(s));
    expect(r.map.tiles.map((t) => t.biome)).toEqual(s.map.tiles.map((t) => t.biome));
    expect(r.seed).toBe(s.seed);
    expect(r.version).toBe(s.version);
  });
  it('истощение узла и смена биома (рубка) переживают сейв', () => {
    const s = createColony(77);
    // Найдём тайл с деревом и «вырубим» его вручную.
    const wt = s.map.tiles.find((t) => t.node?.kind === 'wood')!;
    wt.node = undefined;
    wt.biome = 'grass';
    const r = fromSave(toSave(s));
    expect(nodeAt(r.map, wt.x, wt.y)).toBeUndefined();
    expect(biomeAt(r.map, wt.x, wt.y)).toBe('grass');
  });
  it('частичное истощение узла переживает сейв', () => {
    const s = createColony(77);
    const wt = s.map.tiles.find((t) => t.node?.kind === 'wood')!;
    wt.node!.amount = 3;
    const r = fromSave(toSave(s));
    expect(nodeAt(r.map, wt.x, wt.y)?.amount).toBe(3);
  });
  it('постройки восстанавливают buildingId/passable тайла', () => {
    const s = createColony(77);
    const t = s.map.tiles.find((tt) => tt.passable && !tt.node)!;
    s.buildings.push({
      id: 'b1', type: 'wall', tile: { x: t.x, y: t.y }, workSlots: 0,
      jobType: undefined, built: true, buildProgress: 8, buildRequired: 8,
    });
    const r = fromSave(toSave(s));
    expect(r.map.tiles[idx(t.x, t.y, r.map.w)].buildingId).toBe('b1');
    expect(r.map.tiles[idx(t.x, t.y, r.map.w)].passable).toBe(false);
  });
});
```

- [ ] **Step 2: Запустить — падает**

Run: `npm test -- colony.save.roundtrip`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать `save.ts`**

```ts
// src/games/colony/domain/save.ts
import type { Biome, Building, Colonist, ColonyState, LogEntry, Resource, ResourceId, Room } from './types';
import { regenerateWorld } from './worldgen';
import { idx, setBuildingId, setPassable } from '../systems/grid';

export interface TileOverride { i: number; biome?: Biome; nodeAmount?: number | null; }

export interface ColonySave {
  version: number;
  seed: number;
  rngState: number;
  tick: number;
  day: number;
  phase: ColonyState['phase'];
  speed: number;
  resources: Record<ResourceId, Resource>;
  colonists: Colonist[];
  buildings: Building[];
  rooms: Room[];
  roomSig: string;
  tailorProgress: number;
  stock: { clothing: number };
  env: ColonyState['env'];
  log: LogEntry[];
  flags: { gameOver: boolean; victory: boolean };
  overrides: TileOverride[];
}

/** Разреженные оверрайды: тайлы, чей биом/узел отличается от свежей генерации. */
function diffOverrides(s: ColonyState): TileOverride[] {
  const fresh = regenerateWorld(s.seed);
  const out: TileOverride[] = [];
  for (let i = 0; i < s.map.tiles.length; i++) {
    const cur = s.map.tiles[i];
    const gen = fresh.tiles[i];
    const biomeChanged = cur.biome !== gen.biome;
    const curAmt = cur.node?.amount ?? null;
    const genAmt = gen.node?.amount ?? null;
    const nodeChanged = curAmt !== genAmt;
    if (biomeChanged || nodeChanged) {
      out.push({
        i,
        ...(biomeChanged ? { biome: cur.biome } : {}),
        ...(nodeChanged ? { nodeAmount: curAmt } : {}),
      });
    }
  }
  return out;
}

export function toSave(s: ColonyState): ColonySave {
  return {
    version: s.version,
    seed: s.seed,
    rngState: s.rngState,
    tick: s.tick,
    day: s.day,
    phase: s.phase,
    speed: s.speed,
    resources: s.resources,
    colonists: s.colonists,
    buildings: s.buildings,
    rooms: s.rooms,
    roomSig: s.roomSig,
    tailorProgress: s.tailorProgress,
    stock: s.stock,
    env: s.env,
    log: s.log,
    flags: s.flags,
    overrides: diffOverrides(s),
  };
}

export function fromSave(p: ColonySave): ColonyState {
  const map = regenerateWorld(p.seed);
  // Накат оверрайдов тайлов.
  for (const o of p.overrides) {
    const t = map.tiles[o.i];
    if (!t) continue;
    if (o.biome !== undefined) t.biome = o.biome;
    if (o.nodeAmount !== undefined) {
      if (o.nodeAmount === null) t.node = undefined;
      else if (t.node) t.node.amount = o.nodeAmount;
    }
  }
  // Восстановление производного из построек.
  for (const b of p.buildings) {
    if (!b.built) continue;
    setBuildingId(map, b.tile.x, b.tile.y, b.id);
    if (b.type === 'wall') setPassable(map, b.tile.x, b.tile.y, false);
  }
  return {
    version: p.version,
    seed: p.seed,
    rngState: p.rngState,
    tick: p.tick,
    day: p.day,
    phase: p.phase,
    speed: p.speed,
    resources: p.resources,
    colonists: p.colonists,
    buildings: p.buildings,
    rooms: [],          // пересчитает recomputeRooms (roomSig сброшен)
    roomSig: '',
    tailorProgress: p.tailorProgress,
    stock: p.stock,
    env: p.env,
    map,
    log: p.log,
    flags: p.flags,
  };
}

// idx экспортируется для тестов/потребителей удобства.
export { idx };
```

- [ ] **Step 4: Запустить save-тест**

Run: `npm test -- colony.save.roundtrip`
Expected: PASS (4 теста).

- [ ] **Step 5: Коммит**

```bash
git add src/games/colony/domain/save.ts tests/colony.save.roundtrip.test.ts
git commit -m "feat(colony): toSave/fromSave — seed-regen + sparse tile overrides"
```

---

## Task 15: Подключить сейвы и поднять версию (`ColonyGameModule.ts`)

**Files:**
- Modify: `src/games/colony/ColonyGameModule.ts`
- Modify: `src/games/colony/scenes/WorldScene.ts` (autosave через `toSave`)
- Test: `tests/colony.migration.test.ts` (адаптация версии), `tests/save.test.ts` (если завязан на колонию — проверить)

**Interfaces:**
- Consumes: `toSave`/`fromSave` (Task 14).
- Produces: `payloadVersion = 5`; загрузка через `fromSave`; автосейв через `toSave`.

- [ ] **Step 1: Адаптировать тест миграции**

В `tests/colony.migration.test.ts` обновить ожидаемую версию на `5` и (если есть) проверку отказа старого сейва `version=4`. Если тест грузит сейв — оборачивать ожидаемый стейт через `toSave`/`fromSave`.

- [ ] **Step 2: Запустить — падает (версия)**

Run: `npm test -- colony.migration save`
Expected: FAIL (версия 4 vs 5).

- [ ] **Step 3: Обновить `ColonyGameModule.ts`**

```ts
import { createColony } from './domain/createColony';
import { toSave, fromSave, type ColonySave } from './domain/save';
// ...
const COLONY_PAYLOAD_VERSION = 5;
// ...
    if (ctx.mode === 'load') {
      const loaded = (await ctx.save.load(ctx.slot)) as ColonySave | null;
      if (loaded && loaded.version === COLONY_PAYLOAD_VERSION) state = fromSave(loaded);
    }
    if (!state) state = createColony(randomSeed());
```

- [ ] **Step 4: Обновить автосейв в `WorldScene.ts`**

Импорт: `import { toSave } from '../domain/save';`
В `onNewDay` заменить `this.ctx.save.autosave(s, ...)` на:

```ts
    this.ctx.save.autosave(toSave(s), `День ${s.day} · ${pop} жит.`);
```

- [ ] **Step 5: Запустить тесты**

Run: `npm test -- colony.migration save`
Expected: PASS.

- [ ] **Step 6: Коммит**

```bash
git add src/games/colony/ColonyGameModule.ts src/games/colony/scenes/WorldScene.ts tests/colony.migration.test.ts
git commit -m "feat(colony): payloadVersion 5; save via toSave/fromSave"
```

---

## Task 16: Адаптация рендера-чтений в `WorldScene.ts` (биом-цвета через аксессоры)

**Files:**
- Modify: `src/games/colony/scenes/WorldScene.ts`
- Test: ручная проверка сборки/типов (сцена не покрыта юнит-тестами).

**Interfaces:**
- Consumes: `biomeAt`/`tempAt`/`passableAt`/`buildingIdAt`/`forEachTile` (Task 3); `canPlace`/`placeBlueprint` (Task 7).
- Produces: рендер той же структуры (плоские прямоугольники), но: цвет тайла по биому, чтение температуры/выбора через аксессоры. Перепись рендера — План C.

- [ ] **Step 1: Заменить таблицу цветов террейна на биомы**

```ts
const BIOME_COLOR: Record<string, number> = {
  water: 0x1d4256, marsh: 0x3b4a2c, meadow: 0x4f7d33, grass: 0x223018,
  forest: 0x1b2a12, rock: 0x2c2c26, mountain: 0x4a4a44,
};
```

- [ ] **Step 2: `drawMap` через аксессоры/биом-цвет**

```ts
  private drawMap() {
    const g = this.add.graphics();
    for (const t of this.state.map.tiles) {
      g.fillStyle(BIOME_COLOR[t.biome] ?? 0x222222, 1);
      g.fillRect(t.x * TILE, t.y * TILE, TILE - 1, TILE - 1);
    }
    g.lineStyle(1, 0x000000, 0.15);
    g.strokeRect(0, 0, this.mapPxW, this.mapPxH);
  }
```

(Оверлей температуры уже читает `t.temp` — допустимо; при желании заменить на `tempAt`. Клик-выбор/ghost используют `canPlace`/`placeBlueprint` — без изменений.)

- [ ] **Step 3: Сборка + типчек**

Run: `npm run build` (или `npx tsc --noEmit`)
Expected: без ошибок типов. Все ссылки на `terrain`/`tile.wood` устранены.

- [ ] **Step 4: Коммит**

```bash
git add src/games/colony/scenes/WorldScene.ts
git commit -m "refactor(colony): WorldScene reads biomes via accessors (render style unchanged)"
```

---

## Task 17: Финальная проверка шва, детерминизма, полного прогона

**Files:**
- Test: весь набор; адаптация `tests/colony.playtest.test.ts`/`tests/colony.tick.test.ts` при необходимости.

- [ ] **Step 1: Прогнать весь набор**

Run: `npm test`
Expected: все наборы зелёные. Если `playtest`/`tick` опираются на старую карту (напр. ожидают конкретный биом в центре) — адаптировать ожидания к worldgen (инварианты, а не конкретные тайлы), пере-прогнать.

- [ ] **Step 2: Проверить отсутствие прямого доступа к тайлам вне аксессоров**

Run (Git Bash):
```bash
grep -rn "map.tiles\[" src/games/colony/systems src/games/colony/domain | grep -v "grid.ts"
```
Expected: пусто (или только `forEachTile`/`save.ts` оверрайды по индексу `map.tiles[i]`, что допустимо как сериализация). Поля `terrain`/`wood` тайла удалены — прямых обращений быть не должно (греп ниже не должен ловить легитимный `resources.wood`):
```bash
grep -rn "\.terrain\b" src/games/colony
grep -rnE "\b(t|tile|ct|wt)\.wood\b" src/games/colony
```
Expected: пусто.

- [ ] **Step 3: Тест детерминизма прогона (добавить, если отсутствует)**

```ts
// в tests/colony.tick.test.ts добавить
it('один сид → идентичный прогон 300 тиков', () => {
  const a = createColony(2024);
  const b = createColony(2024);
  for (let i = 0; i < 300; i++) { tick(a); tick(b); }
  expect(a.resources.wood.amount).toBe(b.resources.wood.amount);
  expect(a.colonists.map((c) => `${c.pos.x.toFixed(3)},${c.pos.y.toFixed(3)}`))
    .toEqual(b.colonists.map((c) => `${c.pos.x.toFixed(3)},${c.pos.y.toFixed(3)}`));
});
```

- [ ] **Step 4: Зелёный полный прогон + коммит**

Run: `npm test`
Expected: PASS (включая новый детерминизм-тест).

```bash
git add -A
git commit -m "test(colony): determinism run + accessor-seam guard; Plan A green"
```

---

## Self-Review (выполнено при написании плана)

**1. Покрытие спеки (Плана A-части Фундамента):**
- Биомы/реки/залежи/стартовая площадка → Task 5 (worldgen), Task 1 (noise).
- SoA-готовность через шов-аксессоров → Task 3 (grid) + миграции Task 7–13, 16. (Сам SoA-бэкенд — План B; шов введён здесь, как и решено.)
- Регенерация-из-сида + граница сериализации `toSave/fromSave` → Task 14–15.
- `payloadVersion` бамп → Task 15.
- Детерминизм → Global Constraints + Task 17.
- Биом-модель/`ResourceNode` → Task 2. Плодородие → Task 4/5.
- *Вне Плана A (отложено в B/C, явно):* 256² масштаб, иерархический pathfinding, спатиал-индекс, тайм-слайс, чанковый 2.5D-рендер, камера/миникарта. Зафиксировано в шапке и в спеке §13.

**2. Плейсхолдеры:** код приведён в каждом шаге; «TBD/TODO» нет. Балансные числа — конкретные значения в `GEN` (Task 4), не плейсхолдеры.

**3. Согласованность типов:** имена аксессоров (`biomeAt/passableAt/tempAt/nodeAt/setPassable/setBiome/setNode/depleteNode/setBuildingId/setRoomId/roomIdAt/findNearestNode/forEachTile`) определены в Task 3 и используются теми же сигнатурами в Task 5–16. `ColonySave`/`TileOverride` определены в Task 14 и потребляются в Task 15. `regenerateWorld`/`pickStartSite` — Task 5 → Task 6/14. `Biome`/`ResourceNode`/`NodeKind` — Task 2 → везде.

---

*После Плана A: План B (масштаб 256² + иерархический pathfinding + спатиал-индекс + тайм-слайс) и План C (чанковый 2.5D-рендер + камера + миникарта) — пишутся по завершении A.*
