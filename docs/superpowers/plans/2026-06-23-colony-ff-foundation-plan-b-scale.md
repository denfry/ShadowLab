# Colony FF Foundation · Plan B (Scale, SoA & Hierarchical Pathfinding) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take the Plan-A data layer to FF scale — a 256² procedural world simulated for 200+ agents — by swapping the grid backend to typed arrays (SoA) behind the existing accessor seam, replacing pathfinding with binary-heap A* + a hierarchical (clusters/portals) layer with a path cache, adding a spatial index for job targets, time-slicing assignment, and giving the renderer a pan/zoom camera with viewport culling.

**Architecture:** Everything routes through the Plan-A `grid.ts` accessor seam, so the `Tile[]`→SoA swap touches only `grid.ts` + `worldgen.ts` (the map constructor) + the two render/save consumers that still read `.tiles`. Pathfinding is a derived `Nav` structure (clusters, portals, intra-cluster distances, path cache) built at load and excluded from saves; it is invalidated per-cluster when passability changes. The sim caps path computations per tick (time-slice) in a fixed deterministic order. The map size flips to 256² only after the engine is proven correct at 28². Render gains a camera + culling but defers 2.5D/chunk-baking/minimap to Plan C.

**Tech Stack:** TypeScript (strict), Phaser (render host), Vitest (TDD), Zustand (HUD store, unchanged). Pure deterministic systems over a seeded `Rng` + `core/utils/noise.ts`.

## Global Constraints

- **Determinism is non-negotiable.** The only sources of randomness are the seeded `Rng` (`@/core/utils/rng`) and `core/utils/noise.ts`. No `Math.random`, no `Date.now`, no `new Date()` anywhere in `src/games/colony/domain/**` or `src/games/colony/systems/**`. One seed → byte-identical run (the determinism smoke test enforces this).
- **The accessor seam is law.** Outside `src/games/colony/systems/grid.ts`, no code may read or write `map.tiles` or index tile storage directly. All tile access goes through `grid.ts` accessors (`biomeAt`, `passableAt`, `tempAt`, `setBiome`, `setPassable`, `nodeAt`, `setNode`, `depleteNode`, `forEachTile`, `tileAt`, …). After Plan B there is **no** `map.tiles` array at all — the seam-guard test asserts zero occurrences of `.tiles` outside `grid.ts`.
- **Accessor signatures are frozen.** The SoA swap must keep every exported `grid.ts` function's signature and return type identical to Plan A (e.g. `biomeAt(m,x,y): Biome | undefined`, `buildingIdAt(m,x,y): string | undefined`). Callers must not change because the backend changed.
- **Derived nav state is never serialized.** Clusters/portals/distances/path-cache live in `state.nav` (built at load) and are excluded from `toSave`. The save payload remains `seed + rngState + colonists + buildings + nodes-overrides + scalars`.
- **Save compatibility:** bump `payloadVersion` `5 → 6`. v5 saves are rejected in `ColonyGameModule.mount` (existing behavior). The map is regenerated from seed; only sparse overrides + buildings replay.
- **Map size flips late.** Tasks 1–11 run at the current 28² (`MAP_W=MAP_H=28`) so every algorithm is validated against brute force on small maps and the existing suite stays green. Task 12 flips to 256².
- **Each commit message ends with:**
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- **Green gate per task:** `npx vitest run` (full suite) passes and `npx tsc --noEmit` reports 0 errors before a task is marked complete.

---

## File Structure

New files:
- `src/games/colony/systems/spatialIndex.ts` — cluster-bucketed nearest-target index (nodes by `NodeKind`, buildings by `JobType`), ring search.
- `src/games/colony/systems/pathHierarchy.ts` — `Nav` type, `buildNav`, portal detection, intra-cluster distances, abstract A*, `findPathHier`, `markDirtyAt`, `rebuildDirty`.
- `tests/colony.grid.soa.test.ts` — SoA accessor consistency + regenerate-equivalence.
- `tests/colony.spatialIndex.test.ts` — nearest == brute force; refresh on change.
- `tests/colony.pathHierarchy.test.ts` — portals/distances/abstract search/refinement/invalidation; validity + length-bound vs BFS.
- `tests/colony.camera.test.ts` — `visibleTileRange` / `clampCamera` pure-function tests.
- `tests/colony.scale.test.ts` — 256² worldgen connectivity + start-site; 200-agent determinism smoke.

Modified files:
- `src/games/colony/systems/grid.ts` — SoA backend (typed arrays + sparse maps), biome codec, `createMap` factory; all accessors rewritten to index arrays; `findNearestNode` over the sparse nodes map.
- `src/games/colony/domain/worldgen.ts` — `regenerateWorld` builds SoA; `pickStartSite` via accessors.
- `src/games/colony/domain/save.ts` — `diffOverrides`/`fromSave` via accessors/`forEachTile`; `version` 6; serialize `assignCursor`.
- `src/games/colony/domain/types.ts` — `ColonyState.map` becomes SoA `ColonyMap`; add `nav?` (non-serialized) and `assignCursor`.
- `src/games/colony/domain/createColony.ts` — `version: 6`; build `nav`; init `assignCursor: 0`.
- `src/games/colony/systems/pathfinding.ts` — binary-heap A* (exact); keep `findPath` signature.
- `src/games/colony/systems/jobScheduler.ts` — spatial index for targets; `findPathHier` via `s.nav`; time-sliced assignment.
- `src/games/colony/systems/needs.ts` — `routeTo` uses `findPathHier(s.map, s.nav, …)`.
- `src/games/colony/systems/work.ts` — on wall build / node clear, call `markDirtyAt(s.nav, …)`.
- `src/games/colony/systems/build.ts` — on blueprint placement that changes passability, mark dirty (verify; walls become impassable only when built, handled in work.ts — confirm in Task 10).
- `src/games/colony/systems/tick.ts` — `rebuildDirty(s.nav, s.map)` once per tick before scheduling.
- `src/games/colony/scenes/WorldScene.ts` — camera controller + viewport-culled draw; extract `visibleTileRange`/`clampCamera`.
- `src/games/colony/scenes/cameraMath.ts` (new, tiny) — pure camera math, unit-testable without Phaser.
- `src/games/colony/data/balance.ts` — `MAP_W/H` (Task 12), `CLUSTER`, `ASSIGN_BUDGET`, `PATH_CACHE_MAX`, `PATH_LEN_BOUND_K`, GEN tuning for 256².
- `src/games/colony/ColonyGameModule.ts` — `COLONY_PAYLOAD_VERSION = 6`.
- `src/games/colony/definition.ts` — tagline/description update (Task 15).

---

## Task 1: SoA grid backend + worldgen constructor

Swap `ColonyMap` from `{ w, h, tiles: Tile[] }` to a struct-of-arrays. Hot numeric fields become typed arrays; `buildingId` and `node` stay sparse `Map`s (preserves the `string`/object accessor return types). `regenerateWorld` builds the SoA directly. All accessor **signatures are unchanged**, so consumers compile untouched (except the two that read `.tiles`, migrated in Task 2). Map stays 28².

**Files:**
- Modify: `src/games/colony/systems/grid.ts`
- Modify: `src/games/colony/domain/worldgen.ts`
- Modify: `src/games/colony/domain/types.ts:95` (`ColonyState.map` type)
- Modify/replace test: `tests/colony.grid.test.ts`, add `tests/colony.grid.soa.test.ts`

**Interfaces:**
- Produces (the frozen public surface — later tasks consume exactly these):
  ```ts
  // grid.ts
  export type ColonyMap = {
    w: number; h: number;
    biome: Uint8Array;        // BIOME_CODE per tile
    elevation: Float32Array;  // 0..1
    fertility: Float32Array;  // 0..1
    passable: Uint8Array;     // 0/1
    roomId: Uint16Array;      // 0=street, >0 room id
    temp: Float32Array;       // °C
    buildingId: Map<number, string>; // sparse tileIndex -> building id
    nodes: Map<number, ResourceNode>; // sparse tileIndex -> node
  };
  export type Grid = ColonyMap;
  export const idx: (x: number, y: number, w: number) => number;
  export const inBounds: (x: number, y: number, m: ColonyMap) => boolean;
  export const createMap: (w: number, h: number) => ColonyMap; // zeroed defaults: grass, passable, temp 16
  export const tileAt: (x: number, y: number, m: ColonyMap) => Tile | undefined; // constructs a Tile VIEW
  export const biomeAt: (m: ColonyMap, x: number, y: number) => Biome | undefined;
  export const elevationAt: (m: ColonyMap, x: number, y: number) => number;
  export const fertilityAt: (m: ColonyMap, x: number, y: number) => number;
  export const passableAt: (m: ColonyMap, x: number, y: number) => boolean;
  export const tempAt: (m: ColonyMap, x: number, y: number) => number;
  export const roomIdAt: (m: ColonyMap, x: number, y: number) => number;
  export const buildingIdAt: (m: ColonyMap, x: number, y: number) => string | undefined;
  export const nodeAt: (m: ColonyMap, x: number, y: number) => ResourceNode | undefined;
  export const setPassable/setTemp/setRoomId/setBuildingId/setBiome/setNode: (…) => void;
  export const depleteNode: (m, x, y, amt) => number;
  export const neighbors4: (x, y, m) => Pt[];
  export const forEachTile: (m, fn:(i:number,x:number,y:number)=>void) => void;
  export const findNearestNode: (m, from, kind) => Pt | undefined;
  ```

- [ ] **Step 1: Write the failing SoA test.** Create `tests/colony.grid.soa.test.ts`:
  ```ts
  import { describe, expect, it } from 'vitest';
  import {
    createMap, idx, biomeAt, setBiome, passableAt, setPassable, tempAt, setTemp,
    fertilityAt, roomIdAt, setRoomId, buildingIdAt, setBuildingId,
    nodeAt, setNode, depleteNode, forEachTile, findNearestNode, tileAt,
  } from '@/games/colony/systems/grid';

  describe('SoA grid backend', () => {
    it('createMap allocates typed arrays with sane defaults', () => {
      const m = createMap(4, 3);
      expect(m.w).toBe(4); expect(m.h).toBe(3);
      expect(m.biome).toBeInstanceOf(Uint8Array);
      expect(m.elevation).toBeInstanceOf(Float32Array);
      expect(m.passable).toBeInstanceOf(Uint8Array);
      expect(biomeAt(m, 0, 0)).toBe('grass');
      expect(passableAt(m, 0, 0)).toBe(true);
      expect(tempAt(m, 0, 0)).toBe(16);
      expect(nodeAt(m, 0, 0)).toBeUndefined();
    });
    it('biome codec round-trips every biome', () => {
      const m = createMap(7, 1);
      const all = ['water','marsh','meadow','grass','forest','rock','mountain'] as const;
      all.forEach((b, x) => setBiome(m, x, 0, b));
      all.forEach((b, x) => expect(biomeAt(m, x, 0)).toBe(b));
    });
    it('numeric accessors read/write the backing arrays', () => {
      const m = createMap(3, 3);
      setPassable(m, 1, 1, false); expect(passableAt(m, 1, 1)).toBe(false);
      setTemp(m, 1, 1, -4.5); expect(tempAt(m, 1, 1)).toBeCloseTo(-4.5, 3);
      setRoomId(m, 1, 1, 7); expect(roomIdAt(m, 1, 1)).toBe(7);
    });
    it('node + buildingId are sparse and clear correctly', () => {
      const m = createMap(3, 1);
      setNode(m, 2, 0, { kind: 'wood', amount: 5, max: 10 });
      expect(nodeAt(m, 2, 0)?.amount).toBe(5);
      expect(m.nodes.size).toBe(1);
      expect(depleteNode(m, 2, 0, 3)).toBe(3);
      expect(nodeAt(m, 2, 0)?.amount).toBe(2);
      expect(depleteNode(m, 2, 0, 99)).toBe(2);
      expect(nodeAt(m, 2, 0)).toBeUndefined();
      expect(m.nodes.size).toBe(0);
      setBuildingId(m, 0, 0, 'b1'); expect(buildingIdAt(m, 0, 0)).toBe('b1');
      setBuildingId(m, 0, 0, undefined); expect(buildingIdAt(m, 0, 0)).toBeUndefined();
    });
    it('out-of-bounds reads are safe defaults', () => {
      const m = createMap(2, 2);
      expect(passableAt(m, -1, 0)).toBe(false);
      expect(biomeAt(m, 9, 9)).toBeUndefined();
      expect(tempAt(m, 9, 9)).toBe(0);
      expect(tileAt(9, 9, m)).toBeUndefined();
    });
    it('forEachTile visits every index once with correct x,y', () => {
      const m = createMap(3, 2);
      const seen: Array<[number, number, number]> = [];
      forEachTile(m, (i, x, y) => seen.push([i, x, y]));
      expect(seen).toHaveLength(6);
      expect(seen[4]).toEqual([4, 1, 1]); // i=4 -> x=1,y=1 on w=3
    });
    it('findNearestNode scans the sparse node map by Manhattan', () => {
      const m = createMap(5, 1);
      setNode(m, 4, 0, { kind: 'wood', amount: 1, max: 1 });
      setNode(m, 1, 0, { kind: 'wood', amount: 1, max: 1 });
      expect(findNearestNode(m, { x: 0, y: 0 }, 'wood')).toEqual({ x: 1, y: 0 });
      expect(findNearestNode(m, { x: 0, y: 0 }, 'stone')).toBeUndefined();
    });
    it('tileAt returns a constructed view (mutating the view does NOT write back)', () => {
      const m = createMap(2, 1);
      const t = tileAt(0, 0, m)!;
      expect(t.biome).toBe('grass');
      t.biome = 'forest';
      expect(biomeAt(m, 0, 0)).toBe('grass'); // view is a copy
    });
  });
  ```

- [ ] **Step 2: Run it, expect failure** (`createMap` undefined). Run: `npx vitest run tests/colony.grid.soa.test.ts` → FAIL.

- [ ] **Step 3: Rewrite `grid.ts` to SoA.** Full file:
  ```ts
  import type { Biome, NodeKind, Pt, ResourceNode, Tile } from '../domain/types';

  /** SoA-хранилище карты (План B). Сигнатуры аксессоров неизменны с Плана A. */
  export type ColonyMap = {
    w: number; h: number;
    biome: Uint8Array;
    elevation: Float32Array;
    fertility: Float32Array;
    passable: Uint8Array;
    roomId: Uint16Array;
    temp: Float32Array;
    buildingId: Map<number, string>;
    nodes: Map<number, ResourceNode>;
  };
  export type Grid = ColonyMap;

  const BIOMES: Biome[] = ['water', 'marsh', 'meadow', 'grass', 'forest', 'rock', 'mountain'];
  const BIOME_CODE: Record<Biome, number> = {
    water: 0, marsh: 1, meadow: 2, grass: 3, forest: 4, rock: 5, mountain: 6,
  };
  const GRASS = BIOME_CODE.grass;

  export const idx = (x: number, y: number, w: number): number => y * w + x;
  export const inBounds = (x: number, y: number, m: ColonyMap): boolean =>
    x >= 0 && y >= 0 && x < m.w && y < m.h;

  /** Пустая карта с дефолтами: всё трава, проходимо, temp=16. */
  export function createMap(w: number, h: number): ColonyMap {
    const n = w * h;
    const biome = new Uint8Array(n).fill(GRASS);
    const passable = new Uint8Array(n).fill(1);
    const temp = new Float32Array(n).fill(16);
    return {
      w, h, biome,
      elevation: new Float32Array(n),
      fertility: new Float32Array(n),
      passable,
      roomId: new Uint16Array(n),
      temp,
      buildingId: new Map(),
      nodes: new Map(),
    };
  }

  // --- Чтения ---
  export const biomeAt = (m: ColonyMap, x: number, y: number): Biome | undefined =>
    inBounds(x, y, m) ? BIOMES[m.biome[idx(x, y, m.w)]] : undefined;
  export const elevationAt = (m: ColonyMap, x: number, y: number): number =>
    inBounds(x, y, m) ? m.elevation[idx(x, y, m.w)] : 0;
  export const fertilityAt = (m: ColonyMap, x: number, y: number): number =>
    inBounds(x, y, m) ? m.fertility[idx(x, y, m.w)] : 0;
  export const passableAt = (m: ColonyMap, x: number, y: number): boolean =>
    inBounds(x, y, m) ? m.passable[idx(x, y, m.w)] === 1 : false;
  export const tempAt = (m: ColonyMap, x: number, y: number): number =>
    inBounds(x, y, m) ? m.temp[idx(x, y, m.w)] : 0;
  export const roomIdAt = (m: ColonyMap, x: number, y: number): number =>
    inBounds(x, y, m) ? m.roomId[idx(x, y, m.w)] : 0;
  export const buildingIdAt = (m: ColonyMap, x: number, y: number): string | undefined =>
    inBounds(x, y, m) ? m.buildingId.get(idx(x, y, m.w)) : undefined;
  export const nodeAt = (m: ColonyMap, x: number, y: number): ResourceNode | undefined =>
    inBounds(x, y, m) ? m.nodes.get(idx(x, y, m.w)) : undefined;

  /** Транзитный Tile-view для холодных путей (инспектор/тесты). Изменения НЕ пишутся назад. */
  export function tileAt(x: number, y: number, m: ColonyMap): Tile | undefined {
    if (!inBounds(x, y, m)) return undefined;
    const i = idx(x, y, m.w);
    const node = m.nodes.get(i);
    const buildingId = m.buildingId.get(i);
    return {
      x, y,
      biome: BIOMES[m.biome[i]],
      elevation: m.elevation[i],
      fertility: m.fertility[i],
      passable: m.passable[i] === 1,
      roomId: m.roomId[i],
      temp: m.temp[i],
      ...(node ? { node: { ...node } } : {}),
      ...(buildingId ? { buildingId } : {}),
    };
  }

  // --- Мутации (точечные) ---
  export const setPassable = (m: ColonyMap, x: number, y: number, v: boolean): void => {
    if (inBounds(x, y, m)) m.passable[idx(x, y, m.w)] = v ? 1 : 0;
  };
  export const setTemp = (m: ColonyMap, x: number, y: number, v: number): void => {
    if (inBounds(x, y, m)) m.temp[idx(x, y, m.w)] = v;
  };
  export const setRoomId = (m: ColonyMap, x: number, y: number, v: number): void => {
    if (inBounds(x, y, m)) m.roomId[idx(x, y, m.w)] = v;
  };
  export const setBuildingId = (m: ColonyMap, x: number, y: number, id?: string): void => {
    if (!inBounds(x, y, m)) return;
    const i = idx(x, y, m.w);
    if (id === undefined) m.buildingId.delete(i); else m.buildingId.set(i, id);
  };
  export const setBiome = (m: ColonyMap, x: number, y: number, b: Biome): void => {
    if (inBounds(x, y, m)) m.biome[idx(x, y, m.w)] = BIOME_CODE[b];
  };
  export const setNode = (m: ColonyMap, x: number, y: number, n?: ResourceNode): void => {
    if (!inBounds(x, y, m)) return;
    const i = idx(x, y, m.w);
    if (n === undefined) m.nodes.delete(i); else m.nodes.set(i, n);
  };

  /** Уменьшает узел на `amt` (не больше остатка); очищает узел при <=0. Возвращает взятое. */
  export function depleteNode(m: ColonyMap, x: number, y: number, amt: number): number {
    if (!inBounds(x, y, m)) return 0;
    const i = idx(x, y, m.w);
    const node = m.nodes.get(i);
    if (!node) return 0;
    const take = Math.min(node.amount, amt);
    node.amount -= take;
    if (node.amount <= 0) m.nodes.delete(i);
    return take;
  }

  const DIRS: Pt[] = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
  export function neighbors4(x: number, y: number, m: ColonyMap): Pt[] {
    const out: Pt[] = [];
    for (const d of DIRS) {
      const nx = x + d.x, ny = y + d.y;
      if (inBounds(nx, ny, m)) out.push({ x: nx, y: ny });
    }
    return out;
  }

  export function forEachTile(m: ColonyMap, fn: (i: number, x: number, y: number) => void): void {
    const { w, h } = m;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) fn(y * w + x, x, y);
  }

  /** Ближайший (манхэттен) тайл с узлом нужного вида — скан РАЗРЕЖЕННОЙ карты узлов
   *  (План B: спатиал-индекс заменит горячие вызовы; сигнатура неизменна). */
  export function findNearestNode(m: ColonyMap, from: Pt, kind: NodeKind): Pt | undefined {
    let best: Pt | undefined;
    let bestD = Infinity;
    for (const [i, node] of m.nodes) {
      if (node.kind !== kind || node.amount <= 0) continue;
      const x = i % m.w, y = Math.floor(i / m.w);
      const d = Math.abs(x - from.x) + Math.abs(y - from.y);
      if (d < bestD) { bestD = d; best = { x, y }; }
    }
    return best;
  }
  ```
  Note: `findNearestNode` iteration order over a `Map` is insertion order (deterministic); ties resolve to the first-inserted nearest, matching brute force closely enough — the Task-1 test pins the exact expected result. When a later `setNode`/`depleteNode` reorders insertion, determinism is preserved because the *seed* fixes worldgen insertion order; runtime only deletes.

- [ ] **Step 4: Update `worldgen.ts` to build SoA.** Replace the tile-array construction. `regenerateWorld` now:
  ```ts
  import { fbm } from '@/core/utils/noise';
  import type { Biome, NodeKind, Pt, ResourceNode } from './types';
  import { GEN, BIOME_FERTILITY, MAP_W, MAP_H } from '../data/balance';
  import type { ColonyMap } from '../systems/grid';
  import { createMap, idx, setBiome, setNode, passableAt, biomeAt } from '../systems/grid';

  // classify(), nodeFor(), carveRivers() unchanged (carveRivers already works on Float64Array+Uint8Array locals).

  export function regenerateWorld(seed: number): ColonyMap {
    const w = MAP_W, h = MAP_H;
    const m = createMap(w, h);
    const elev = new Float64Array(w * h);
    const isWater = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const e = fbm(seed * 7 + 1, x / GEN.elevScale, y / GEN.elevScale, 5);
      elev[idx(x, y, w)] = e;
      if (e < GEN.waterLevel) isWater[idx(x, y, w)] = 1;
    }
    carveRivers(seed, w, h, elev, isWater);

    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = idx(x, y, w);
      const e = elev[i];
      const moist = fbm(seed * 13 + 99, x / GEN.moistScale, y / GEN.moistScale, 4);
      const biome: Biome = isWater[i] ? 'water' : classify(e, moist);
      m.elevation[i] = e;
      m.fertility[i] = BIOME_FERTILITY[biome];
      m.biome[i] = ['water','marsh','meadow','grass','forest','rock','mountain'].indexOf(biome);
      m.passable[i] = (biome !== 'water' && biome !== 'mountain') ? 1 : 0;
      const node = nodeFor(seed, x, y, biome);
      if (node) m.nodes.set(i, node);
    }
    return m;
  }

  export function pickStartSite(m: ColonyMap): Pt {
    const cx = m.w / 2, cy = m.h / 2;
    const near = (x: number, y: number, biome: Biome, rad: number): boolean => {
      for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
        const nx = x + dx, ny = y + dy;
        if (biomeAt(m, nx, ny) === biome) return true;
      }
      return false;
    };
    let best: Pt | undefined; let bestScore = -Infinity;
    for (let y = 2; y < m.h - 2; y++) for (let x = 2; x < m.w - 2; x++) {
      const b = biomeAt(m, x, y);
      if ((b !== 'meadow' && b !== 'grass') || !passableAt(m, x, y)) continue;
      let score = -(Math.abs(x - cx) + Math.abs(y - cy));
      if (near(x, y, 'water', 6)) score += 5;
      if (near(x, y, 'forest', 8)) score += 5;
      if (score > bestScore) { bestScore = score; best = { x, y }; }
    }
    if (!best) {
      for (let y = 0; y < m.h && !best; y++) for (let x = 0; x < m.w && !best; x++) {
        if (passableAt(m, x, y)) best = { x, y };
      }
    }
    return best ?? { x: Math.floor(cx), y: Math.floor(cy) };
  }
  ```
  (Inline the biome→code via the local array, or import `BIOME_CODE` — but it's currently private in grid.ts. Cleanest: use `setBiome(m, x, y, biome)` instead of writing `m.biome[i]` directly, since `m` is the SoA map and `setBiome` encodes. Replace the `m.biome[i] = …indexOf…` line with `setBiome(m, x, y, biome)`. Same for nodes: `setNode(m, x, y, node)`. This keeps worldgen inside the seam too.)

- [ ] **Step 5: Update `types.ts` map field.** Change `ColonyState.map` from the inline `{ w; h; tiles: Tile[] }` to import the SoA type:
  ```ts
  import type { ColonyMap } from '../systems/grid';
  // …
  map: ColonyMap;
  ```
  Keep the `Tile` interface (still the view type returned by `tileAt`).

- [ ] **Step 6: Rewrite `tests/colony.grid.test.ts`** to build maps via `createMap` + setters instead of literal `tiles`. Replace the `grid()` and `makeMap()` helpers:
  ```ts
  import { createMap, setBiome, setNode } from '@/games/colony/systems/grid';
  const grid = (w: number, h: number) => createMap(w, h);
  function makeMap() {
    const m = createMap(3, 1);
    for (let x = 0; x < 3; x++) { setBiome(m, x, 0, 'grass'); }
    return m;
  }
  ```
  Keep the existing `it(...)` assertions (they call accessors, which are unchanged). Remove the `import type { Tile }` literal-construction and the `ColonyMap` shape assumptions.

- [ ] **Step 7: Run the full suite.** Run: `npx vitest run` → all green (the SoA test passes; existing tests pass because accessors are unchanged; Task-2 consumers still compile because they read `.tiles` which **no longer exists** → expect TS/runtime breakage ONLY in `save.ts` and `WorldScene.ts`). **Expected at this point:** `save.test.ts`/`colony.migration.test.ts` (save round-trip) may FAIL because `save.ts` still reads `.tiles`. That is the Task-2 boundary.
  - **Decision rule for the implementer:** if save round-trip tests fail solely due to `.tiles` access in `save.ts`, that is expected and resolved in Task 2 — but to keep Task 1 independently green, **also apply the minimal `save.ts` migration here** (Step 8) so the suite is green at the Task-1 commit. (Render `WorldScene.ts` is not covered by tests; migrate it in Task 2.)

- [ ] **Step 8: Migrate `save.ts` reads to accessors** (folded in to keep Task 1 green):
  ```ts
  import { idx, setBuildingId, setPassable, setBiome, setNode, biomeAt, nodeAt, forEachTile } from '../systems/grid';

  function diffOverrides(s: ColonyState): TileOverride[] {
    const fresh = regenerateWorld(s.seed);
    const out: TileOverride[] = [];
    forEachTile(s.map, (i, x, y) => {
      const cb = biomeAt(s.map, x, y), gb = biomeAt(fresh, x, y);
      const cn = nodeAt(s.map, x, y), gn = nodeAt(fresh, x, y);
      const biomeChanged = cb !== gb;
      const nodeChanged = (cn?.kind !== gn?.kind) || (cn?.amount !== gn?.amount) || (cn?.max !== gn?.max);
      if (biomeChanged || nodeChanged) {
        out.push({
          i,
          ...(biomeChanged ? { biome: cb } : {}),
          ...(nodeChanged ? { node: cn ? { ...cn } : null } : {}),
        });
      }
    });
    return out;
  }

  export function fromSave(p: ColonySave): ColonyState {
    const map = regenerateWorld(p.seed);
    for (const o of p.overrides) {
      const x = o.i % map.w, y = Math.floor(o.i / map.w);
      if (o.biome !== undefined) setBiome(map, x, y, o.biome);
      if (o.node !== undefined) setNode(map, x, y, o.node === null ? undefined : { ...o.node });
    }
    for (const b of p.buildings) {
      if (!b.built) continue;
      setBuildingId(map, b.tile.x, b.tile.y, b.id);
      if (b.type === 'wall') setPassable(map, b.tile.x, b.tile.y, false);
    }
    return { /* …unchanged… */ map, /* … */ };
  }
  ```
  Run: `npx vitest run` → green (147 tests). `npx tsc --noEmit` → 0 errors **except** `WorldScene.ts` `.tiles` reads (Phaser scene is not in the test/tsc path if excluded; if tsc flags it, migrate WorldScene now or in Task 2). If tsc includes WorldScene, do the WorldScene `.tiles` migration (Task 2 Step 1) here too.

- [ ] **Step 9: Commit.**
  ```bash
  git add src/games/colony/systems/grid.ts src/games/colony/domain/worldgen.ts src/games/colony/domain/types.ts src/games/colony/domain/save.ts tests/colony.grid.test.ts tests/colony.grid.soa.test.ts
  git commit -m "feat(colony): SoA grid backend behind the accessor seam (Plan B)"
  ```

---

## Task 2: Migrate render reads off `.tiles` + seam guard

The only remaining `.tiles` consumer is `WorldScene.ts` (`drawMap`, `drawTempOverlay`). Route both through `forEachTile` + accessors. Update/confirm the seam-guard test so `.tiles` appears **nowhere** outside `grid.ts`.

**Files:**
- Modify: `src/games/colony/scenes/WorldScene.ts:77-85,108-118`
- Modify: `tests/colony.tick.test.ts` (or wherever the Plan-A accessor-seam guard lives) — tighten to forbid `.tiles`.

- [ ] **Step 1: Migrate `drawMap` + `drawTempOverlay`.**
  ```ts
  import { TILE } from '../data/balance';
  import { forEachTile, biomeAt, tempAt } from '../systems/grid';

  private drawMap() {
    const g = this.add.graphics();
    forEachTile(this.state.map, (_i, x, y) => {
      g.fillStyle(BIOME_COLOR[biomeAt(this.state.map, x, y) ?? 'grass'] ?? 0x222222, 1);
      g.fillRect(x * TILE, y * TILE, TILE - 1, TILE - 1);
    });
    g.lineStyle(1, 0x000000, 0.15);
    g.strokeRect(0, 0, this.mapPxW, this.mapPxH);
  }

  private drawTempOverlay() {
    this.tempLayer.clear();
    if (!this.tempOverlay) return;
    forEachTile(this.state.map, (_i, x, y) => {
      const k = Math.max(0, Math.min(1, (tempAt(this.state.map, x, y) + 20) / 50));
      const r = Math.floor(k * 255), b = Math.floor((1 - k) * 255);
      this.tempLayer.fillStyle((r << 16) | (0x30 << 8) | b, 0.35);
      this.tempLayer.fillRect(x * TILE, y * TILE, TILE - 1, TILE - 1);
    });
  }
  ```
  (These are replaced wholesale by the culling renderer in Task 14; this step only removes the seam leak so the guard passes.)

- [ ] **Step 2: Tighten the seam-guard test.** Locate the Plan-A guard in `tests/colony.tick.test.ts` (it greps `systems/` source for `map.tiles[`). Replace its body with a repo-wide scan that forbids any `.tiles` token outside `grid.ts`:
  ```ts
  import { readFileSync, readdirSync, statSync } from 'node:fs';
  import { join } from 'node:path';
  it('no .tiles access outside grid.ts (accessor seam holds)', () => {
    const root = 'src/games/colony';
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir)) {
        const p = join(dir, e);
        if (statSync(p).isDirectory()) { walk(p); continue; }
        if (!p.endsWith('.ts') || p.endsWith('systems/grid.ts') || p.endsWith('systems\\grid.ts')) continue;
        if (/\.tiles\b/.test(readFileSync(p, 'utf8'))) offenders.push(p);
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });
  ```

- [ ] **Step 3: Run + verify.** Run: `npx vitest run` → green; the guard passes (no `.tiles` outside grid). `npx tsc --noEmit` → 0 errors.

- [ ] **Step 4: Commit.**
  ```bash
  git add src/games/colony/scenes/WorldScene.ts tests/colony.tick.test.ts
  git commit -m "refactor(colony): route renderer through accessors; seam-guard forbids .tiles"
  ```

---

## Task 3: Binary-heap A* (exact)

Replace the linear open-list scan in `findPath` with a binary min-heap keyed by `f`, and replace the `open.find` membership scan with a best-known-`g` check. Paths stay **optimal** (same results as Plan A); only the data structure changes. Signature unchanged.

**Files:**
- Modify: `src/games/colony/systems/pathfinding.ts`
- Existing `tests/colony.pathfinding.test.ts` must stay green; add a stress case.

- [ ] **Step 1: Add a stress test** to `tests/colony.pathfinding.test.ts`:
  ```ts
  import { createMap, setPassable } from '@/games/colony/systems/grid';
  it('finds an optimal-length path around a wall on a larger grid', () => {
    const m = createMap(40, 40);
    for (let y = 0; y < 38; y++) setPassable(m, 20, y, false); // vertical wall, gap at bottom
    const path = findPath(m, { x: 0, y: 0 }, { x: 39, y: 0 })!;
    expect(path).not.toBeNull();
    // last point is the goal; every step is 4-adjacent and (except goal) passable
    expect(path[path.length - 1]).toEqual({ x: 39, y: 0 });
    for (let k = 0; k < path.length; k++) {
      const prev = k === 0 ? { x: 0, y: 0 } : path[k - 1];
      expect(Math.abs(path[k].x - prev.x) + Math.abs(path[k].y - prev.y)).toBe(1);
    }
  });
  ```

- [ ] **Step 2: Run, expect green** (current linear A* already satisfies it but is slow). Run: `npx vitest run tests/colony.pathfinding.test.ts`.

- [ ] **Step 3: Rewrite `findPath` with a binary heap.** Full file:
  ```ts
  import type { Pt } from '../domain/types';
  import { type Grid, idx, neighbors4, passableAt } from './grid';

  const manhattan = (ax: number, ay: number, bx: number, by: number) =>
    Math.abs(ax - bx) + Math.abs(ay - by);

  /** Минимальная бинарная куча по f (число). Хранит ключи тайлов (y*w+x). */
  class MinHeap {
    private keys: number[] = [];
    private fs: number[] = [];
    get size() { return this.keys.length; }
    push(key: number, f: number) {
      this.keys.push(key); this.fs.push(f);
      let i = this.keys.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (this.fs[p] <= this.fs[i]) break;
        this.swap(p, i); i = p;
      }
    }
    pop(): number {
      const top = this.keys[0];
      const lastK = this.keys.pop()!, lastF = this.fs.pop()!;
      if (this.keys.length) {
        this.keys[0] = lastK; this.fs[0] = lastF;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = 2 * i + 2; let s = i;
          if (l < this.keys.length && this.fs[l] < this.fs[s]) s = l;
          if (r < this.keys.length && this.fs[r] < this.fs[s]) s = r;
          if (s === i) break;
          this.swap(s, i); i = s;
        }
      }
      return top;
    }
    private swap(a: number, b: number) {
      [this.keys[a], this.keys[b]] = [this.keys[b], this.keys[a]];
      [this.fs[a], this.fs[b]] = [this.fs[b], this.fs[a]];
    }
  }

  /**
   * Оптимальный A* по 4-связной сетке. Возвращает путевые точки БЕЗ старта (включая цель),
   * [] если старт==цель, или null если пути нет. Цель может быть непроходимой (вход «к» зданию).
   */
  export function findPath(g: Grid, start: Pt, goal: Pt): Pt[] | null {
    if (start.x === goal.x && start.y === goal.y) return [];
    const w = g.w;
    const key = (x: number, y: number) => y * w + x;
    const startK = key(start.x, start.y), goalK = key(goal.x, goal.y);

    const open = new MinHeap();
    const gScore = new Map<number, number>([[startK, 0]]);
    const came = new Map<number, number>();
    const closed = new Set<number>();
    open.push(startK, manhattan(start.x, start.y, goal.x, goal.y));

    while (open.size) {
      const cur = open.pop();
      if (cur === goalK) return reconstruct(came, startK, goalK, w);
      if (closed.has(cur)) continue;
      closed.add(cur);
      const cx = cur % w, cy = (cur - cx) / w;
      const cg = gScore.get(cur)!;
      for (const n of neighbors4(cx, cy, g)) {
        const isGoal = n.x === goal.x && n.y === goal.y;
        if (!isGoal && !passableAt(g, n.x, n.y)) continue;
        const nk = key(n.x, n.y);
        if (closed.has(nk)) continue;
        const tentative = cg + 1;
        if (tentative < (gScore.get(nk) ?? Infinity)) {
          came.set(nk, cur);
          gScore.set(nk, tentative);
          open.push(nk, tentative + manhattan(n.x, n.y, goal.x, goal.y));
        }
      }
    }
    return null;
  }

  function reconstruct(came: Map<number, number>, startK: number, goalK: number, w: number): Pt[] {
    const path: Pt[] = [];
    let ck = goalK;
    while (ck !== startK) {
      path.push({ x: ck % w, y: Math.floor(ck / w) });
      const prev = came.get(ck);
      if (prev === undefined) break;
      ck = prev;
    }
    path.reverse();
    return path;
  }

  export { idx } from './grid';
  ```
  Note: keys are now `y*w+x` (bounded by map size) rather than the Plan-A `y*100000+x`; both are unique because the heap is per-call and `w ≤ 256`.

- [ ] **Step 4: Run the suite.** Run: `npx vitest run` → green (pathfinding + playtest unchanged behavior). `npx tsc --noEmit` → 0.

- [ ] **Step 5: Commit.**
  ```bash
  git add src/games/colony/systems/pathfinding.ts tests/colony.pathfinding.test.ts
  git commit -m "perf(colony): binary-heap A* (exact paths, replaces linear open-list)"
  ```

---

## Task 4: Spatial index for job targets

A cluster-bucketed index over points, queried by category with an expanding ring search. Used for the two scale-sensitive lookups: nearest resource node by `NodeKind`, and nearest available building by `JobType`. Pure, rebuildable from `(buildings, map.nodes)` each scheduler tick (cheap; correctness over incremental-maintenance bugs).

**Files:**
- Create: `src/games/colony/systems/spatialIndex.ts`
- Create: `tests/colony.spatialIndex.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface SpatialIndex {
    clusterSize: number; clustersW: number;
    buckets: Map<string, Map<number, Pt[]>>; // category -> clusterId -> points
  }
  export function buildIndex(w: number, h: number, clusterSize: number,
    points: Array<{ x: number; y: number; cat: string }>): SpatialIndex;
  export function nearest(ix: SpatialIndex, w: number, h: number,
    from: Pt, cat: string, accept?: (p: Pt) => boolean): Pt | undefined;
  ```

- [ ] **Step 1: Failing test** `tests/colony.spatialIndex.test.ts`:
  ```ts
  import { describe, expect, it } from 'vitest';
  import { buildIndex, nearest } from '@/games/colony/systems/spatialIndex';

  const brute = (pts: Array<{x:number;y:number;cat:string}>, from:{x:number;y:number}, cat:string) => {
    let best: {x:number;y:number} | undefined, bd = Infinity;
    for (const p of pts) {
      if (p.cat !== cat) continue;
      const d = Math.abs(p.x-from.x)+Math.abs(p.y-from.y);
      if (d < bd) { bd = d; best = { x: p.x, y: p.y }; }
    }
    return best;
  };

  describe('spatialIndex', () => {
    it('nearest matches brute force for scattered points', () => {
      const pts = [
        { x: 3, y: 3, cat: 'wood' }, { x: 30, y: 5, cat: 'wood' },
        { x: 50, y: 50, cat: 'stone' }, { x: 10, y: 40, cat: 'wood' },
      ];
      const ix = buildIndex(64, 64, 16, pts);
      for (const from of [{x:0,y:0},{x:31,y:6},{x:9,y:39},{x:63,y:63}]) {
        expect(nearest(ix, 64, 64, from, 'wood')).toEqual(brute(pts, from, 'wood'));
      }
      expect(nearest(ix, 64, 64, {x:0,y:0}, 'gold')).toBeUndefined();
    });
    it('respects the accept predicate (e.g. building with a free slot)', () => {
      const pts = [{ x: 5, y: 5, cat: 'farm' }, { x: 6, y: 5, cat: 'farm' }];
      const ix = buildIndex(32, 32, 16, pts);
      const found = nearest(ix, 32, 32, { x: 0, y: 0 }, 'farm', (p) => !(p.x === 5 && p.y === 5));
      expect(found).toEqual({ x: 6, y: 5 });
    });
    it('matches brute force on a randomized-but-seeded fixture', () => {
      // deterministic pseudo-points (no Math.random): lattice with category by parity
      const pts: Array<{x:number;y:number;cat:string}> = [];
      for (let i = 0; i < 200; i++) {
        const x = (i * 37) % 128, y = (i * 53) % 128;
        pts.push({ x, y, cat: i % 3 === 0 ? 'wood' : 'stone' });
      }
      const ix = buildIndex(128, 128, 16, pts);
      for (let i = 0; i < 20; i++) {
        const from = { x: (i * 61) % 128, y: (i * 17) % 128 };
        expect(nearest(ix, 128, 128, from, 'wood')).toEqual(brute(pts, from, 'wood'));
      }
    });
  });
  ```

- [ ] **Step 2: Run, expect failure.** Run: `npx vitest run tests/colony.spatialIndex.test.ts`.

- [ ] **Step 3: Implement `spatialIndex.ts`.**
  ```ts
  import type { Pt } from '../domain/types';

  export interface SpatialIndex {
    clusterSize: number;
    clustersW: number;
    buckets: Map<string, Map<number, Pt[]>>;
  }

  const clusterIdOf = (x: number, y: number, cs: number, cw: number) =>
    Math.floor(y / cs) * cw + Math.floor(x / cs);

  export function buildIndex(
    w: number, h: number, clusterSize: number,
    points: Array<{ x: number; y: number; cat: string }>,
  ): SpatialIndex {
    const clustersW = Math.ceil(w / clusterSize);
    const buckets = new Map<string, Map<number, Pt[]>>();
    for (const p of points) {
      let byCluster = buckets.get(p.cat);
      if (!byCluster) { byCluster = new Map(); buckets.set(p.cat, byCluster); }
      const cid = clusterIdOf(p.x, p.y, clusterSize, clustersW);
      let arr = byCluster.get(cid);
      if (!arr) { arr = []; byCluster.set(cid, arr); }
      arr.push({ x: p.x, y: p.y });
    }
    return { clusterSize, clustersW, buckets };
  }

  /**
   * Ближайшая (манхэттен) точка категории `cat` от `from`, опционально проходящая `accept`.
   * Расширяющийся поиск по кольцам кластеров; кольцо k гарантирует, что любая точка ближе
   * лежит в уже просмотренных кластерах при достаточном расширении (см. ниже про границу).
   */
  export function nearest(
    ix: SpatialIndex, w: number, h: number,
    from: Pt, cat: string, accept?: (p: Pt) => boolean,
  ): Pt | undefined {
    const byCluster = ix.buckets.get(cat);
    if (!byCluster) return undefined;
    const cs = ix.clusterSize, cw = ix.clustersW;
    const ch = Math.ceil(h / cs);
    const fcx = Math.floor(from.x / cs), fcy = Math.floor(from.y / cs);
    const maxRing = Math.max(cw, ch);

    let best: Pt | undefined; let bestD = Infinity;
    const consider = (p: Pt) => {
      if (accept && !accept(p)) return;
      const d = Math.abs(p.x - from.x) + Math.abs(p.y - from.y);
      if (d < bestD) { bestD = d; best = { x: p.x, y: p.y }; }
    };
    for (let ring = 0; ring <= maxRing; ring++) {
      for (let cy = fcy - ring; cy <= fcy + ring; cy++) {
        for (let cx = fcx - ring; cx <= fcx + ring; cx++) {
          if (Math.max(Math.abs(cx - fcx), Math.abs(cy - fcy)) !== ring) continue; // ring shell only
          if (cx < 0 || cy < 0 || cx >= cw || cy >= ch) continue;
          const arr = byCluster.get(cy * cw + cx);
          if (arr) for (const p of arr) consider(p);
        }
      }
      // Останов: ближайшая найденная точка ближе, чем минимально возможная точка
      // в следующем непросмотренном кольце (его ближняя граница на расстоянии ring*cs тайлов).
      if (best && bestD <= ring * cs) break;
    }
    return best;
  }
  ```
  Correctness note for reviewers: a point in ring `ring+1` is at least `ring*cs` tiles away (its cluster's near edge), so once `bestD <= ring*cs` no farther ring can improve — the early break is safe and the result equals brute force (pinned by the tests). The tie-break is deterministic (cluster scan order + insertion order).

- [ ] **Step 4: Run.** `npx vitest run tests/colony.spatialIndex.test.ts` → green. `npx tsc --noEmit` → 0.

- [ ] **Step 5: Commit.**
  ```bash
  git add src/games/colony/systems/spatialIndex.ts tests/colony.spatialIndex.test.ts
  git commit -m "feat(colony): cluster-bucketed spatial index with ring-search nearest"
  ```

---

## Task 5: Wire spatial index into the job scheduler

Replace `findNearestNode` (woodcut) and the linear building scans in `findTarget` with the spatial index, rebuilt once per `runJobScheduler` call. Behavior (which target is chosen) must match the previous brute-force selection so the existing playtest stays green.

**Files:**
- Modify: `src/games/colony/systems/jobScheduler.ts`
- Add a determinism assertion to `tests/colony.playtest.test.ts` or a new focused test.

**Interfaces:**
- Consumes: `buildIndex`, `nearest` (Task 4); `CLUSTER` (add to balance now: `export const CLUSTER = 16;`).

- [ ] **Step 1: Add `CLUSTER` to balance.** In `data/balance.ts`:
  ```ts
  // ---- План B: масштаб/иерархия ----
  export const CLUSTER = 16;            // сторона кластера (тайлы) — pathHierarchy + spatialIndex
  ```

- [ ] **Step 2: Failing test** — add to `tests/colony.playtest.test.ts` a target-equivalence check (the scheduler picks the same building the brute-force pick would). Minimal new test file `tests/colony.scheduler.test.ts`:
  ```ts
  import { describe, expect, it } from 'vitest';
  import { createColony } from '@/games/colony/domain/createColony';
  import { tick } from '@/games/colony/systems/tick';
  it('scheduler assigns woodcut to the nearest wood node (deterministic over a run)', () => {
    const a = createColony(12345);
    const b = createColony(12345);
    for (let i = 0; i < 240; i++) { tick(a); tick(b); }
    // identical seed → identical colonist tasks/positions
    expect(a.colonists.map(c => [c.task, Math.round(c.pos.x), Math.round(c.pos.y)]))
      .toEqual(b.colonists.map(c => [c.task, Math.round(c.pos.x), Math.round(c.pos.y)]));
  });
  ```

- [ ] **Step 3: Rewrite `findTarget` to use the index.** New `jobScheduler.ts` target section:
  ```ts
  import type { Building, Colonist, ColonyState, JobType, Pt } from '../domain/types';
  import { findPath } from './pathfinding';
  import { tileAt } from './grid';
  import { buildIndex, nearest, type SpatialIndex } from './spatialIndex';
  import { CLUSTER } from '../data/balance';

  const tileOf = (c: Colonist): Pt => ({ x: Math.round(c.pos.x), y: Math.round(c.pos.y) });

  function workersOn(s: ColonyState, buildingId: string): number {
    return s.colonists.filter(
      (c) => c.alive && c.targetBuildingId === buildingId && (c.task === 'goto_work' || c.task === 'work'),
    ).length;
  }

  /** Индекс целей текущего тика: узлы по виду + здания по jobType + блюпринты как 'build'. */
  function buildTargetIndex(s: ColonyState): { ix: SpatialIndex; byTile: Map<string, Building> } {
    const pts: Array<{ x: number; y: number; cat: string }> = [];
    const byTile = new Map<string, Building>();
    for (const b of s.buildings) {
      const cat = !b.built ? 'build' : b.jobType ? `job:${b.jobType}` : undefined;
      if (!cat) continue;
      pts.push({ x: b.tile.x, y: b.tile.y, cat });
      byTile.set(`${b.tile.x},${b.tile.y}`, b);
    }
    for (const [i, node] of s.map.nodes) {
      if (node.amount <= 0) continue;
      pts.push({ x: i % s.map.w, y: Math.floor(i / s.map.w), cat: `node:${node.kind}` });
    }
    return { ix: buildIndex(s.map.w, s.map.h, CLUSTER, pts), byTile };
  }

  function findTarget(
    s: ColonyState, from: Pt, job: JobType,
    ix: SpatialIndex, byTile: Map<string, Building>,
  ): { tile: Pt; buildingId?: string } | null {
    if (job === 'farm' || job === 'research' || job === 'tailor') {
      const t = nearest(s.map, s.map.h /*unused*/ as any, from, `job:${job}`, () => true); // placeholder, replaced below
      return null;
    }
    return null;
  }
  ```
  **Reviewer-critical:** the placeholder above is illustrative only — implement `findTarget` precisely as:
  ```ts
  function findTarget(
    s: ColonyState, from: Pt, job: JobType,
    ix: SpatialIndex, byTile: Map<string, Building>,
  ): { tile: Pt; buildingId?: string } | null {
    if (job === 'farm' || job === 'research' || job === 'tailor') {
      const t = nearest(ix, s.map.w, s.map.h, from, `job:${job}`, (p) => {
        const b = byTile.get(`${p.x},${p.y}`)!;
        return workersOn(s, b.id) < b.workSlots;
      });
      if (!t) return null;
      const b = byTile.get(`${t.x},${t.y}`)!;
      return { tile: b.tile, buildingId: b.id };
    }
    if (job === 'build') {
      const t = nearest(ix, s.map.w, s.map.h, from, 'build', (p) => {
        const b = byTile.get(`${p.x},${p.y}`)!;
        return workersOn(s, b.id) < 1;
      });
      if (!t) return null;
      const b = byTile.get(`${t.x},${t.y}`)!;
      return { tile: b.tile, buildingId: b.id };
    }
    if (job === 'woodcut') {
      const t = nearest(ix, s.map.w, s.map.h, from, 'node:wood');
      return t ? { tile: t } : null;
    }
    return null;
  }
  ```
  And `runJobScheduler` builds the index once and passes it through:
  ```ts
  export function runJobScheduler(s: ColonyState): void {
    const { ix, byTile } = buildTargetIndex(s);
    for (const c of s.colonists) {
      if (!c.alive || c.task !== 'idle') continue;
      const jobs = JOB_ORDER
        .filter((j) => (c.priorities[j] ?? 0) > 0)
        .sort((a, b) => (c.priorities[b] - c.priorities[a]) || (JOB_ORDER.indexOf(a) - JOB_ORDER.indexOf(b)));
      const from = tileOf(c);
      for (const job of jobs) {
        const target = findTarget(s, from, job, ix, byTile);
        if (!target) continue;
        const path = findPath(s.map, from, target.tile);
        if (path === null) continue;
        c.targetTile = target.tile; c.targetBuildingId = target.buildingId;
        c.path = path; c.task = 'goto_work'; break;
      }
    }
  }
  ```
  Behavior parity note: the spatial `nearest` uses Manhattan distance with deterministic tie-breaks; the previous `findTarget` also used Manhattan (`dist`). Equivalence is pinned by the determinism test (Step 2) and the existing playtest.

- [ ] **Step 4: Run the suite.** Run: `npx vitest run` → green. `npx tsc --noEmit` → 0. Remove the illustrative placeholder block before committing (only the precise `findTarget` remains).

- [ ] **Step 5: Commit.**
  ```bash
  git add src/games/colony/systems/jobScheduler.ts src/games/colony/data/balance.ts tests/colony.scheduler.test.ts
  git commit -m "feat(colony): job scheduler targets via spatial index (woodcut + buildings)"
  ```

---

## Task 6: Path hierarchy — clusters & portals

Begin `pathHierarchy.ts`: decompose the map into `CLUSTER`-sized clusters and detect **portals** — single transition tiles on each cluster border where both facing tiles are passable, one portal per maximal passable border segment (placed at the segment midpoint). Inter-cluster edges (cost 1) link the two facing portals.

**Files:**
- Create: `src/games/colony/systems/pathHierarchy.ts`
- Create: `tests/colony.pathHierarchy.test.ts`

**Interfaces:**
- Produces (consumed by Tasks 7–10):
  ```ts
  export interface Portal { id: number; x: number; y: number; cluster: number; }
  export interface Nav {
    clusterSize: number; clustersW: number; clustersH: number;
    portals: Portal[];
    portalsByCluster: Map<number, Portal[]>;
    interEdges: Map<number, Array<{ to: number; cost: number }>>;   // portal id -> facing portal(s)
    intraEdges: Map<number, Array<{ to: number; cost: number }>>;   // portal id -> same-cluster portals (Task 7)
    pathCache: Map<string, Pt[] | null>;                            // (Task 9)
    dirty: Set<number>;                                             // dirty cluster ids (Task 9)
  }
  export function clusterIdOf(x: number, y: number, nav: Pick<Nav,'clusterSize'|'clustersW'>): number;
  export function detectPortals(m: ColonyMap, clusterSize: number): { portals: Portal[]; portalsByCluster: Map<number, Portal[]>; interEdges: Map<number, Array<{to:number;cost:number}>> };
  ```

- [ ] **Step 1: Failing test** `tests/colony.pathHierarchy.test.ts` (portals piece):
  ```ts
  import { describe, expect, it } from 'vitest';
  import { createMap, setPassable } from '@/games/colony/systems/grid';
  import { detectPortals, clusterIdOf } from '@/games/colony/systems/pathHierarchy';

  describe('portals', () => {
    it('an open 32x32 map yields one portal per border segment between adjacent clusters', () => {
      const m = createMap(32, 32); // cluster 16 -> 2x2 clusters, fully passable
      const { portals, interEdges } = detectPortals(m, 16);
      // 4 internal borders (2 vertical between left/right pairs, 2 horizontal) -> each a single open
      // segment -> 1 portal pair each -> 8 portals total, 4 inter-edge pairs.
      expect(portals.length).toBe(8);
      let interPairs = 0; interEdges.forEach((arr) => interPairs += arr.length);
      expect(interPairs).toBe(8); // 4 pairs, bidirectional
    });
    it('a wall splitting a border produces two portal segments', () => {
      const m = createMap(32, 16); // 2x1 clusters, vertical border at x=15/16
      // block the middle rows of the border -> two passable segments
      for (let y = 6; y <= 9; y++) { setPassable(m, 15, y, false); setPassable(m, 16, y, false); }
      const { portalsByCluster } = detectPortals(m, 16);
      const left = portalsByCluster.get(clusterIdOf(0, 0, { clusterSize: 16, clustersW: 2 }))!;
      expect(left.length).toBe(2); // two segments -> two portals on the left cluster's border
    });
    it('a fully walled border yields no portals there', () => {
      const m = createMap(32, 16);
      for (let y = 0; y < 16; y++) { setPassable(m, 15, y, false); setPassable(m, 16, y, false); }
      const { portals } = detectPortals(m, 16);
      expect(portals.length).toBe(0);
    });
  });
  ```

- [ ] **Step 2: Run, expect failure.** `npx vitest run tests/colony.pathHierarchy.test.ts`.

- [ ] **Step 3: Implement clusters + portal detection.**
  ```ts
  import type { Pt } from '../domain/types';
  import { type ColonyMap, passableAt } from './grid';

  export interface Portal { id: number; x: number; y: number; cluster: number; }
  export interface Nav {
    clusterSize: number; clustersW: number; clustersH: number;
    portals: Portal[];
    portalsByCluster: Map<number, Portal[]>;
    interEdges: Map<number, Array<{ to: number; cost: number }>>;
    intraEdges: Map<number, Array<{ to: number; cost: number }>>;
    pathCache: Map<string, Pt[] | null>;
    dirty: Set<number>;
  }

  export const clusterIdOf = (
    x: number, y: number, nav: { clusterSize: number; clustersW: number },
  ): number => Math.floor(y / nav.clusterSize) * nav.clustersW + Math.floor(x / nav.clusterSize);

  export function detectPortals(m: ColonyMap, clusterSize: number) {
    const clustersW = Math.ceil(m.w / clusterSize);
    const clustersH = Math.ceil(m.h / clusterSize);
    const portals: Portal[] = [];
    const portalsByCluster = new Map<number, Portal[]>();
    const interEdges = new Map<number, Array<{ to: number; cost: number }>>();
    let nextId = 0;
    const addPortal = (x: number, y: number, cluster: number): Portal => {
      const p: Portal = { id: nextId++, x, y, cluster };
      portals.push(p);
      let arr = portalsByCluster.get(cluster); if (!arr) { arr = []; portalsByCluster.set(cluster, arr); }
      arr.push(p);
      return p;
    };
    const link = (a: Portal, b: Portal) => {
      const ea = interEdges.get(a.id) ?? []; ea.push({ to: b.id, cost: 1 }); interEdges.set(a.id, ea);
      const eb = interEdges.get(b.id) ?? []; eb.push({ to: a.id, cost: 1 }); interEdges.set(b.id, eb);
    };
    const cid = (cx: number, cy: number) => cy * clustersW + cx;

    // Вертикальные границы между (cx,cy) и (cx+1,cy): столбец xb=(cx+1)*cs-1 | xb+1.
    for (let cy = 0; cy < clustersH; cy++) {
      for (let cx = 0; cx < clustersW - 1; cx++) {
        const xb = (cx + 1) * clusterSize - 1;
        const y0 = cy * clusterSize, y1 = Math.min(m.h, y0 + clusterSize);
        segmentize(y0, y1, (y) => passableAt(m, xb, y) && passableAt(m, xb + 1, y), (ym) => {
          const a = addPortal(xb, ym, cid(cx, cy));
          const b = addPortal(xb + 1, ym, cid(cx + 1, cy));
          link(a, b);
        });
      }
    }
    // Горизонтальные границы между (cx,cy) и (cx,cy+1): строка yb=(cy+1)*cs-1 | yb+1.
    for (let cx = 0; cx < clustersW; cx++) {
      for (let cy = 0; cy < clustersH - 1; cy++) {
        const yb = (cy + 1) * clusterSize - 1;
        const x0 = cx * clusterSize, x1 = Math.min(m.w, x0 + clusterSize);
        segmentize(x0, x1, (x) => passableAt(m, x, yb) && passableAt(m, x, yb + 1), (xm) => {
          const a = addPortal(xm, yb, cid(cx, cy));
          const b = addPortal(xm, yb + 1, cid(cx, cy + 1));
          link(a, b);
        });
      }
    }
    return { portals, portalsByCluster, interEdges, clustersW, clustersH };
  }

  /** Находит макс. сегменты, где open(i)==true на [lo,hi); вызывает emit(середина сегмента). */
  function segmentize(lo: number, hi: number, open: (i: number) => boolean, emit: (mid: number) => void): void {
    let segStart = -1;
    for (let i = lo; i <= hi; i++) {
      const isOpen = i < hi && open(i);
      if (isOpen && segStart < 0) segStart = i;
      if (!isOpen && segStart >= 0) {
        emit((segStart + (i - 1)) >> 1); // midpoint of [segStart, i-1]
        segStart = -1;
      }
    }
  }
  ```

- [ ] **Step 4: Run.** `npx vitest run tests/colony.pathHierarchy.test.ts` → green. `npx tsc --noEmit` → 0.

- [ ] **Step 5: Commit.**
  ```bash
  git add src/games/colony/systems/pathHierarchy.ts tests/colony.pathHierarchy.test.ts
  git commit -m "feat(colony): cluster decomposition + border portal detection"
  ```

---

## Task 7: Intra-cluster portal distances + `buildNav`

For each cluster, compute the **local** shortest distance between every pair of its portals (A* restricted to the cluster's tile window) and store as `intraEdges`. Assemble the complete `Nav` via `buildNav(m, clusterSize)`.

**Files:**
- Modify: `src/games/colony/systems/pathHierarchy.ts`
- Modify: `tests/colony.pathHierarchy.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function localDistance(m: ColonyMap, cluster: number, clusterSize: number, clustersW: number, a: Pt, b: Pt): number | null;
  export function buildNav(m: ColonyMap, clusterSize: number): Nav;
  ```

- [ ] **Step 1: Failing test** — append:
  ```ts
  import { buildNav, localDistance } from '@/games/colony/systems/pathHierarchy';
  it('intra-cluster distance equals constrained path length', () => {
    const m = createMap(16, 16); // single cluster
    expect(localDistance(m, 0, 16, 1, { x: 0, y: 0 }, { x: 5, y: 0 })).toBe(5);
    for (let y = 0; y < 15; y++) setPassable(m, 8, y, false); // wall with gap at bottom
    const d = localDistance(m, 0, 16, 1, { x: 0, y: 0 }, { x: 15, y: 0 })!;
    expect(d).toBeGreaterThan(15); // must detour around the wall
  });
  it('buildNav assembles portals + intra edges and is internally consistent', () => {
    const m = createMap(32, 32);
    const nav = buildNav(m, 16);
    expect(nav.portals.length).toBe(8);
    // every portal that shares a cluster with another has an intra edge to it
    for (const p of nav.portals) {
      const mates = (nav.portalsByCluster.get(p.cluster) ?? []).filter((q) => q.id !== p.id);
      const intra = nav.intraEdges.get(p.id) ?? [];
      expect(intra.length).toBe(mates.length);
    }
  });
  ```

- [ ] **Step 2: Run, expect failure.**

- [ ] **Step 3: Implement `localDistance` + `buildNav`.** Add to `pathHierarchy.ts`:
  ```ts
  import { neighbors4 } from './grid';

  /** A* в пределах окна кластера; возвращает длину пути в шагах или null. */
  export function localDistance(
    m: ColonyMap, cluster: number, clusterSize: number, clustersW: number, a: Pt, b: Pt,
  ): number | null {
    if (a.x === b.x && a.y === b.y) return 0;
    const cx = (cluster % clustersW) * clusterSize, cy = Math.floor(cluster / clustersW) * clusterSize;
    const x1 = Math.min(m.w, cx + clusterSize), y1 = Math.min(m.h, cy + clusterSize);
    const inWin = (x: number, y: number) => x >= cx && y >= cy && x < x1 && y < y1;
    const key = (x: number, y: number) => y * m.w + x;
    const h = (x: number, y: number) => Math.abs(x - b.x) + Math.abs(y - b.y);
    const open: Array<{ k: number; x: number; y: number; f: number }> = [{ k: key(a.x, a.y), x: a.x, y: a.y, f: h(a.x, a.y) }];
    const g = new Map<number, number>([[key(a.x, a.y), 0]]);
    const closed = new Set<number>();
    while (open.length) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
      const cur = open.splice(bi, 1)[0];
      if (cur.x === b.x && cur.y === b.y) return g.get(cur.k)!;
      if (closed.has(cur.k)) continue; closed.add(cur.k);
      const cg = g.get(cur.k)!;
      for (const n of neighbors4(cur.x, cur.y, m)) {
        if (!inWin(n.x, n.y)) continue;
        const isTarget = n.x === b.x && n.y === b.y;
        if (!isTarget && !passableAt(m, n.x, n.y)) continue;
        const nk = key(n.x, n.y);
        const t = cg + 1;
        if (t < (g.get(nk) ?? Infinity)) {
          g.set(nk, t);
          open.push({ k: nk, x: n.x, y: n.y, f: t + h(n.x, n.y) });
        }
      }
    }
    return null;
  }

  export function buildNav(m: ColonyMap, clusterSize: number): Nav {
    const { portals, portalsByCluster, interEdges, clustersW, clustersH } = detectPortals(m, clusterSize);
    const intraEdges = new Map<number, Array<{ to: number; cost: number }>>();
    for (const [cluster, ps] of portalsByCluster) {
      for (let i = 0; i < ps.length; i++) {
        for (let j = i + 1; j < ps.length; j++) {
          const d = localDistance(m, cluster, clusterSize, clustersW, ps[i], ps[j]);
          if (d === null) continue;
          (intraEdges.get(ps[i].id) ?? setGet(intraEdges, ps[i].id)).push({ to: ps[j].id, cost: d });
          (intraEdges.get(ps[j].id) ?? setGet(intraEdges, ps[j].id)).push({ to: ps[i].id, cost: d });
        }
      }
    }
    return {
      clusterSize, clustersW, clustersH,
      portals, portalsByCluster, interEdges, intraEdges,
      pathCache: new Map(), dirty: new Set(),
    };
  }
  function setGet(map: Map<number, Array<{ to: number; cost: number }>>, k: number) {
    const a: Array<{ to: number; cost: number }> = []; map.set(k, a); return a;
  }
  ```
  (Use the standard `localDistance` linear-open A* here — clusters are ≤16² = 256 tiles, so the simple open-list is fine; the heap is reserved for full-map `findPath`.)

- [ ] **Step 4: Run.** `npx vitest run tests/colony.pathHierarchy.test.ts` → green. `npx tsc --noEmit` → 0.

- [ ] **Step 5: Commit.**
  ```bash
  git add src/games/colony/systems/pathHierarchy.ts tests/colony.pathHierarchy.test.ts
  git commit -m "feat(colony): intra-cluster portal distances + buildNav assembly"
  ```

---

## Task 8: Hierarchical path query (`findPathHier`)

Run A* over the abstract portal graph (intra + inter edges), splicing `start`/`goal` in as temporary nodes connected to their own cluster's portals, then **refine** each abstract hop into concrete tiles via `localDistance`'s path-returning sibling. Fall back to full heap-`findPath` when the abstract search finds nothing (guarantees completeness). Result is valid and length ≤ `PATH_LEN_BOUND_K · optimal`.

**Files:**
- Modify: `src/games/colony/systems/pathHierarchy.ts`
- Modify: `tests/colony.pathHierarchy.test.ts`
- Modify: `data/balance.ts` (`PATH_LEN_BOUND_K`)

**Interfaces:**
- Produces: `export function findPathHier(m: ColonyMap, nav: Nav, start: Pt, goal: Pt): Pt[] | null;`
- Consumes: `findPath` (Task 3, the fallback + the refinement uses a local path-returning A*).

- [ ] **Step 1: Add the bound constant** to `balance.ts`:
  ```ts
  export const PATH_LEN_BOUND_K = 1.6; // тест: длина иерархического пути <= K * оптимум
  ```

- [ ] **Step 2: Failing test** — append a validity + bound check vs BFS-optimal:
  ```ts
  import { findPathHier } from '@/games/colony/systems/pathHierarchy';
  import { findPath } from '@/games/colony/systems/pathfinding';
  import { PATH_LEN_BOUND_K } from '@/games/colony/data/balance';

  const valid = (m: any, start: any, path: any[], goal: any) => {
    if (path.length === 0) return start.x === goal.x && start.y === goal.y;
    let prev = start;
    for (const p of path) {
      if (Math.abs(p.x - prev.x) + Math.abs(p.y - prev.y) !== 1) return false;
      prev = p;
    }
    return prev.x === goal.x && prev.y === goal.y;
  };

  describe('findPathHier', () => {
    it('cross-cluster path is valid and within the length bound', () => {
      const m = createMap(48, 48); // 3x3 clusters
      for (let y = 0; y < 46; y++) setPassable(m, 24, y, false); // long wall, gap near bottom
      const nav = buildNav(m, 16);
      const start = { x: 2, y: 2 }, goal = { x: 45, y: 2 };
      const hier = findPathHier(m, nav, start, goal)!;
      const opt = findPath(m, start, goal)!;
      expect(hier).not.toBeNull();
      expect(valid(m, start, hier, goal)).toBe(true);
      expect(hier.length).toBeLessThanOrEqual(Math.ceil(opt.length * PATH_LEN_BOUND_K));
    });
    it('returns null when the goal cluster is sealed off', () => {
      const m = createMap(32, 16);
      for (let y = 0; y < 16; y++) { setPassable(m, 15, y, false); setPassable(m, 16, y, false); }
      const nav = buildNav(m, 16);
      expect(findPathHier(m, nav, { x: 1, y: 1 }, { x: 30, y: 1 })).toBeNull();
    });
    it('same-cluster short hop returns the local optimal path', () => {
      const m = createMap(16, 16);
      const nav = buildNav(m, 16);
      const hier = findPathHier(m, nav, { x: 1, y: 1 }, { x: 5, y: 1 })!;
      expect(hier.length).toBe(4);
    });
  });
  ```

- [ ] **Step 3: Implement `findPathHier` + a path-returning local A*.** Add to `pathHierarchy.ts`. First a `localPath` that returns concrete tiles within a cluster (same as `localDistance` but reconstructs); then the abstract search:
  ```ts
  import { findPath } from './pathfinding';
  import { PATH_LEN_BOUND_K } from '../data/balance'; // (imported for callers; not used here directly)

  /** Локальный A* в окне кластера, возвращает путевые точки БЕЗ старта (включая b) или null. */
  function localPath(m: ColonyMap, cluster: number, clusterSize: number, clustersW: number, a: Pt, b: Pt): Pt[] | null {
    if (a.x === b.x && a.y === b.y) return [];
    const cx = (cluster % clustersW) * clusterSize, cy = Math.floor(cluster / clustersW) * clusterSize;
    const x1 = Math.min(m.w, cx + clusterSize), y1 = Math.min(m.h, cy + clusterSize);
    const inWin = (x: number, y: number) => x >= cx && y >= cy && x < x1 && y < y1;
    const key = (x: number, y: number) => y * m.w + x;
    const open: Array<{ k: number; x: number; y: number; f: number }> = [{ k: key(a.x, a.y), x: a.x, y: a.y, f: 0 }];
    const g = new Map<number, number>([[key(a.x, a.y), 0]]);
    const came = new Map<number, number>();
    const closed = new Set<number>();
    while (open.length) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
      const cur = open.splice(bi, 1)[0];
      if (cur.x === b.x && cur.y === b.y) {
        const path: Pt[] = []; let ck = cur.k;
        while (ck !== key(a.x, a.y)) { path.push({ x: ck % m.w, y: Math.floor(ck / m.w) }); ck = came.get(ck)!; }
        return path.reverse();
      }
      if (closed.has(cur.k)) continue; closed.add(cur.k);
      const cg = g.get(cur.k)!;
      for (const n of neighbors4(cur.x, cur.y, m)) {
        if (!inWin(n.x, n.y)) continue;
        const isTarget = n.x === b.x && n.y === b.y;
        if (!isTarget && !passableAt(m, n.x, n.y)) continue;
        const nk = key(n.x, n.y); const t = cg + 1;
        if (t < (g.get(nk) ?? Infinity)) {
          g.set(nk, t); came.set(nk, cur.k);
          open.push({ k: nk, x: n.x, y: n.y, f: t + Math.abs(n.x - b.x) + Math.abs(n.y - b.y) });
        }
      }
    }
    return null;
  }

  export function findPathHier(m: ColonyMap, nav: Nav, start: Pt, goal: Pt): Pt[] | null {
    if (start.x === goal.x && start.y === goal.y) return [];
    const cs = nav.clusterSize, cw = nav.clustersW;
    const startC = clusterIdOf(start.x, start.y, nav), goalC = clusterIdOf(goal.x, goal.y, nav);

    // Однокластерный случай: прямой локальный путь (если есть), иначе общий A*.
    if (startC === goalC) {
      const lp = localPath(m, startC, cs, cw, start, goal);
      return lp ?? findPath(m, start, goal);
    }

    // Абстрактный граф: вершины = id порталов; плюс виртуальные START(-1)/GOAL(-2).
    const START = -1, GOAL = -2;
    const adj = (id: number): Array<{ to: number; cost: number }> => {
      if (id === START) {
        const out: Array<{ to: number; cost: number }> = [];
        for (const p of nav.portalsByCluster.get(startC) ?? []) {
          const d = localDistance(m, startC, cs, cw, start, p);
          if (d !== null) out.push({ to: p.id, cost: d });
        }
        return out;
      }
      const base = [...(nav.intraEdges.get(id) ?? []), ...(nav.interEdges.get(id) ?? [])];
      // если этот портал в кластере цели — добавить ребро к GOAL
      const p = nav.portals[id];
      if (p && clusterIdOf(p.x, p.y, nav) === goalC) {
        const d = localDistance(m, goalC, cs, cw, p, goal);
        if (d !== null) base.push({ to: GOAL, cost: d });
      }
      return base;
    };

    // A* по абстрактному графу (эвристика 0 -> Дейкстра; граф мал).
    const dist = new Map<number, number>([[START, 0]]);
    const prev = new Map<number, number>();
    const visited = new Set<number>();
    const pq: Array<{ id: number; d: number }> = [{ id: START, d: 0 }];
    let reached = false;
    while (pq.length) {
      let bi = 0; for (let i = 1; i < pq.length; i++) if (pq[i].d < pq[bi].d) bi = i;
      const cur = pq.splice(bi, 1)[0];
      if (cur.id === GOAL) { reached = true; break; }
      if (visited.has(cur.id)) continue; visited.add(cur.id);
      for (const e of adj(cur.id)) {
        const nd = cur.d + e.cost;
        if (nd < (dist.get(e.to) ?? Infinity)) { dist.set(e.to, nd); prev.set(e.to, cur.id); pq.push({ id: e.to, d: nd }); }
      }
    }
    if (!reached) return findPath(m, start, goal); // абстракт не нашёл — точный фолбэк (полнота)

    // Восстановить абстрактную цепочку START -> ... -> GOAL и уточнить в конкретные тайлы.
    const chain: number[] = []; let c = GOAL;
    while (c !== START) { chain.push(c); c = prev.get(c)!; }
    chain.push(START); chain.reverse(); // [START, p_i, p_j, ..., GOAL]

    const out: Pt[] = [];
    let curPt = start;
    for (let k = 1; k < chain.length; k++) {
      const node = chain[k];
      const target: Pt = node === GOAL ? goal : nav.portals[node];
      const curClusterId = clusterIdOf(curPt.x, curPt.y, nav);
      const tgtClusterId = clusterIdOf(target.x, target.y, nav);
      if (curClusterId === tgtClusterId) {
        const seg = localPath(m, curClusterId, cs, cw, curPt, target);
        if (seg === null) return findPath(m, start, goal);
        out.push(...seg);
      } else {
        // межкластерный шаг между смежными порталами: один шаг (соседние тайлы).
        out.push({ x: target.x, y: target.y });
      }
      curPt = target;
    }
    return out;
  }
  ```
  Reviewer guidance: the abstract layer can be Dijkstra (heuristic 0) since the portal graph is tiny; determinism comes from the fixed `pq` linear-min tie-break (first minimum wins) and the fixed portal id ordering. The refinement re-derives concrete tiles, so the returned path is genuinely walkable. The `localPath`/`localDistance` duplication (distance vs path) is acceptable here — they have different return contracts; do not collapse them into one "clever" function at the cost of clarity. If the bound test ever fails, raise `PATH_LEN_BOUND_K` rather than chasing optimality — near-optimal is the design.

- [ ] **Step 4: Run.** `npx vitest run tests/colony.pathHierarchy.test.ts` → green. `npx tsc --noEmit` → 0.

- [ ] **Step 5: Commit.**
  ```bash
  git add src/games/colony/systems/pathHierarchy.ts tests/colony.pathHierarchy.test.ts src/games/colony/data/balance.ts
  git commit -m "feat(colony): hierarchical path query over portal graph + refinement"
  ```

---

## Task 9: Path cache + dirty-cluster invalidation

Add a bounded path cache keyed by `start|goal` and a per-cluster dirty mechanism. `markDirtyAt` flags a cluster and clears the cache; `rebuildDirty` recomputes portals + intra edges for dirty clusters only.

**Files:**
- Modify: `src/games/colony/systems/pathHierarchy.ts`
- Modify: `tests/colony.pathHierarchy.test.ts`
- Modify: `data/balance.ts` (`PATH_CACHE_MAX`)

**Interfaces:**
- Produces:
  ```ts
  export function markDirtyAt(nav: Nav, x: number, y: number): void;
  export function rebuildDirty(nav: Nav, m: ColonyMap): void;
  export function cachedFindPathHier(m: ColonyMap, nav: Nav, start: Pt, goal: Pt): Pt[] | null;
  ```

- [ ] **Step 1: Add `PATH_CACHE_MAX`** to balance: `export const PATH_CACHE_MAX = 1024;`

- [ ] **Step 2: Failing test** — append:
  ```ts
  import { markDirtyAt, rebuildDirty, cachedFindPathHier } from '@/games/colony/systems/pathHierarchy';
  it('cache returns equal paths and invalidates after a wall is built', () => {
    const m = createMap(48, 16); // 3x1 clusters
    const nav = buildNav(m, 16);
    const start = { x: 1, y: 8 }, goal = { x: 46, y: 8 };
    const p1 = cachedFindPathHier(m, nav, start, goal)!;
    const p2 = cachedFindPathHier(m, nav, start, goal)!;
    expect(p2).toEqual(p1); // served from cache, identical
    // wall off the middle cluster's borders -> goal unreachable
    for (let y = 0; y < 16; y++) { setPassable(m, 31, y, false); setPassable(m, 32, y, false); }
    markDirtyAt(nav, 31, 8); markDirtyAt(nav, 32, 8);
    rebuildDirty(nav, m);
    expect(cachedFindPathHier(m, nav, start, goal)).toBeNull();
  });
  ```

- [ ] **Step 3: Implement cache + dirty.** Add to `pathHierarchy.ts`:
  ```ts
  import { PATH_CACHE_MAX } from '../data/balance';

  const cacheKey = (s: Pt, g: Pt) => `${s.x},${s.y}|${g.x},${g.y}`;

  export function cachedFindPathHier(m: ColonyMap, nav: Nav, start: Pt, goal: Pt): Pt[] | null {
    const k = cacheKey(start, goal);
    if (nav.pathCache.has(k)) {
      const hit = nav.pathCache.get(k)!;
      return hit === null ? null : hit.map((p) => ({ ...p }));
    }
    const res = findPathHier(m, nav, start, goal);
    if (nav.pathCache.size >= PATH_CACHE_MAX) nav.pathCache.clear(); // simple bound: flush when full
    nav.pathCache.set(k, res === null ? null : res.map((p) => ({ ...p })));
    return res === null ? null : res.map((p) => ({ ...p }));
  }

  export function markDirtyAt(nav: Nav, x: number, y: number): void {
    nav.dirty.add(clusterIdOf(x, y, nav));
    nav.pathCache.clear(); // any passability change can invalidate any cached path
  }

  /** Пересчёт порталов+intra для грязных кластеров (и их затронутых соседей). */
  export function rebuildDirty(nav: Nav, m: ColonyMap): void {
    if (nav.dirty.size === 0) return;
    // Простая корректная стратегия: полный пересчёт nav при наличии грязных кластеров,
    // но границы малы и события редки (стройка/добыча). Меняем содержимое nav на месте.
    const fresh = buildNav(m, nav.clusterSize);
    nav.portals = fresh.portals;
    nav.portalsByCluster = fresh.portalsByCluster;
    nav.interEdges = fresh.interEdges;
    nav.intraEdges = fresh.intraEdges;
    nav.clustersW = fresh.clustersW; nav.clustersH = fresh.clustersH;
    nav.pathCache.clear();
    nav.dirty.clear();
  }
  ```
  YAGNI note: `rebuildDirty` does a full `buildNav` rather than truly incremental per-cluster recompute. At 256² with `CLUSTER=16` that is 256 clusters and a few thousand local A* runs — acceptable because passability changes are rare (a building completes, a node clears), not per-tick. If the determinism/scale smoke (Task 15) shows a stall on frequent builds, make it incremental then — not now. Document this in the progress ledger as a known Minor.

- [ ] **Step 4: Run.** `npx vitest run tests/colony.pathHierarchy.test.ts` → green. `npx tsc --noEmit` → 0.

- [ ] **Step 5: Commit.**
  ```bash
  git add src/games/colony/systems/pathHierarchy.ts tests/colony.pathHierarchy.test.ts src/games/colony/data/balance.ts
  git commit -m "feat(colony): path cache + dirty-cluster nav invalidation"
  ```

---

## Task 10: Nav lifecycle + sim integration

Build `nav` at colony creation and load; store on `state.nav` (excluded from saves); route `jobScheduler` and `needs` through `cachedFindPathHier`; mark dirty when walls build / nodes clear; call `rebuildDirty` once per tick.

**Files:**
- Modify: `src/games/colony/domain/types.ts` (`nav?`, `assignCursor`)
- Modify: `src/games/colony/domain/createColony.ts`
- Modify: `src/games/colony/domain/save.ts` (build nav in `fromSave`; serialize `assignCursor`)
- Modify: `src/games/colony/systems/jobScheduler.ts`, `needs.ts`, `work.ts`, `tick.ts`

**Interfaces:**
- Consumes: `buildNav`, `cachedFindPathHier`, `markDirtyAt`, `rebuildDirty` (Tasks 7–9).

- [ ] **Step 1: Extend types.** In `types.ts`:
  ```ts
  import type { ColonyMap } from '../systems/grid';
  import type { Nav } from '../systems/pathHierarchy';
  // in ColonyState:
  map: ColonyMap;
  nav?: Nav;            // derived, NOT serialized
  assignCursor: number; // time-slice cursor (Task 11), serialized for exact resume
  ```

- [ ] **Step 2: Failing test** — new `tests/colony.nav.test.ts`:
  ```ts
  import { describe, expect, it } from 'vitest';
  import { createColony } from '@/games/colony/domain/createColony';
  import { toSave, fromSave } from '@/games/colony/domain/save';
  import { tick } from '@/games/colony/systems/tick';
  describe('nav lifecycle', () => {
    it('createColony builds a nav with portals', () => {
      const s = createColony(7);
      expect(s.nav).toBeDefined();
      expect(s.nav!.portals.length).toBeGreaterThan(0);
    });
    it('nav is not serialized but rebuilt on load', () => {
      const s = createColony(7);
      const save = toSave(s) as any;
      expect(save.nav).toBeUndefined();
      const loaded = fromSave(toSave(s));
      expect(loaded.nav).toBeDefined();
      expect(loaded.nav!.portals.length).toBe(s.nav!.portals.length);
    });
    it('a run stays deterministic and exception-free with hierarchical routing', () => {
      const a = createColony(99), b = createColony(99);
      for (let i = 0; i < 480; i++) { tick(a); tick(b); }
      expect(a.colonists.map(c => [c.task, c.path.length])).toEqual(b.colonists.map(c => [c.task, c.path.length]));
    });
  });
  ```

- [ ] **Step 3: Build nav in `createColony`.** After `const map = regenerateWorld(seed)`:
  ```ts
  import { buildNav } from '../systems/pathHierarchy';
  import { CLUSTER } from '../data/balance';
  // …
  const nav = buildNav(map, CLUSTER);
  // in the returned object:
  version: 6,
  // …
  map,
  nav,
  assignCursor: 0,
  ```

- [ ] **Step 4: Build nav in `fromSave`; serialize `assignCursor`.** In `save.ts`:
  - Add `assignCursor: number;` to `ColonySave`; set it in `toSave` (`assignCursor: s.assignCursor`) and read it in `fromSave`.
  - In `fromSave`, after constructing `map` and applying overrides/buildings:
    ```ts
    import { buildNav } from '../systems/pathHierarchy';
    import { CLUSTER } from '../data/balance';
    // …
    const nav = buildNav(map, CLUSTER);
    return { /* … */ map, nav, assignCursor: p.assignCursor ?? 0, /* … */ };
    ```

- [ ] **Step 5: Route scheduler + needs through the hierarchy.**
  - `jobScheduler.ts`: replace `findPath(s.map, from, target.tile)` with `cachedFindPathHier(s.map, s.nav!, from, target.tile)`.
  - `needs.ts` `routeTo`: replace `findPath(s.map, tileOf(c), target)` with `cachedFindPathHier(s.map, s.nav!, tileOf(c), target)`.
  - Imports: `import { cachedFindPathHier } from './pathHierarchy';`
  - Guard: `s.nav` is always present after createColony/fromSave; the `!` is safe. (If a test builds a bare state without nav, fall back: `s.nav ? cachedFindPathHier(...) : findPath(...)`. Prefer the fallback form to keep unit tests that construct minimal states working.)

- [ ] **Step 6: Mark dirty on passability changes.** In `work.ts`, where a wall finishes and where a node clears:
  ```ts
  import { markDirtyAt } from './pathHierarchy';
  // wall built:
  if (building.type === 'wall') { setPassable(s.map, building.tile.x, building.tile.y, false); if (s.nav) markDirtyAt(s.nav, building.tile.x, building.tile.y); }
  // node depleted to clear (woodcut clears to grass — passability unchanged, but the node target vanished):
  // node clearing does NOT change passability, so no markDirty needed there. Only wall/door build/remove do.
  ```
  Also in `build.ts` if blueprint placement immediately blocks a tile (verify: Plan-0 walls block only on completion, handled above; door placement does not block). Confirm by reading `build.ts`; if placement never changes `passable`, no change needed there.

- [ ] **Step 7: Rebuild dirty once per tick.** In `tick.ts`, before `runJobScheduler(s)`:
  ```ts
  import { rebuildDirty } from './pathHierarchy';
  // …
  if (s.nav) rebuildDirty(s.nav, s.map);
  runJobScheduler(s);
  ```

- [ ] **Step 8: Run the full suite.** Run: `npx vitest run` → green (existing playtest + new nav test). `npx tsc --noEmit` → 0. Any test that constructs a `ColonyState` literal must add `assignCursor: 0` (and may omit `nav`); fix those compile errors.

- [ ] **Step 9: Commit.**
  ```bash
  git add src/games/colony/domain/types.ts src/games/colony/domain/createColony.ts src/games/colony/domain/save.ts src/games/colony/systems/jobScheduler.ts src/games/colony/systems/needs.ts src/games/colony/systems/work.ts src/games/colony/systems/tick.ts tests/colony.nav.test.ts
  git commit -m "feat(colony): nav lifecycle + hierarchical routing in sim (dirty rebuild per tick)"
  ```

---

## Task 11: Time-sliced assignment

Cap path computations per tick at `ASSIGN_BUDGET`, processing idle colonists in a fixed rotating order via `state.assignCursor` so no colonist starves and the order is deterministic.

**Files:**
- Modify: `src/games/colony/systems/jobScheduler.ts`
- Modify: `data/balance.ts` (`ASSIGN_BUDGET`)
- Modify: `tests/colony.scheduler.test.ts`

- [ ] **Step 1: Add `ASSIGN_BUDGET`** to balance: `export const ASSIGN_BUDGET = 24; // макс. построений пути за тик`.

- [ ] **Step 2: Failing test** — append:
  ```ts
  import { ASSIGN_BUDGET } from '@/games/colony/data/balance';
  it('assigns at most ASSIGN_BUDGET paths per tick but eventually serves everyone', () => {
    const s = createColony(2024);
    // force many idle colonists by cloning (deterministic, no RNG)
    const base = s.colonists[0];
    while (s.colonists.length < ASSIGN_BUDGET + 10) {
      s.colonists.push({ ...base, id: `c${s.colonists.length}`, pos: { ...base.pos }, path: [], task: 'idle' });
    }
    // one scheduler pass assigns no more than budget new goto_work transitions
    const before = s.colonists.filter(c => c.task !== 'idle').length;
    // (call tick once; scheduler runs inside)
    const { tick } = require('@/games/colony/systems/tick');
    tick(s);
    const assignedThisTick = s.colonists.filter(c => c.task === 'goto_work').length;
    expect(assignedThisTick).toBeLessThanOrEqual(ASSIGN_BUDGET);
  });
  ```
  (If `require` is awkward under ESM, import `tick` at top of file instead.)

- [ ] **Step 3: Implement the budget + cursor.** In `runJobScheduler`:
  ```ts
  import { CLUSTER, ASSIGN_BUDGET } from '../data/balance';
  export function runJobScheduler(s: ColonyState): void {
    const { ix, byTile } = buildTargetIndex(s);
    const n = s.colonists.length;
    let budget = ASSIGN_BUDGET;
    for (let step = 0; step < n && budget > 0; step++) {
      const i = (s.assignCursor + step) % n;
      const c = s.colonists[i];
      if (!c.alive || c.task !== 'idle') continue;
      const jobs = JOB_ORDER
        .filter((j) => (c.priorities[j] ?? 0) > 0)
        .sort((a, b) => (c.priorities[b] - c.priorities[a]) || (JOB_ORDER.indexOf(a) - JOB_ORDER.indexOf(b)));
      const from = tileOf(c);
      let assigned = false;
      for (const job of jobs) {
        const target = findTarget(s, from, job, ix, byTile);
        if (!target) continue;
        const path = s.nav ? cachedFindPathHier(s.map, s.nav, from, target.tile) : findPath(s.map, from, target.tile);
        if (path === null) continue;
        c.targetTile = target.tile; c.targetBuildingId = target.buildingId;
        c.path = path; c.task = 'goto_work'; assigned = true; break;
      }
      if (assigned) budget -= 1; // budget counts successful path computes/assignments
    }
    s.assignCursor = n > 0 ? (s.assignCursor + n) % n : 0; // advance cursor each tick (full sweep offset)
  }
  ```
  Design note: the budget counts **assignments**, so an under-served frame leaves remaining idles for next tick; the cursor advances by `n` (≡ keep rotating start point deterministically) — equivalently advance by the number of colonists examined. Either deterministic rule is acceptable; pin it with the determinism test. Ensure the determinism test from Task 5/10 still passes (same seed → identical run) — if advancing the cursor breaks it, advance by a fixed `ASSIGN_BUDGET` instead; choose whichever keeps the determinism test green and document it.

- [ ] **Step 4: Run.** `npx vitest run` → green (budget test + determinism). `npx tsc --noEmit` → 0.

- [ ] **Step 5: Commit.**
  ```bash
  git add src/games/colony/systems/jobScheduler.ts src/games/colony/data/balance.ts tests/colony.scheduler.test.ts
  git commit -m "feat(colony): time-sliced job assignment (budget + rotating cursor)"
  ```

---

## Task 12: Flip the map to 256² + worldgen tuning

Raise `MAP_W/H` to 256 and tune `GEN` so the larger world is varied and connected. Add scale worldgen tests (connectivity around the start, start-site passable, biome variety).

**Files:**
- Modify: `src/games/colony/data/balance.ts`
- Create: `tests/colony.scale.test.ts` (worldgen portion; smoke added in Task 15)

- [ ] **Step 1: Failing test** `tests/colony.scale.test.ts`:
  ```ts
  import { describe, expect, it } from 'vitest';
  import { regenerateWorld, pickStartSite } from '@/games/colony/domain/worldgen';
  import { passableAt, biomeAt, forEachTile, neighbors4 } from '@/games/colony/systems/grid';
  import { MAP_W, MAP_H } from '@/games/colony/data/balance';

  describe('256² worldgen', () => {
    it('map is the configured size', () => {
      expect(MAP_W).toBe(256); expect(MAP_H).toBe(256);
    });
    it('start site is passable and has a passable neighbourhood', () => {
      const m = regenerateWorld(42);
      const s = pickStartSite(m);
      expect(passableAt(m, s.x, s.y)).toBe(true);
      const open = neighbors4(s.x, s.y, m).filter((n) => passableAt(m, n.x, n.y)).length;
      expect(open).toBeGreaterThanOrEqual(2); // not boxed in
    });
    it('a flood fill from the start reaches a large connected area', () => {
      const m = regenerateWorld(42);
      const s = pickStartSite(m);
      const seen = new Uint8Array(m.w * m.h);
      const stack = [s]; let count = 0;
      seen[s.y * m.w + s.x] = 1;
      while (stack.length) {
        const p = stack.pop()!; count++;
        for (const n of neighbors4(p.x, p.y, m)) {
          const i = n.y * m.w + n.x;
          if (!seen[i] && passableAt(m, n.x, n.y)) { seen[i] = 1; stack.push(n); }
        }
      }
      expect(count).toBeGreaterThan(m.w * m.h * 0.3); // >30% of tiles reachable
    });
    it('has biome variety (water, forest, and grass/meadow all present)', () => {
      const m = regenerateWorld(42);
      const kinds = new Set<string>();
      forEachTile(m, (_i, x, y) => kinds.add(biomeAt(m, x, y)!));
      expect(kinds.has('water')).toBe(true);
      expect(kinds.has('forest')).toBe(true);
      expect(kinds.has('grass') || kinds.has('meadow')).toBe(true);
    });
  });
  ```

- [ ] **Step 2: Run, expect failure** (MAP is still 28). Run: `npx vitest run tests/colony.scale.test.ts`.

- [ ] **Step 3: Flip the constants + tune GEN.** In `balance.ts`:
  ```ts
  export const MAP_W = 256;
  export const MAP_H = 256;
  // …
  export const GEN = {
    elevScale: 42,       // крупнее = более плавные континенты на 256²
    moistScale: 36,
    waterLevel: 0.34,
    marshMax: 0.39,
    rockMin: 0.60,
    mountainMin: 0.70,
    forestMoist: 0.60,
    meadowMoist: 0.44,
    riverCount: 12,
    riverMaxSteps: 1500,
    pStone: 0.05, pIron: 0.018, pGold: 0.004, pClay: 0.05, pBerries: 0.03, pFish: 0.04,
    woodMin: 20, woodMax: 50,
    oreMin: 30, oreMax: 80,
  } as const;
  ```
  These are starting values for the in-implementation balance pass; if the connectivity test fails, lower `mountainMin`/`waterLevel` or raise `elevScale` until ≥30% is reachable from the start. Tune to pass the test deterministically for seed 42 (and spot-check 2–3 other seeds manually).

- [ ] **Step 4: Run the full suite.** Run: `npx vitest run` → green. Existing 28²-assuming tests that hard-code positions may break; fix any that assumed `MAP_W=28` (e.g. tests constructing colonists at specific coords). `npx tsc --noEmit` → 0.

- [ ] **Step 5: Commit.**
  ```bash
  git add src/games/colony/data/balance.ts tests/colony.scale.test.ts
  git commit -m "feat(colony): flip world to 256² + worldgen tuning for scale"
  ```

---

## Task 13: Save version bump (5 → 6) + round-trip at scale

Bump `payloadVersion` to 6 (rejects v5 saves), set `createColony` `version: 6`, and assert the save round-trip reproduces the world identically at 256² with node depletion + buildings persisting.

**Files:**
- Modify: `src/games/colony/ColonyGameModule.ts`
- Modify: `src/games/colony/domain/createColony.ts` (already `version: 6` from Task 10 — verify)
- Modify: `tests/save.test.ts` or `tests/colony.migration.test.ts`

- [ ] **Step 1: Failing test** — extend `tests/save.test.ts`:
  ```ts
  import { createColony } from '@/games/colony/domain/createColony';
  import { toSave, fromSave } from '@/games/colony/domain/save';
  import { biomeAt, nodeAt, depleteNode, forEachTile } from '@/games/colony/systems/grid';
  it('round-trips a mutated 256² world deterministically', () => {
    const s = createColony(777);
    // mutate: deplete a known wood node + change a biome
    let woodTile: { x: number; y: number } | undefined;
    forEachTile(s.map, (i, x, y) => { if (!woodTile && nodeAt(s.map, x, y)?.kind === 'wood') woodTile = { x, y }; });
    if (woodTile) depleteNode(s.map, woodTile.x, woodTile.y, 3);
    const loaded = fromSave(toSave(s));
    expect(loaded.version).toBe(6);
    // every tile biome + node matches
    let mismatches = 0;
    forEachTile(s.map, (i, x, y) => {
      if (biomeAt(s.map, x, y) !== biomeAt(loaded, x, y)) mismatches++;
      if ((nodeAt(s.map, x, y)?.amount ?? -1) !== (nodeAt(loaded, x, y)?.amount ?? -1)) mismatches++;
    });
    expect(mismatches).toBe(0);
  });
  ```

- [ ] **Step 2: Run, expect failure** (version mismatch / depletion not persisted). Run: `npx vitest run tests/save.test.ts`.

- [ ] **Step 3: Bump versions.** In `ColonyGameModule.ts`: `const COLONY_PAYLOAD_VERSION = 6;`. Confirm `createColony` returns `version: 6` (Task 10). The `mount` guard already rejects mismatched versions.

- [ ] **Step 4: Run the suite.** Run: `npx vitest run` → green. `npx tsc --noEmit` → 0.

- [ ] **Step 5: Commit.**
  ```bash
  git add src/games/colony/ColonyGameModule.ts tests/save.test.ts
  git commit -m "feat(colony): payloadVersion 6 + 256² save round-trip (rejects v5)"
  ```

---

## Task 14: Minimal camera + viewport culling

Give `WorldScene` a pan/zoom camera (drag + WASD + wheel, world-clamped) and cull `drawMap`/`drawTempOverlay` to the visible tile range so 256² renders. Extract the math into a pure, unit-tested module.

**Files:**
- Create: `src/games/colony/scenes/cameraMath.ts`
- Create: `tests/colony.camera.test.ts`
- Modify: `src/games/colony/scenes/WorldScene.ts`

**Interfaces:**
- Produces:
  ```ts
  export function visibleTileRange(
    scrollX: number, scrollY: number, zoom: number,
    viewW: number, viewH: number, tile: number, mapW: number, mapH: number,
  ): { x0: number; y0: number; x1: number; y1: number };
  export function clampScroll(
    scrollX: number, scrollY: number, zoom: number,
    viewW: number, viewH: number, worldW: number, worldH: number,
  ): { x: number; y: number };
  ```

- [ ] **Step 1: Failing test** `tests/colony.camera.test.ts`:
  ```ts
  import { describe, expect, it } from 'vitest';
  import { visibleTileRange, clampScroll } from '@/games/colony/scenes/cameraMath';
  describe('cameraMath', () => {
    it('visibleTileRange covers exactly the on-screen tiles (+1 margin), clamped to map', () => {
      // scroll origin at world (0,0), zoom 1, 100x100 px view, tile 10 -> tiles 0..10 (with margin), clamped
      const r = visibleTileRange(0, 0, 1, 100, 100, 10, 256, 256);
      expect(r.x0).toBe(0); expect(r.y0).toBe(0);
      expect(r.x1).toBeGreaterThanOrEqual(9);
      expect(r.x1).toBeLessThanOrEqual(11);
    });
    it('visibleTileRange clamps at the far map edge', () => {
      const r = visibleTileRange(255 * 10, 255 * 10, 1, 100, 100, 10, 256, 256);
      expect(r.x1).toBe(255); expect(r.y1).toBe(255);
    });
    it('clampScroll keeps the viewport inside the world', () => {
      const c = clampScroll(-500, -500, 1, 100, 100, 256 * 10, 256 * 10);
      expect(c.x).toBeGreaterThanOrEqual(0); expect(c.y).toBeGreaterThanOrEqual(0);
      const far = clampScroll(99999, 99999, 1, 100, 100, 256 * 10, 256 * 10);
      expect(far.x).toBeLessThanOrEqual(256 * 10);
    });
  });
  ```

- [ ] **Step 2: Run, expect failure.**

- [ ] **Step 3: Implement `cameraMath.ts`.**
  ```ts
  /** Диапазон видимых тайлов (с запасом в 1 тайл), отсечённый по карте. */
  export function visibleTileRange(
    scrollX: number, scrollY: number, zoom: number,
    viewW: number, viewH: number, tile: number, mapW: number, mapH: number,
  ): { x0: number; y0: number; x1: number; y1: number } {
    const worldW = viewW / zoom, worldH = viewH / zoom;
    const x0 = Math.max(0, Math.floor(scrollX / tile) - 1);
    const y0 = Math.max(0, Math.floor(scrollY / tile) - 1);
    const x1 = Math.min(mapW - 1, Math.floor((scrollX + worldW) / tile) + 1);
    const y1 = Math.min(mapH - 1, Math.floor((scrollY + worldH) / tile) + 1);
    return { x0, y0, x1, y1 };
  }

  /** Ограничивает прокрутку, чтобы вьюпорт не выходил за мир. */
  export function clampScroll(
    scrollX: number, scrollY: number, zoom: number,
    viewW: number, viewH: number, worldW: number, worldH: number,
  ): { x: number; y: number } {
    const visW = viewW / zoom, visH = viewH / zoom;
    const maxX = Math.max(0, worldW - visW), maxY = Math.max(0, worldH - visH);
    return {
      x: Math.min(Math.max(0, scrollX), Math.max(maxX, worldW)),
      y: Math.min(Math.max(0, scrollY), Math.max(maxY, worldH)),
    };
  }
  ```
  (The exact clamp upper bound can be `maxX`; the test only requires staying within `[0, worldW]`. Keep it simple and pin behavior with the test.)

- [ ] **Step 4: Wire the camera + culling into `WorldScene`.** Replace `fitCamera` (fixed center) with an initial framing that still centers on the start but enables free scroll; redraw the culled map each frame (or on camera-move). Concretely:
  - Add fields: `private camScrollX = 0; camScrollY = 0; camZoom = 1; private mapLayer!: Phaser.GameObjects.Graphics;`
  - In `create()`: create `this.mapLayer = this.add.graphics();` (replacing the one-shot `drawMap` graphics), set initial zoom to frame the start area, and register input: pointer drag → pan; `wheel` → zoom (clamped, e.g. 0.4–3); WASD via `this.input.keyboard`.
  - Replace `drawMap()` body to draw only `visibleTileRange(...)`:
    ```ts
    private redrawMap() {
      const cam = this.cameras.main;
      const r = visibleTileRange(cam.scrollX, cam.scrollY, cam.zoom, cam.width, cam.height, TILE, this.state.map.w, this.state.map.h);
      this.mapLayer.clear();
      for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) {
        this.mapLayer.fillStyle(BIOME_COLOR[biomeAt(this.state.map, x, y) ?? 'grass'] ?? 0x222222, 1);
        this.mapLayer.fillRect(x * TILE, y * TILE, TILE - 1, TILE - 1);
      }
    }
    ```
  - Cull `drawTempOverlay` the same way (iterate the visible range instead of `forEachTile`).
  - In `update()`: apply pan/zoom from input via `clampScroll`, set `cam.setScroll(...)`/`cam.setZoom(...)`, then call `this.redrawMap()` (throttle to camera-changed or every frame — 256² visible is at most ~viewport/TILE² tiles, cheap).
  - Keep colonist dots / buildings as-is (they are sprite objects, naturally culled by Phaser; Plan C adds pooling/LOD).
  - This task is **not** unit-tested at the Phaser layer (consistent with Plan A); the pure math is covered by Task-14 tests. Verify manually that `npx tsc --noEmit` passes and the scene compiles.

- [ ] **Step 5: Run.** `npx vitest run` → green (camera math + full suite). `npx tsc --noEmit` → 0.

- [ ] **Step 6: Commit.**
  ```bash
  git add src/games/colony/scenes/cameraMath.ts src/games/colony/scenes/WorldScene.ts tests/colony.camera.test.ts
  git commit -m "feat(colony): pan/zoom camera + viewport-culled render for 256²"
  ```

---

## Task 15: Scale & determinism smoke + definition copy

Prove the engine handles 200+ agents at 256² without exceptions and identically per seed, and refresh the game's tagline.

**Files:**
- Modify: `tests/colony.scale.test.ts` (add the 200-agent smoke)
- Modify: `src/games/colony/definition.ts`

- [ ] **Step 1: Failing/【new】 smoke test** — append to `tests/colony.scale.test.ts`:
  ```ts
  import { createColony } from '@/games/colony/domain/createColony';
  import { tick } from '@/games/colony/systems/tick';
  import { passableAt, neighbors4 } from '@/games/colony/systems/grid';

  function populate(seed: number, n: number) {
    const s = createColony(seed);
    const base = s.colonists[0];
    // spiral out from the start placing colonists on passable tiles (deterministic)
    const start = { x: Math.round(base.pos.x), y: Math.round(base.pos.y) };
    const spots: Array<{ x: number; y: number }> = [];
    for (let rad = 0; rad < 40 && spots.length < n; rad++)
      for (let dy = -rad; dy <= rad && spots.length < n; dy++)
        for (let dx = -rad; dx <= rad && spots.length < n; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
          const x = start.x + dx, y = start.y + dy;
          if (passableAt(s.map, x, y)) spots.push({ x, y });
        }
    s.colonists = spots.slice(0, n).map((p, i) => ({
      ...base, id: `c${i}`, name: `C${i}`, pos: { x: p.x, y: p.y }, path: [], task: 'idle' as const,
    }));
    return s;
  }

  describe('scale smoke', () => {
    it('256² with 200 agents runs 300 ticks without throwing', () => {
      const s = populate(2026, 200);
      expect(s.colonists.length).toBe(200);
      expect(() => { for (let i = 0; i < 300; i++) tick(s); }).not.toThrow();
    });
    it('one seed -> identical run with 200 agents', () => {
      const a = populate(2026, 200), b = populate(2026, 200);
      for (let i = 0; i < 200; i++) { tick(a); tick(b); }
      const proj = (s: any) => s.colonists.map((c: any) => [c.task, Math.round(c.pos.x), Math.round(c.pos.y), c.path.length]);
      expect(proj(a)).toEqual(proj(b));
    });
  });
  ```

- [ ] **Step 2: Run.** Run: `npx vitest run tests/colony.scale.test.ts` → green (this validates the whole stack at scale). If it throws or is non-identical, fix the offending system (most likely a determinism leak or an unbounded loop) before proceeding — this is the acceptance gate.

- [ ] **Step 3: Update `definition.ts` copy** to reflect the FF direction (tagline/description mentioning the large procedural world). Keep ids/keys unchanged; only update human-readable strings.

- [ ] **Step 4: Run the full suite + tsc.** Run: `npx vitest run` → all green. `npx tsc --noEmit` → 0.

- [ ] **Step 5: Commit.**
  ```bash
  git add tests/colony.scale.test.ts src/games/colony/definition.ts
  git commit -m "test(colony): 256²/200-agent determinism smoke; definition copy"
  ```

---

## Self-Review (completed during planning)

- **Spec coverage:** §3 SoA (T1), §4 worldgen/scale (T1, T12), §5 render → minimal camera+culling per the user's scope choice (T14; full 2.5D/minimap deferred to Plan C), §6 heap-A* (T3) + hierarchy (T6–9) + spatial index (T4–5), §7 time-slice (T11), §8 tick integration + load (T10, T13), §9 acceptance (T12 connectivity, T8 hierarchical correctness, T15 200-agent smoke, T13 save round-trip), §10 test strategy (every task is TDD), §11 file structure (matches). Open question on HPA* optimality resolved: tests assert validity + length ≤ K·optimal (not equality) — **the spec's §6/§10 "эквивалентен полному A*" line will be corrected to "валиден и в пределах K·оптимума" before execution** (see note below).
- **Placeholder scan:** the only illustrative placeholder is the explicitly-flagged stub in Task 5 Step 3, immediately followed by the precise implementation and a "remove before commit" instruction.
- **Type consistency:** `ColonyMap` (SoA) defined in T1 and consumed unchanged; `Nav`/`Portal` defined in T6, extended in T7/T9, consumed in T10–11; `findPathHier`/`cachedFindPathHier` signatures stable from T8/T9 into T10–11; `assignCursor` added to `ColonyState`+`ColonySave` in T10 and used in T11.

**Pre-execution spec fix (do as the first action of execution, before Task 1):** update `docs/superpowers/specs/2026-06-23-colony-ff-foundation-design.md` §6 and §10 to replace "иерархический путь эквивалентен полному A*" with "иерархический путь валиден и не длиннее K·оптимума (K=PATH_LEN_BOUND_K)", reflecting the user's confirmed testing criterion. Commit that doc fix separately.

---

## Execution Handoff

Plan complete and saved. Recommended execution: **subagent-driven-development** (fresh implementer per task on `sonnet`, task review after each, final whole-branch review on the most capable model), continuing in this worktree (`feat/colony-ff-plan-b-scale`, stacked on Plan A's `feat/colony-ff-foundation`).
