# Colony Pillar 1B «Фермерство вглубь» Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the instant-yield farm building with a per-tile field cycle (till → plant → grow → ready → harvest) across 4 crops with dynamic, rotation-sensitive soil fertility, backed by land-clearing via 1A's chop zones and a small independent wood/berry regrowth system.

**Architecture:** Pure-systems engine (flat serializable `ColonyState` + deterministic seeded systems in a tick pipeline; Phaser host + React HUD) — same as Foundation/1A. Fields live in `ColonyState.fields: Map<number, FieldPlot>`, per-tile, no new entity type (brainstorm-approved variant B). Old `BuildingType.farm` is fully removed, not deprecated.

**Tech Stack:** TypeScript, Vitest, Phaser 3, React 18, Vite. Path alias `@/` → `src/`.

## Global Constraints

- **Determinism:** the only randomness source is the seeded `Rng` with serialized `rngState`. All system loops use fixed iteration order. `Map` iteration is insertion-order — preserve it. One seed + identical commands → identical run.
- **SoA seam:** never read/write raw `map.fertility[...]` (or any other `map.<field>[...]`) outside `systems/grid.ts`. Use grid accessors (`fertilityAt`/`setFertility`). `tests/colony.seam.test.ts` enforces this by grep — it will fail if violated.
- **Save compatibility:** bump `payloadVersion` (7→8) in BOTH `domain/createColony.ts` (`version`) and `ColonyGameModule.ts` (`COLONY_PAYLOAD_VERSION`) — done in Task 7. Old saves are rejected on mount (mechanism exists). The SoA grid is NOT serialized — it regenerates from seed; only sparse overrides + player state persist.
- **Quality gate per task:** `npx tsc --noEmit` exits 0 AND the named tests pass before commit. When `ColonyState` gains a new required field (Task 1: `fields`/`regrowCooldowns`), `domain/save.ts`'s `fromSave` must return an object satisfying the new shape in the SAME task (stub `new Map()` is fine — real persistence lands in Task 7), exactly as 1A did for `designations` in its Task 3.
- **UI copy:** Russian, matching existing labels.
- **Commit style:** end commit messages with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Work happens on branch `worktree-colony-pillar1b-farming`.
- **Behavior-change tasks (6, 7, 11) touch code other tasks also touch** — read the *current* file content before editing; don't assume the plan's quoted snippets are still byte-for-byte current if earlier tasks in this plan already changed the file.

---

### Task 1: Types & resource scaffold (`fiber`, `CropId`, `FieldStage`, `FieldPlot`, empty `fields`/`regrowCooldowns`)

**Files:**
- Modify: `src/games/colony/domain/types.ts` (ResourceId, CropId, FieldStage, FieldPlot, ColonyState.fields/regrowCooldowns)
- Modify: `src/games/colony/data/balance.ts` (START_RESOURCES.fiber)
- Modify: `src/games/colony/domain/createColony.ts` (resources.fiber; fields/regrowCooldowns init)
- Modify: `src/games/colony/domain/save.ts` (fromSave stub for fields/regrowCooldowns — type-satisfying only, not yet persisted)
- Modify: `src/games/colony/systems/work.ts` (applyStorageCapacity loop; addResource type already generic — no change needed there)
- Modify: `src/games/colony/systems/projection.ts` (resources literal +fiber)
- Modify: `src/games/colony/ui/ColonyHud.tsx` (RES_META +fiber)
- Test: `tests/colony.fields.test.ts` (create)

**Interfaces:**
- Produces: `ResourceId += 'fiber'`; `CropId = 'wheat' | 'potato' | 'legume' | 'flax'`; `FieldStage = 'till' | 'plant' | 'grow' | 'ready'`; `FieldPlot = { crop: CropId; stage: FieldStage; progress: number }`; `ColonyState.fields: Map<number, FieldPlot>`; `ColonyState.regrowCooldowns: Map<number, number>`.

- [ ] **Step 1: Write the failing test**

Create `tests/colony.fields.test.ts`:
```typescript
import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { computeHud } from '@/games/colony/systems/projection';

describe('fields scaffold', () => {
  it('createColony seeds fiber at 0 with capacity, and empty fields/regrowCooldowns maps', () => {
    const s = createColony(1);
    expect(s.resources.fiber.amount).toBe(0);
    expect(s.resources.fiber.capacity).toBeGreaterThan(0);
    expect(s.fields.size).toBe(0);
    expect(s.regrowCooldowns.size).toBe(0);
  });
  it('hud projection includes fiber', () => {
    const hud = computeHud(createColony(1));
    expect(hud.resources.fiber).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/colony.fields.test.ts`
Expected: FAIL (`resources.fiber` / `fields` undefined, or type errors).

- [ ] **Step 3: Implement**

In `src/games/colony/domain/types.ts`:
- Change the `ResourceId` line:
```typescript
export type ResourceId = 'food' | 'wood' | 'science' | 'stone' | 'clay' | 'iron' | 'gold' | 'fiber';
```
- Add after `TraitId`:
```typescript
export type CropId = 'wheat' | 'potato' | 'legume' | 'flax';
export type FieldStage = 'till' | 'plant' | 'grow' | 'ready';
export interface FieldPlot { crop: CropId; stage: FieldStage; progress: number; }
```
- Add to `ColonyState` (right after `designations: Set<number>;`):
```typescript
  fields: Map<number, FieldPlot>;       // tile index -> field state (till/plant/grow/ready)
  regrowCooldowns: Map<number, number>; // tile index -> days left until a depleted berries node regrows
```

In `src/games/colony/data/balance.ts`, add `fiber` to `START_RESOURCES`:
```typescript
export const START_RESOURCES: Record<ResourceId, Resource_> = {
  food: { amount: 120, capacity: 200 },
  wood: { amount: 60, capacity: 200 },
  science: { amount: 0, capacity: 200 },
  stone: { amount: 0, capacity: 200 },
  clay: { amount: 0, capacity: 200 },
  iron: { amount: 0, capacity: 200 },
  gold: { amount: 0, capacity: 200 },
  fiber: { amount: 0, capacity: 200 },
};
```

In `src/games/colony/domain/createColony.ts`:
- Add `fiber: { ...START_RESOURCES.fiber },` to the `resources:` object (after the `gold:` line).
- Add to the returned state object (right after `designations: new Set<number>(),`):
```typescript
    fields: new Map(),
    regrowCooldowns: new Map(),
```

In `src/games/colony/domain/save.ts`, in `fromSave`'s returned object, add (right after `designations: new Set<number>(p.designations ?? []),`):
```typescript
    fields: new Map(),          // real persistence lands in Task 7
    regrowCooldowns: new Map(), // real persistence lands in Task 7
```

In `src/games/colony/systems/work.ts`, extend `applyStorageCapacity`'s resource id list:
```typescript
function applyStorageCapacity(s: ColonyState): void {
  const built = s.buildings.filter((b) => b.type === 'storage' && b.built).length;
  const cap = 200 + built * STORAGE_CAPACITY_BONUS;
  for (const id of ['food', 'wood', 'science', 'stone', 'clay', 'iron', 'gold', 'fiber'] as const) s.resources[id].capacity = cap;
}
```

In `src/games/colony/systems/projection.ts`, add `fiber: { ...s.resources.fiber },` to the `resources:` literal (after `gold:`).

In `src/games/colony/ui/ColonyHud.tsx`, add to `RES_META` (after `gold`):
```typescript
  fiber: { label: 'Волокно', glyph: '🧵', tone: 'warn' },
```

- [ ] **Step 4: Run test + typecheck**

Run: `npx vitest run tests/colony.fields.test.ts && npx tsc --noEmit`
Expected: PASS, tsc exit 0.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(colony): fields/regrowCooldowns state scaffold + fiber resource

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `setFertility` grid mutator + `designateField` (pure field designation)

**Files:**
- Modify: `src/games/colony/systems/grid.ts` (setFertility)
- Create: `src/games/colony/systems/fields.ts`
- Test: `tests/colony.fields.test.ts` (extend)

**Interfaces:**
- Consumes: `Rect` (reused from `systems/designations.ts`), `ColonyState.fields` (Task 1).
- Produces: `setFertility(m: ColonyMap, x: number, y: number, v: number): void` (clamps `[0,1]`); `type FieldTool = CropId | 'clear'`; `designateField(s: ColonyState, rect: Rect, tool: FieldTool): void`.

- [ ] **Step 1: Write the failing test**

Append to `tests/colony.fields.test.ts`:
```typescript
import { designateField } from '@/games/colony/systems/fields';
import { setBiome, setPassable, setNode, setBuildingId, idx, biomeAt } from '@/games/colony/systems/grid';

describe('designateField', () => {
  it('marks only grass/meadow/marsh tiles inside the rect with the chosen crop', () => {
    const s = createColony(2);
    setBiome(s.map, 10, 10, 'grass'); setPassable(s.map, 10, 10, true);
    setBiome(s.map, 11, 10, 'forest'); setPassable(s.map, 11, 10, true); // not cleared yet
    setBiome(s.map, 12, 10, 'rock'); setPassable(s.map, 12, 10, true);
    designateField(s, { x0: 10, y0: 10, x1: 12, y1: 10 }, 'wheat');
    expect(s.fields.get(idx(10, 10, s.map.w))).toEqual({ crop: 'wheat', stage: 'till', progress: 0 });
    expect(s.fields.has(idx(11, 10, s.map.w))).toBe(false); // forest — must clear (chop) first
    expect(s.fields.has(idx(12, 10, s.map.w))).toBe(false); // rock — never farmable
  });
  it('rejects tiles with a building or an existing wild resource node', () => {
    const s = createColony(3);
    setBiome(s.map, 20, 20, 'grass'); setPassable(s.map, 20, 20, true);
    setBuildingId(s.map, 20, 20, 'b1');
    setBiome(s.map, 21, 20, 'grass'); setPassable(s.map, 21, 20, true);
    setNode(s.map, 21, 20, { kind: 'berries', amount: 5, max: 5 });
    designateField(s, { x0: 20, y0: 20, x1: 21, y1: 20 }, 'potato');
    expect(s.fields.size).toBe(0);
  });
  it('clear removes any plot in the rect; re-designating overwrites crop and resets progress', () => {
    const s = createColony(4);
    setBiome(s.map, 30, 30, 'meadow'); setPassable(s.map, 30, 30, true);
    designateField(s, { x0: 30, y0: 30, x1: 30, y1: 30 }, 'legume');
    const plot = s.fields.get(idx(30, 30, s.map.w))!;
    plot.stage = 'plant'; plot.progress = 3; // simulate partial progress
    designateField(s, { x0: 30, y0: 30, x1: 30, y1: 30 }, 'flax');
    expect(s.fields.get(idx(30, 30, s.map.w))).toEqual({ crop: 'flax', stage: 'till', progress: 0 });
    designateField(s, { x0: 30, y0: 30, x1: 30, y1: 30 }, 'clear');
    expect(s.fields.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/colony.fields.test.ts`
Expected: FAIL (`designateField`/`setFertility` not found).

- [ ] **Step 3: Implement**

In `src/games/colony/systems/grid.ts`, add after `setNode`:
```typescript
export const setFertility = (m: ColonyMap, x: number, y: number, v: number): void => {
  if (inBounds(x, y, m)) m.fertility[idx(x, y, m.w)] = Math.min(1, Math.max(0, v));
};
```

Create `src/games/colony/systems/fields.ts`:
```typescript
import type { ColonyState, CropId } from '../domain/types';
import type { Rect } from './designations';
import { idx, inBounds, biomeAt, buildingIdAt, nodeAt } from './grid';

export type { Rect };
export type FieldTool = CropId | 'clear';

const FARMABLE_BIOMES = new Set(['grass', 'meadow', 'marsh']);

/** Marks/clears field plots on tiles inside the rect. 'clear' removes any plot;
 *  a crop tool marks eligible bare land (grass/meadow/marsh, no building, no wild
 *  node — chop/mine/forage it first). Re-designating overwrites crop + resets
 *  progress. Fixed iteration order (determinism). */
export function designateField(s: ColonyState, rect: Rect, tool: FieldTool): void {
  const x0 = Math.min(rect.x0, rect.x1), x1 = Math.max(rect.x0, rect.x1);
  const y0 = Math.min(rect.y0, rect.y1), y1 = Math.max(rect.y0, rect.y1);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!inBounds(x, y, s.map)) continue;
      const i = idx(x, y, s.map.w);
      if (tool === 'clear') { s.fields.delete(i); continue; }
      const biome = biomeAt(s.map, x, y);
      if (!biome || !FARMABLE_BIOMES.has(biome)) continue;
      if (buildingIdAt(s.map, x, y)) continue;
      if (nodeAt(s.map, x, y)) continue;
      s.fields.set(i, { crop: tool, stage: 'till', progress: 0 });
    }
  }
}
```

- [ ] **Step 4: Run test + typecheck**

Run: `npx vitest run tests/colony.fields.test.ts && npx tsc --noEmit`
Expected: PASS, tsc 0.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(colony): designateField + grid.setFertility

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Job scheduler — `field:work` targeting (till/plant/ready; season-gated; farm dual-path)

**Files:**
- Modify: `src/games/colony/systems/jobScheduler.ts`
- Test: `tests/colony.fieldCycle.test.ts` (create)

**Interfaces:**
- Consumes: `ColonyState.fields` (Task 1), `s.env.season` (existing).
- Produces: scheduler targets `till`/`plant`/`ready` field tiles (not `grow`; not `till`/`plant` during `winter`); `job==='farm'` tries fields first, falls back to the (still-present) farm-building lookup until Task 6 removes it.

- [ ] **Step 1: Write the failing test**

Create `tests/colony.fieldCycle.test.ts`:
```typescript
import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { runJobScheduler } from '@/games/colony/systems/jobScheduler';
import { setBiome, setPassable, idx } from '@/games/colony/systems/grid';

describe('field scheduler targeting', () => {
  it('targets a till-stage field tile; ignores grow-stage tiles', () => {
    const s = createColony(1);
    const c0 = s.colonists[0];
    const tx = Math.round(c0.pos.x), ty = Math.round(c0.pos.y);
    setBiome(s.map, tx, ty, 'grass'); setPassable(s.map, tx, ty, true);
    s.fields.set(idx(tx, ty, s.map.w), { crop: 'wheat', stage: 'till', progress: 0 });
    s.colonists.forEach((c) => {
      c.task = 'idle';
      (['woodcut', 'forage', 'mine', 'research', 'build', 'tailor'] as const).forEach((j) => (c.priorities[j] = 0));
      c.priorities.farm = 3;
    });
    runJobScheduler(s);
    expect(s.colonists.some((c) => c.task === 'goto_work' && c.targetTile?.x === tx && c.targetTile?.y === ty)).toBe(true);
  });
  it('does not target till/plant tiles in winter, but still targets a ready tile', () => {
    const s = createColony(1);
    const c0 = s.colonists[0];
    const tx = Math.round(c0.pos.x), ty = Math.round(c0.pos.y);
    setBiome(s.map, tx, ty, 'grass'); setPassable(s.map, tx, ty, true);
    s.fields.set(idx(tx, ty, s.map.w), { crop: 'wheat', stage: 'till', progress: 0 });
    s.env.season = 'winter';
    s.colonists.forEach((c) => {
      c.task = 'idle';
      (['woodcut', 'forage', 'mine', 'research', 'build', 'tailor'] as const).forEach((j) => (c.priorities[j] = 0));
      c.priorities.farm = 3;
    });
    runJobScheduler(s);
    expect(s.colonists.some((c) => c.task === 'goto_work')).toBe(false);
    s.fields.set(idx(tx, ty, s.map.w), { crop: 'wheat', stage: 'ready', progress: 0 });
    runJobScheduler(s);
    expect(s.colonists.some((c) => c.task === 'goto_work' && c.targetTile?.x === tx && c.targetTile?.y === ty)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/colony.fieldCycle.test.ts`
Expected: FAIL (farm job doesn't route to field tiles yet).

- [ ] **Step 3: Implement**

In `src/games/colony/systems/jobScheduler.ts`, in `buildTargetIndex`, add the field loop right after the node loop (before the `return`):
```typescript
  for (const [i, plot] of s.fields) {
    if (plot.stage === 'grow') continue;                                // растёт пассивно, рабочий не нужен
    if (plot.stage !== 'ready' && s.env.season === 'winter') continue;   // зимой новый посев не начинают
    pts.push({ x: i % s.map.w, y: Math.floor(i / s.map.w), cat: 'field:work' });
  }
```

In `findTarget`, split `'farm'` out of the `job === 'farm' || job === 'research' || job === 'tailor'` branch and give it its own handling (fields first, farm-building fallback while the building still exists):
```typescript
  if (job === 'farm') {
    const t = nearest(ix, s.map.w, s.map.h, from, 'field:work');
    if (t) return { tile: t };
    const bt = nearest(ix, s.map.w, s.map.h, from, 'job:farm', (p) => {
      const b = byTile.get(`${p.x},${p.y}`)!;
      return workersOn(s, b.id) < b.workSlots;
    });
    if (!bt) return null;
    const b = byTile.get(`${bt.x},${bt.y}`)!;
    return { tile: b.tile, buildingId: b.id };
  }
  if (job === 'research' || job === 'tailor') {
    const t = nearest(ix, s.map.w, s.map.h, from, `job:${job}`, (p) => {
      const b = byTile.get(`${p.x},${p.y}`)!;
      return workersOn(s, b.id) < b.workSlots;
    });
    if (!t) return null;
    const b = byTile.get(`${t.x},${t.y}`)!;
    return { tile: b.tile, buildingId: b.id };
  }
```
(This replaces the existing combined `if (job === 'farm' || job === 'research' || job === 'tailor') { ... }` block with the two blocks above.)

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run tests/colony.fieldCycle.test.ts tests/colony.jobs.test.ts tests/colony.mining.test.ts && npx tsc --noEmit`
Expected: PASS (existing farm-building tests in `colony.jobs.test.ts` still pass via the fallback path), tsc 0.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(colony): scheduler targets field:work tiles for the farm job

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Work — till/plant/harvest labor cycle + passive growth + frost-kill

**Files:**
- Modify: `src/games/colony/data/balance.ts` (TILL/PLANT/HARVEST_BASE/REQUIRED; CROP_GROWTH_TICKS/CROP_YIELD/CROP_FERTILITY_DELTA)
- Modify: `src/games/colony/systems/work.ts` (field cycle branch; `advanceGrowth`; `killUnripeCrops`; berries regrowCooldown registration)
- Modify: `src/games/colony/systems/tick.ts` (call `advanceGrowth` every tick; call `killUnripeCrops` on season transition to winter)
- Test: `tests/colony.fieldCycle.test.ts` (extend)

**Interfaces:**
- Consumes: `setFertility`/`fertilityAt` (Task 2), `ColonyState.fields` (Task 1).
- Produces: `advanceGrowth(s: ColonyState): void` (exported from `work.ts`); `killUnripeCrops(s: ColonyState): void` (exported from `work.ts`); full till→plant→grow→ready→harvest cycle; harvesting mutates `Tile.fertility` by the crop's sign.

- [ ] **Step 1: Write the failing test**

Append to `tests/colony.fieldCycle.test.ts`:
```typescript
import { runWork, advanceGrowth, killUnripeCrops } from '@/games/colony/systems/work';
import { fertilityAt, setFertility } from '@/games/colony/systems/grid';
import { TILL_REQUIRED, PLANT_REQUIRED, HARVEST_REQUIRED, CROP_GROWTH_TICKS } from '@/games/colony/data/balance';

describe('field labor cycle', () => {
  it('till -> plant -> grow -> ready -> harvest, yields food and depletes fertility for wheat', () => {
    const s = createColony(5);
    const c = s.colonists[0];
    const tx = Math.round(c.pos.x), ty = Math.round(c.pos.y);
    setBiome(s.map, tx, ty, 'grass'); setPassable(s.map, tx, ty, true);
    setFertility(s.map, tx, ty, 0.5);
    s.fields.set(idx(tx, ty, s.map.w), { crop: 'wheat', stage: 'till', progress: 0 });
    c.task = 'work'; c.targetTile = { x: tx, y: ty }; c.targetBuildingId = undefined; c.pos = { x: tx, y: ty };

    for (let i = 0; i < TILL_REQUIRED * 4; i++) runWork(s); // *4: TILL_BASE=0.5/tick headroom
    expect(s.fields.get(idx(tx, ty, s.map.w))!.stage).toBe('plant');
    // runWork's finishWork cleared task+targetTile on the till->plant transition — re-arm the colonist.
    c.task = 'work'; c.targetTile = { x: tx, y: ty };

    for (let i = 0; i < PLANT_REQUIRED * 4; i++) runWork(s);
    expect(s.fields.get(idx(tx, ty, s.map.w))!.stage).toBe('grow');
    c.task = 'work'; c.targetTile = { x: tx, y: ty };

    for (let i = 0; i < CROP_GROWTH_TICKS.wheat + 1; i++) advanceGrowth(s);
    expect(s.fields.get(idx(tx, ty, s.map.w))!.stage).toBe('ready');

    const food0 = s.resources.food.amount;
    c.task = 'work'; c.targetTile = { x: tx, y: ty };
    for (let i = 0; i < HARVEST_REQUIRED * 4; i++) runWork(s);
    expect(s.resources.food.amount).toBeGreaterThan(food0);
    expect(s.fields.get(idx(tx, ty, s.map.w))!.stage).toBe('till');
    expect(fertilityAt(s.map, tx, ty)).toBeCloseTo(0.44, 5); // 0.5 - 0.06 (wheat)
  });

  it('flax harvest yields fiber, not food', () => {
    const s = createColony(6);
    const c = s.colonists[0];
    const tx = Math.round(c.pos.x), ty = Math.round(c.pos.y);
    setFertility(s.map, tx, ty, 0.5);
    s.fields.set(idx(tx, ty, s.map.w), { crop: 'flax', stage: 'ready', progress: 0 });
    c.task = 'work'; c.targetTile = { x: tx, y: ty }; c.targetBuildingId = undefined; c.pos = { x: tx, y: ty };
    const fiber0 = s.resources.fiber.amount;
    for (let i = 0; i < HARVEST_REQUIRED * 4; i++) runWork(s);
    expect(s.resources.fiber.amount).toBeGreaterThan(fiber0);
  });

  it('legume harvest raises fertility (crop rotation payoff)', () => {
    const s = createColony(7);
    const c = s.colonists[0];
    const tx = Math.round(c.pos.x), ty = Math.round(c.pos.y);
    setFertility(s.map, tx, ty, 0.5);
    s.fields.set(idx(tx, ty, s.map.w), { crop: 'legume', stage: 'ready', progress: 0 });
    c.task = 'work'; c.targetTile = { x: tx, y: ty }; c.targetBuildingId = undefined; c.pos = { x: tx, y: ty };
    for (let i = 0; i < HARVEST_REQUIRED * 4; i++) runWork(s);
    expect(fertilityAt(s.map, tx, ty)).toBeCloseTo(0.58, 5); // 0.5 + 0.08 (legume)
  });

  it('winter onset destroys an unripe (grow-stage) crop, resetting it to till with no fertility penalty', () => {
    const s = createColony(8);
    const tx = 40, ty = 40;
    setFertility(s.map, tx, ty, 0.4);
    s.fields.set(idx(tx, ty, s.map.w), { crop: 'potato', stage: 'grow', progress: 10 });
    killUnripeCrops(s);
    const plot = s.fields.get(idx(tx, ty, s.map.w))!;
    expect(plot.stage).toBe('till');
    expect(plot.progress).toBe(0);
    expect(fertilityAt(s.map, tx, ty)).toBeCloseTo(0.4, 5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/colony.fieldCycle.test.ts`
Expected: FAIL (`advanceGrowth`/`killUnripeCrops` not exported; field cycle not implemented).

- [ ] **Step 3: Implement**

In `src/games/colony/data/balance.ts`:
- Add `CropId` to the top type-only import: `import type { Biome, BuildingType, CropId, JobType, ResourceId } from '../domain/types';`
- Add near the bottom (new section):
```typescript
// ---- Столп 1B: фермерство вглубь ----
export const TILL_BASE = 0.5;     // *skill(farming) ; вспашка тайла
export const PLANT_BASE = 0.5;    // *skill(farming) ; посадка культуры
export const HARVEST_BASE = 0.5;  // *skill(farming) ; сбор урожая
export const TILL_REQUIRED = 5;
export const PLANT_REQUIRED = 4;
export const HARVEST_REQUIRED = 3;

export const CROP_GROWTH_TICKS: Record<CropId, number> = {
  wheat: 3 * TICKS_PER_DAY, potato: 4 * TICKS_PER_DAY, legume: 3 * TICKS_PER_DAY, flax: 4 * TICKS_PER_DAY,
};
export const CROP_YIELD: Record<CropId, number> = { wheat: 12, potato: 18, legume: 8, flax: 6 };
export const CROP_FERTILITY_DELTA: Record<CropId, number> = { wheat: -0.06, potato: -0.05, legume: 0.08, flax: -0.02 };

export const REGROW_CHANCE_WOOD = 0.02; // в день, на живой wood-узел
export const WOOD_SAPLING_AMOUNT = 15;
export const BERRY_REGROW_DAYS = 4;
export const BERRY_AMOUNT = 5;
```

In `src/games/colony/systems/work.ts`:
- Extend imports: add `CropId` to the type import; add `TILL_BASE, PLANT_BASE, HARVEST_BASE, TILL_REQUIRED, PLANT_REQUIRED, HARVEST_REQUIRED, CROP_GROWTH_TICKS, CROP_YIELD, CROP_FERTILITY_DELTA, BERRY_REGROW_DAYS` to the `../data/balance` import; add `setFertility` to the `./grid` import.
```typescript
import type { Building, Colonist, ColonyState, CropId, NodeKind, ResourceId, SkillId } from '../domain/types';
```
```typescript
import {
  BUILD_BASE, CLOTHING_REQUIRED, CLOTHING_WOOD_COST, FARM_BASE, FARM_FREEZE_TEMP,
  MINE_BASE, FORAGE_BASE, RESEARCH_BASE, STORAGE_CAPACITY_BONUS, TAILOR_BASE,
  WOODCUT_BASE, XP_PER_WORK_TICK,
  TILL_BASE, PLANT_BASE, HARVEST_BASE, TILL_REQUIRED, PLANT_REQUIRED, HARVEST_REQUIRED,
  CROP_GROWTH_TICKS, CROP_YIELD, CROP_FERTILITY_DELTA, BERRY_REGROW_DAYS,
} from '../data/balance';
import { fertilityAt, setFertility, tempAt, nodeAt, depleteNode, setBiome, setBuildingId, setPassable, idx } from './grid';
```
- Add a crop→resource table near `HARVEST` (top of file):
```typescript
const CROP_RESOURCE: Record<CropId, ResourceId> = { wheat: 'food', potato: 'food', legume: 'food', flax: 'fiber' };
```
- Replace the whole `// Добыча узла на тайле-цели (рубка/добыча/сбор).` block with a field-first version:
```typescript
    // Поле (till/plant/harvest) или добыча узла на тайле-цели.
    if (!building && c.targetTile) {
      const tx = c.targetTile.x, ty = c.targetTile.y;
      const fi = idx(tx, ty, s.map.w);
      const plot = s.fields.get(fi);
      if (plot) {
        if (tempAt(s.map, tx, ty) > FARM_FREEZE_TEMP) {
          if (plot.stage === 'till') {
            plot.progress += TILL_BASE * skillMultiplier(c.skills.farming.level) * workSpeed(c) * cf;
            grantXp(c.skills.farming, XP_PER_WORK_TICK);
            if (plot.progress >= TILL_REQUIRED) { plot.stage = 'plant'; plot.progress = 0; finishWork(c); }
          } else if (plot.stage === 'plant') {
            plot.progress += PLANT_BASE * skillMultiplier(c.skills.farming.level) * workSpeed(c) * cf;
            grantXp(c.skills.farming, XP_PER_WORK_TICK);
            if (plot.progress >= PLANT_REQUIRED) { plot.stage = 'grow'; plot.progress = 0; finishWork(c); }
          } else if (plot.stage === 'ready') {
            plot.progress += HARVEST_BASE * skillMultiplier(c.skills.farming.level) * workSpeed(c) * cf;
            grantXp(c.skills.farming, XP_PER_WORK_TICK);
            if (plot.progress >= HARVEST_REQUIRED) {
              const amt = CROP_YIELD[plot.crop] * (0.5 + fertilityAt(s.map, tx, ty)) * skillMultiplier(c.skills.farming.level) * cf;
              addResource(s, CROP_RESOURCE[plot.crop], amt);
              setFertility(s.map, tx, ty, fertilityAt(s.map, tx, ty) + CROP_FERTILITY_DELTA[plot.crop]);
              plot.stage = 'till'; plot.progress = 0;
              finishWork(c);
            }
          } else {
            finishWork(c); // 'grow' — рабочий тут не нужен, освобождаем
          }
        }
        continue;
      }
      const node = nodeAt(s.map, tx, ty);
      const rule = node ? HARVEST[node.kind] : null;
      if (node && rule && node.amount > 0) {
        const want = rule.base * skillMultiplier(c.skills[rule.skill].level) * workSpeed(c) * cf;
        const took = depleteNode(s.map, tx, ty, want);
        addResource(s, rule.res, took);
        grantXp(c.skills[rule.skill], XP_PER_WORK_TICK);
        if (!nodeAt(s.map, tx, ty)) {                   // узел истощён
          s.designations.delete(idx(tx, ty, s.map.w));   // снять пометку
          if (node.kind === 'wood') setBiome(s.map, tx, ty, 'grass');
          if (node.kind === 'berries') s.regrowCooldowns.set(idx(tx, ty, s.map.w), BERRY_REGROW_DAYS);
          finishWork(c);
        }
      } else {
        finishWork(c); // цель невалидна
      }
      continue;
    }
```
- Add two new exported functions at the end of the file:
```typescript
/** Пассивный рост 'grow'-тайлов; не требует рабочего. Вызывается раз в тик из tick.ts. */
export function advanceGrowth(s: ColonyState): void {
  for (const [i, plot] of s.fields) {
    if (plot.stage !== 'grow') continue;
    const x = i % s.map.w, y = Math.floor(i / s.map.w);
    if (tempAt(s.map, x, y) <= FARM_FREEZE_TEMP) continue; // приморожено — ждём тепла
    plot.progress += 1;
    if (plot.progress >= CROP_GROWTH_TICKS[plot.crop]) { plot.stage = 'ready'; plot.progress = 0; }
  }
}

/** На переходе сезона в 'winter' губит все незрелые (grow) посевы — семя погибло,
 *  время потрачено, штрафа к плодородию нет. */
export function killUnripeCrops(s: ColonyState): void {
  for (const plot of s.fields.values()) {
    if (plot.stage === 'grow') { plot.stage = 'till'; plot.progress = 0; }
  }
}
```

In `src/games/colony/systems/tick.ts`:
- Import: `import { runWork, advanceGrowth, killUnripeCrops } from './work';` (replace the existing `import { runWork } from './work';`).
- In `tick()`, add `advanceGrowth(s);` right after `runWork(s);`:
```typescript
  runWork(s);
  advanceGrowth(s);
```
- In `onNewDay`, capture the season before `advanceSeason` and call `killUnripeCrops` on the transition into winter:
```typescript
function onNewDay(s: ColonyState): void {
  const prevSeason = s.env.season;
  const rng = new Rng(s.rngState);
  advanceSeason(s, rng);
  if (prevSeason !== 'winter' && s.env.season === 'winter') killUnripeCrops(s);
  s.rngState = rng.seed;
  applyFoodSpoilage(s);
  ...
```
(Keep the rest of `onNewDay` unchanged.)

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run tests/colony.fieldCycle.test.ts tests/colony.work.test.ts tests/colony.mining.test.ts && npx tsc --noEmit`
Expected: PASS (incl. existing wood-chop/mining tests — untouched node-harvest path still works), tsc 0.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(colony): till/plant/grow/harvest field cycle + frost-kill on winter onset

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Regrowth — wood saplings + berry respawn

**Files:**
- Create: `src/games/colony/systems/regrowth.ts`
- Modify: `src/games/colony/systems/tick.ts` (call `runRegrowth` once per day)
- Test: `tests/colony.regrowth.test.ts` (create)

**Interfaces:**
- Consumes: `s.regrowCooldowns` (Task 1, registered on berries depletion in Task 4), `Rng` (existing, `@/core/utils/rng`).
- Produces: `runRegrowth(s: ColonyState, rng: Rng): void`.

- [ ] **Step 1: Write the failing test**

Create `tests/colony.regrowth.test.ts`:
```typescript
import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { runRegrowth } from '@/games/colony/systems/regrowth';
import { setNode, setBiome, setPassable, nodeAt, idx } from '@/games/colony/systems/grid';
import { Rng } from '@/core/utils/rng';

describe('regrowth', () => {
  it('is deterministic: same seed -> same spawn outcome', () => {
    const build = () => {
      const s = createColony(9);
      setNode(s.map, 50, 50, { kind: 'wood', amount: 20, max: 20 });
      setBiome(s.map, 51, 50, 'grass'); setPassable(s.map, 51, 50, true);
      setBiome(s.map, 49, 50, 'grass'); setPassable(s.map, 49, 50, true);
      setBiome(s.map, 50, 51, 'grass'); setPassable(s.map, 50, 51, true);
      setBiome(s.map, 50, 49, 'grass'); setPassable(s.map, 50, 49, true);
      return s;
    };
    const a = build(), b = build();
    const rngA = new Rng(1234), rngB = new Rng(1234);
    for (let i = 0; i < 30; i++) { runRegrowth(a, rngA); runRegrowth(b, rngB); }
    const countNodes = (s: ReturnType<typeof build>) => [...s.map.nodes.values()].length;
    expect(countNodes(a)).toBe(countNodes(b));
  });
  it('does not spawn a sapling onto a building or a field tile', () => {
    const s = createColony(10);
    setNode(s.map, 60, 60, { kind: 'wood', amount: 20, max: 20 });
    // surround the only neighbour candidates so none are eligible
    setBiome(s.map, 61, 60, 'grass'); setPassable(s.map, 61, 60, true);
    s.fields.set(idx(61, 60, s.map.w), { crop: 'wheat', stage: 'till', progress: 0 });
    setBiome(s.map, 59, 60, 'forest'); // not grass
    setBiome(s.map, 60, 61, 'rock');   // not grass
    setBiome(s.map, 60, 59, 'water');  // not grass
    const rng = new Rng(5);
    for (let i = 0; i < 200; i++) runRegrowth(s, rng); // force-exhaust the 2% daily roll
    expect(nodeAt(s.map, 61, 60)).toBeUndefined();
  });
  it('berries regrow after BERRY_REGROW_DAYS on a still-wild tile, not before', () => {
    const s = createColony(11);
    s.regrowCooldowns.set(idx(70, 70, s.map.w), 4);
    const rng = new Rng(2);
    for (let i = 0; i < 3; i++) runRegrowth(s, rng);
    expect(nodeAt(s.map, 70, 70)).toBeUndefined();
    runRegrowth(s, rng);
    expect(nodeAt(s.map, 70, 70)).toEqual({ kind: 'berries', amount: 5, max: 5 });
    expect(s.regrowCooldowns.has(idx(70, 70, s.map.w))).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/colony.regrowth.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Create `src/games/colony/systems/regrowth.ts`:
```typescript
import type { ColonyState } from '../domain/types';
import type { Rng } from '@/core/utils/rng';
import { REGROW_CHANCE_WOOD, WOOD_SAPLING_AMOUNT, BERRY_AMOUNT } from '../data/balance';
import { idx, nodeAt, setNode, biomeAt, buildingIdAt, neighbors4 } from './grid';

/** Раз в игровой день: живой wood-узел может засеять саженец на дикий соседний
 *  grass-тайл; истощённые ягодники, чей кулдаун вышел, восстанавливаются.
 *  Единственный источник случайности — переданный seeded Rng; порядок обхода
 *  Map/соседей фиксирован (детерминизм). */
export function runRegrowth(s: ColonyState, rng: Rng): void {
  for (const [i, node] of s.map.nodes) {
    if (node.kind !== 'wood' || node.amount <= 0) continue;
    if (!rng.chance(REGROW_CHANCE_WOOD)) continue;
    const x = i % s.map.w, y = Math.floor(i / s.map.w);
    for (const n of neighbors4(x, y, s.map)) {
      const ni = idx(n.x, n.y, s.map.w);
      if (biomeAt(s.map, n.x, n.y) !== 'grass') continue;
      if (buildingIdAt(s.map, n.x, n.y)) continue;
      if (s.fields.has(ni)) continue;
      if (nodeAt(s.map, n.x, n.y)) continue;
      setNode(s.map, n.x, n.y, { kind: 'wood', amount: WOOD_SAPLING_AMOUNT, max: WOOD_SAPLING_AMOUNT });
      break; // один саженец за узел за день
    }
  }
  for (const [i, daysLeft] of [...s.regrowCooldowns]) {
    const left = daysLeft - 1;
    if (left > 0) { s.regrowCooldowns.set(i, left); continue; }
    s.regrowCooldowns.delete(i);
    const x = i % s.map.w, y = Math.floor(i / s.map.w);
    if (buildingIdAt(s.map, x, y) || s.fields.has(i) || nodeAt(s.map, x, y)) continue;
    setNode(s.map, x, y, { kind: 'berries', amount: BERRY_AMOUNT, max: BERRY_AMOUNT });
  }
}
```

In `src/games/colony/systems/tick.ts`:
- Import: `import { runRegrowth } from './regrowth';`
- In `onNewDay`, call it using the same `rng` instance already used for `advanceSeason` (single RNG lifecycle per day, saved back once):
```typescript
function onNewDay(s: ColonyState): void {
  const prevSeason = s.env.season;
  const rng = new Rng(s.rngState);
  advanceSeason(s, rng);
  if (prevSeason !== 'winter' && s.env.season === 'winter') killUnripeCrops(s);
  runRegrowth(s, rng);
  s.rngState = rng.seed;
  applyFoodSpoilage(s);
  ...
```

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run tests/colony.regrowth.test.ts tests/colony.tick.test.ts && npx tsc --noEmit`
Expected: PASS, tsc 0.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(colony): wood sapling + berry regrowth system

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Remove the old farm building (flip the switch)

**Files:**
- Modify: `src/games/colony/domain/types.ts` (BuildingType −farm)
- Modify: `src/games/colony/data/balance.ts` (BUILD_COST/BUILD_REQUIRED/BUILDING_WORK_SLOTS/BUILDING_JOB −farm)
- Modify: `src/games/colony/data/buildings.ts` (BUILDABLE/BUILDING_LABEL −farm)
- Modify: `src/games/colony/systems/projection.ts` (buildingCounts −farm)
- Modify: `src/games/colony/systems/jobScheduler.ts` (job==='farm' — drop the building fallback)
- Modify: `src/games/colony/systems/work.ts` (drop the `building.jobType === 'farm'` branch)
- Modify: `src/games/colony/scenes/render/SpriteLayer.ts` (BUILDING_COLOR −farm, dead entry cleanup)
- Modify: `tests/colony.build.test.ts`, `tests/colony.jobs.test.ts` (fallout)
- Test: none new — this task is a removal + adaptation of existing tests.

**Interfaces:**
- Consumes: everything above (Tasks 1–5 already give the field system full parity with the old farm building).
- Produces: `BuildingType` no longer includes `'farm'`; farm buildings can no longer be placed or staffed.

- [ ] **Step 1: Remove `BuildingType.farm` and its data records**

In `src/games/colony/domain/types.ts`:
```typescript
export type BuildingType = 'bedroom' | 'storage' | 'lab' | 'wall' | 'door' | 'heater' | 'tailor' | 'bridge' | 'tunnel';
```

In `src/games/colony/data/balance.ts`, remove the `farm` entry from all four records:
```typescript
export const BUILD_COST: Record<BuildingType, Partial<Record<ResourceId, number>>> = {
  bedroom: { wood: 25 }, storage: { wood: 15 }, lab: { wood: 35 },
  wall: { wood: 5 }, door: { wood: 8 }, heater: { wood: 30 }, tailor: { wood: 25 },
  bridge: { wood: 8 }, tunnel: { wood: 5, stone: 5 },
};

export const BUILD_REQUIRED: Record<BuildingType, number> = {
  bedroom: 35, storage: 25, lab: 45, wall: 8, door: 10, heater: 25, tailor: 30,
  bridge: 15, tunnel: 25,
};

export const BUILDING_WORK_SLOTS: Record<BuildingType, number> = {
  bedroom: 0, storage: 0, lab: 2, wall: 0, door: 0, heater: 0, tailor: 2,
  bridge: 0, tunnel: 0,
};

export const BUILDING_JOB: Record<BuildingType, JobType | undefined> = {
  lab: 'research', bedroom: undefined, storage: undefined,
  wall: undefined, door: undefined, heater: undefined, tailor: 'tailor',
  bridge: undefined, tunnel: undefined,
};
```

In `src/games/colony/data/buildings.ts`:
```typescript
export const BUILDABLE: BuildingType[] = ['bedroom', 'storage', 'lab', 'wall', 'door', 'heater', 'tailor', 'bridge', 'tunnel'];

export const BUILDING_LABEL: Record<BuildingType, string> = {
  bedroom: 'Спальня', storage: 'Склад', lab: 'Лаборатория',
  wall: 'Стена', door: 'Дверь', heater: 'Обогреватель', tailor: 'Верстак',
  bridge: 'Мост', tunnel: 'Туннель',
};
```

In `src/games/colony/systems/projection.ts`:
```typescript
  const buildingCounts: Record<BuildingType, number> = { bedroom: 0, storage: 0, lab: 0, wall: 0, door: 0, heater: 0, tailor: 0, bridge: 0, tunnel: 0 };
```

In `src/games/colony/ui/panels/BuildMenu.tsx`, remove the `farm` entry from `GLYPH`:
```typescript
const GLYPH: Record<BuildingType, string> = {
  bedroom: '🛏️', storage: '📦', lab: '🔬',
  wall: '🧱', door: '🚪', heater: '🔥', tailor: '🪡', bridge: '🌉', tunnel: '⛏️',
};
```

In `src/games/colony/scenes/render/SpriteLayer.ts`, remove the dead `farm` key from `BUILDING_COLOR`:
```typescript
const BUILDING_COLOR: Record<string, number> = {
  bedroom: 0xf0a840, storage: 0xc8b88a, lab: 0x4ad0ff,
  wall: 0x6b6b63, door: 0xa6895b, heater: 0xff6a3d, tailor: 0xb98bd9,
  bridge: 0x9c7a4d, tunnel: 0x5a5550,
};
```

In `src/games/colony/systems/jobScheduler.ts`, simplify the `job === 'farm'` branch (drop the building fallback added in Task 3):
```typescript
  if (job === 'farm') {
    const t = nearest(ix, s.map.w, s.map.h, from, 'field:work');
    return t ? { tile: t } : null;
  }
```

In `src/games/colony/systems/work.ts`, remove the `if (building.jobType === 'farm') { ... } else if (building.jobType === 'research')` branch's farm case, leaving research/tailor:
```typescript
    if (building && building.built) {
      if (building.jobType === 'research') {
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
      continue;
    }
```
(`FARM_BASE`/`fertilityAt` imports in `work.ts` are now only used by nothing else in this file if the field-cycle code in Task 4 doesn't reference `FARM_BASE` — remove the now-unused `FARM_BASE` from the `../data/balance` import list; keep `fertilityAt`, it's still used by the harvest branch from Task 4.)

- [ ] **Step 2: Fix fallout in `tests/colony.build.test.ts`**

Replace all three uses of `'farm'` as a generic buildable-type placeholder with `'bedroom'`:
```typescript
  it('places a bedroom blueprint on valid grass and spends wood', () => {
    const s = createColony(1);
    const t = startTile(s);
    const wood0 = s.resources.wood.amount;
    const res = placeBlueprint(s, 'bedroom', t.x, t.y);
    expect(res.ok).toBe(true);
    expect(s.resources.wood.amount).toBeLessThan(wood0);
    const b = s.buildings[s.buildings.length - 1];
    expect(b.type).toBe('bedroom');
    expect(b.built).toBe(false);
  });
```
```typescript
  it('rejects placement on an occupied tile', () => {
    const s = createColony(1);
    const t = startTile(s);
    placeBlueprint(s, 'bedroom', t.x, t.y);
    expect(canPlace(s, t.x, t.y)).toBe(false);
  });
```
(The other two tests — biome rejection and insufficient-wood — don't reference `'farm'` and stay as-is.)

- [ ] **Step 3: Fix fallout in `tests/colony.jobs.test.ts`**

Delete the `farmAt` helper and its two tests (`'assigns an idle colonist to an available farm'`, `'never assigns more workers than the building has slots'`) — coverage for field-tile targeting already exists in `tests/colony.fieldCycle.test.ts` (Task 3). The file becomes:
```typescript
import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { runJobScheduler } from '@/games/colony/systems/jobScheduler';
import { setNode, passableAt, neighbors4, idx } from '@/games/colony/systems/grid';
import { pickStartSite } from '@/games/colony/domain/worldgen';

function nearbyPassable(s: ReturnType<typeof createColony>, dx: number, dy: number): { x: number; y: number } {
  const start = pickStartSite(s.map);
  for (let r = 1; r <= 10; r++) {
    const x = start.x + dx * r, y = start.y + dy * r;
    if (passableAt(s.map, x, y)) return { x, y };
  }
  for (const n of neighbors4(start.x, start.y, s.map)) {
    if (passableAt(s.map, n.x, n.y)) return { x: n.x, y: n.y };
  }
  return start;
}

describe('job scheduler', () => {
  it('skips colonists whose only job priority is 0', () => {
    const s = createColony(1);
    s.colonists.forEach((c) => {
      c.task = 'idle';
      c.priorities.farm = 0; c.priorities.woodcut = 0; c.priorities.research = 0; c.priorities.build = 0;
    });
    runJobScheduler(s);
    expect(s.colonists.every((c) => c.task === 'idle')).toBe(true);
  });

  it('assigns a colonist to a tailor bench', () => {
    const s = createColony(1);
    const t = nearbyPassable(s, 1, 0);
    s.buildings.push({ id: 't1', type: 'tailor', tile: { x: t.x, y: t.y }, workSlots: 2, jobType: 'tailor', built: true, buildProgress: 30, buildRequired: 30 });
    s.colonists.forEach((c) => { c.task = 'idle'; (['farm','woodcut','research','build','tailor'] as const).forEach((j) => (c.priorities[j] = 0)); c.priorities.tailor = 3; });
    runJobScheduler(s);
    expect(s.colonists.some((c) => c.targetBuildingId === 't1' && c.task === 'goto_work')).toBe(true);
  });

  it('assigns a woodcutter to a wood node placed via setNode', () => {
    const s = createColony(1);
    const c0 = s.colonists[0];
    const tx = Math.round(c0.pos.x);
    const ty = Math.round(c0.pos.y);
    setNode(s.map, tx, ty, { kind: 'wood', amount: 30, max: 30 });
    s.designations.add(idx(tx, ty, s.map.w));
    s.colonists.forEach((c) => {
      c.task = 'idle';
      (['farm', 'research', 'build', 'tailor'] as const).forEach((j) => (c.priorities[j] = 0));
      c.priorities.woodcut = 3;
    });
    runJobScheduler(s);
    expect(s.colonists.some((c) => c.task === 'goto_work' && c.targetTile?.x === tx && c.targetTile?.y === ty)).toBe(true);
  });
});
```

- [ ] **Step 4: Run the full suite + typecheck**

Run: `npx tsc --noEmit && npx vitest run tests/colony.build.test.ts tests/colony.jobs.test.ts tests/colony.fieldCycle.test.ts`
Expected: tsc 0; all three files PASS. (`tests/colony.playtest.test.ts` and `tests/colony.createColony.test.ts`/`tests/colony.migration.test.ts` are EXPECTED to fail at this point — `placeBlueprint(s,'farm',...)` no longer typechecks / `version` is still 7. They're fixed in Tasks 7 and 11. Do not attempt to fix them here.)

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(colony)!: remove the instant-yield farm building — fields replace it

BREAKING: BuildingType.farm is gone; farming now happens exclusively
through field designations (Tasks 1-5).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Save v7→8 — persist fields/regrowCooldowns + mutable fertility overrides

**Files:**
- Modify: `src/games/colony/domain/save.ts` (ColonySave.fields/regrowCooldowns; TileOverride.fertility; diffOverrides; fromSave)
- Modify: `src/games/colony/domain/createColony.ts` (version 7→8)
- Modify: `src/games/colony/ColonyGameModule.ts` (COLONY_PAYLOAD_VERSION 8)
- Modify: `tests/colony.createColony.test.ts`, `tests/colony.migration.test.ts` (version assertions 7→8)
- Test: `tests/colony.save.roundtrip.test.ts` (extend)

**Interfaces:**
- Produces: `ColonySave.fields: Array<[number, FieldPlot]>`; `ColonySave.regrowCooldowns: Array<[number, number]>`; `TileOverride.fertility?: number`; round-trip preserves fields, regrow cooldowns, and any fertility mutated away from its worldgen default.

- [ ] **Step 1: Write the failing test**

First, extend the file's existing grid import line to add `fertilityAt, setFertility`:
```typescript
import { nodeAt, biomeAt, setNode, setBiome, passableAt, buildingIdAt, forEachTile, setPassable, idx, fertilityAt, setFertility } from '@/games/colony/systems/grid';
```

Then append to `tests/colony.save.roundtrip.test.ts`:
```typescript
describe('save: fields + regrowth + mutable fertility', () => {
  it('round-trips fields, regrowCooldowns, and a fertility mutation', () => {
    const s = createColony(101);
    s.fields.set(idx(15, 15, s.map.w), { crop: 'wheat', stage: 'grow', progress: 40 });
    s.regrowCooldowns.set(idx(16, 16, s.map.w), 2);
    const before = fertilityAt(s.map, 20, 20);
    setFertility(s.map, 20, 20, Math.min(1, before + 0.3));
    const r = fromSave(toSave(s));
    expect(r.fields.get(idx(15, 15, r.map.w))).toEqual({ crop: 'wheat', stage: 'grow', progress: 40 });
    expect(r.regrowCooldowns.get(idx(16, 16, r.map.w))).toBe(2);
    expect(fertilityAt(r.map, 20, 20)).toBeCloseTo(Math.min(1, before + 0.3), 5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/colony.save.roundtrip.test.ts`
Expected: FAIL (`fields`/`regrowCooldowns` not persisted; fertility mutation lost on reload).

- [ ] **Step 3: Implement**

In `src/games/colony/domain/save.ts`:
- Extend imports: add `FieldPlot` to the type import; add `fertilityAt, setFertility` to the `../systems/grid` import.
```typescript
import type { Biome, Building, Colonist, ColonyState, FieldPlot, LogEntry, Resource, ResourceId, ResourceNode, Room } from './types';
import { idx, setBuildingId, setPassable, setBiome, setNode, biomeAt, nodeAt, forEachTile, fertilityAt, setFertility } from '../systems/grid';
```
- Extend `TileOverride`:
```typescript
export interface TileOverride { i: number; biome?: Biome; node?: ResourceNode | null; fertility?: number; }
```
- Add to `ColonySave` (after `designations: number[];`):
```typescript
  fields: Array<[number, FieldPlot]>;
  regrowCooldowns: Array<[number, number]>;
```
- Extend `diffOverrides` to also diff fertility:
```typescript
function diffOverrides(s: ColonyState): TileOverride[] {
  const fresh = regenerateWorld(s.seed);
  const out: TileOverride[] = [];
  forEachTile(s.map, (i, x, y) => {
    const cb = biomeAt(s.map, x, y), gb = biomeAt(fresh, x, y);
    const cn = nodeAt(s.map, x, y), gn = nodeAt(fresh, x, y);
    const cf = fertilityAt(s.map, x, y), gf = fertilityAt(fresh, x, y);
    const biomeChanged = cb !== gb;
    const nodeChanged = (cn?.kind !== gn?.kind) || (cn?.amount !== gn?.amount) || (cn?.max !== gn?.max);
    const fertilityChanged = Math.abs(cf - gf) > 1e-6;
    if (biomeChanged || nodeChanged || fertilityChanged) {
      out.push({
        i,
        ...(biomeChanged ? { biome: cb } : {}),
        ...(nodeChanged ? { node: cn ? { ...cn } : null } : {}),
        ...(fertilityChanged ? { fertility: cf } : {}),
      });
    }
  });
  return out;
}
```
- In `toSave`, add (after `designations: [...s.designations],`):
```typescript
    fields: [...s.fields],
    regrowCooldowns: [...s.regrowCooldowns],
```
- In `fromSave`, apply fertility overrides in the existing override loop:
```typescript
  for (const o of p.overrides) {
    const x = o.i % map.w, y = Math.floor(o.i / map.w);
    if (o.biome !== undefined) setBiome(map, x, y, o.biome);
    if (o.node !== undefined) setNode(map, x, y, o.node === null ? undefined : { ...o.node });
    if (o.fertility !== undefined) setFertility(map, x, y, o.fertility);
  }
```
- In `fromSave`'s returned object, replace the Task-1 stubs:
```typescript
    fields: new Map(p.fields ?? []),
    regrowCooldowns: new Map(p.regrowCooldowns ?? []),
```

In `src/games/colony/domain/createColony.ts`, change `version: 7,` to `version: 8,`.

In `src/games/colony/ColonyGameModule.ts`, change `const COLONY_PAYLOAD_VERSION = 7;` to `const COLONY_PAYLOAD_VERSION = 8;`.

In `tests/colony.createColony.test.ts`, change `expect(createColony(1).version).toBe(7);` to `expect(createColony(1).version).toBe(8);`.

In `tests/colony.migration.test.ts`, change `expect(s.version).toBe(7);` to `expect(s.version).toBe(8);`.

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run tests/colony.save.roundtrip.test.ts tests/colony.createColony.test.ts tests/colony.migration.test.ts && npx tsc --noEmit`
Expected: PASS, tsc 0.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(colony): persist fields/regrowCooldowns; mutable fertility overrides; save v8

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Render — `FieldLayer` overlay

**Files:**
- Create: `src/games/colony/scenes/render/FieldLayer.ts`
- Modify: `src/games/colony/scenes/WorldScene.ts` (instantiate + update + destroy)
- Test: `tests/colony.fieldLayer.test.ts` (create — pure color helper only)

**Interfaces:**
- Produces: `fieldColor(plot: FieldPlot, growthTicks: number): number` (pure, exported); `class FieldLayer { constructor(scene, state); update(): void; destroy(): void }`.

**Note:** Phaser layers are tsc+build-gated (no headless render test), matching the Foundation/1A convention. Only the pure color helper is unit-tested.

- [ ] **Step 1: Write the failing test**

Create `tests/colony.fieldLayer.test.ts`:
```typescript
import { describe, expect, it } from 'vitest';
import { fieldColor } from '@/games/colony/scenes/render/FieldLayer';

describe('field overlay color', () => {
  it('maps stage to a color; grow interpolates by progress fraction', () => {
    expect(fieldColor({ crop: 'wheat', stage: 'till', progress: 0 }, 720)).toBe(0x6b4a2f);
    expect(fieldColor({ crop: 'wheat', stage: 'plant', progress: 0 }, 720)).toBe(0x7a5a3a);
    expect(fieldColor({ crop: 'wheat', stage: 'ready', progress: 0 }, 720)).toBe(0xe8c23a);
    expect(fieldColor({ crop: 'wheat', stage: 'grow', progress: 0 }, 720)).toBe(0x5a6b2f);
    expect(fieldColor({ crop: 'wheat', stage: 'grow', progress: 720 }, 720)).toBe(0x84de5a);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/colony.fieldLayer.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Create `src/games/colony/scenes/render/FieldLayer.ts`:
```typescript
import Phaser from 'phaser';
import type { ColonyState, FieldPlot } from '../../domain/types';
import { TILE } from '../../data/balance';
import { CROP_GROWTH_TICKS } from '../../data/balance';
import { visibleTileRange } from '../cameraMath';

/** Цвет тайла поля по стадии; 'grow' линейно интерполирует бурый->зелёный по прогрессу. */
export function fieldColor(plot: FieldPlot, growthTicks: number): number {
  if (plot.stage === 'till') return 0x6b4a2f;
  if (plot.stage === 'plant') return 0x7a5a3a;
  if (plot.stage === 'ready') return 0xe8c23a;
  const frac = growthTicks > 0 ? Math.min(1, plot.progress / growthTicks) : 0;
  const from = { r: 0x5a, g: 0x6b, b: 0x2f };
  const to = { r: 0x84, g: 0xde, b: 0x5a };
  const r = Math.round(from.r + (to.r - from.r) * frac);
  const g = Math.round(from.g + (to.g - from.g) * frac);
  const b = Math.round(from.b + (to.b - from.b) * frac);
  return (r << 16) | (g << 8) | b;
}

/** Полупрозрачный оверлей тайлов полей; куллинг по вьюпорту. */
export class FieldLayer {
  private gfx: Phaser.GameObjects.Graphics;

  constructor(private scene: Phaser.Scene, private state: ColonyState) {
    this.gfx = scene.add.graphics().setDepth(-449); // above DesignationLayer (-450), below sprites
  }

  update(): void {
    this.gfx.clear();
    if (this.state.fields.size === 0) return;
    const cam = this.scene.cameras.main;
    const r = visibleTileRange(
      cam.scrollX, cam.scrollY, cam.zoom, cam.width, cam.height,
      TILE, this.state.map.w, this.state.map.h,
    );
    for (let y = r.y0; y <= r.y1; y++) {
      for (let x = r.x0; x <= r.x1; x++) {
        const i = y * this.state.map.w + x;
        const plot = this.state.fields.get(i);
        if (!plot) continue;
        this.gfx.fillStyle(fieldColor(plot, CROP_GROWTH_TICKS[plot.crop]), 0.45);
        this.gfx.fillRect(x * TILE, y * TILE, TILE - 1, TILE - 1);
      }
    }
  }

  destroy(): void {
    this.gfx.destroy();
  }
}
```

In `src/games/colony/scenes/WorldScene.ts`:
- Import: `import { FieldLayer } from './render/FieldLayer';`
- Field (near `private designations!: DesignationLayer;`): `private fieldLayer!: FieldLayer;`
- In `create()`, after `this.designations = new DesignationLayer(this, this.state);`: `this.fieldLayer = new FieldLayer(this, this.state);`
- In `update()`, after `this.designations.update();`: `this.fieldLayer.update();`
- In the `restart` case of `onCommand` and in `shutdown()`, after `this.designations?.destroy();`: `this.fieldLayer?.destroy();`

- [ ] **Step 4: Run test + typecheck + build**

Run: `npx vitest run tests/colony.fieldLayer.test.ts && npx tsc --noEmit && npm run build`
Expected: PASS, tsc 0, build exit 0.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(colony): field overlay render layer

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: WorldScene input — field tool + drag-rectangle

**Files:**
- Modify: `src/games/colony/scenes/WorldScene.ts`
- (No new unit test — pure `designateField` already covered in Task 2; verify via tsc + build.)

**Interfaces:**
- Consumes: `designateField(state, rect, tool)` (Task 2), `computeHud` (existing), the existing `selecting`/`selStartTile`/`selRect` drag machinery (1A).
- Produces: `ui:command` type `setFieldTool` with `payload.tool: CropId | 'clear' | null`; an active field tool makes pointer-drag paint a field designation instead of panning; mutually exclusive with the 1A zone tool (`setTool`/`setFieldTool` each clear the other).

- [ ] **Step 1: Implement the tool state + command**

In `src/games/colony/scenes/WorldScene.ts`:
- Imports: `import { designateField, type FieldTool } from '../systems/fields';`
- Field (near `private tool: DesignationMode | null = null;`): `private fieldTool: FieldTool | null = null;`
- In `onPointerDown`, widen the tool-drag guard to cover both tools:
```typescript
    if (this.tool || this.fieldTool) {
      const t = this.worldToTile(p.x, p.y);
      this.selecting = true;
      this.selStartTile = t;
      this.selRect.setPosition(t.x * TILE, t.y * TILE).setSize(TILE, TILE).setVisible(true);
      return;
    }
```
- In `onPointerMove`, widen the same guard:
```typescript
    if (this.selecting && (this.tool || this.fieldTool)) {
      const t = this.worldToTile(p.x, p.y);
      const x0 = Math.min(this.selStartTile.x, t.x), y0 = Math.min(this.selStartTile.y, t.y);
      const x1 = Math.max(this.selStartTile.x, t.x), y1 = Math.max(this.selStartTile.y, t.y);
      this.selRect.setPosition(x0 * TILE, y0 * TILE).setSize((x1 - x0 + 1) * TILE, (y1 - y0 + 1) * TILE);
      return;
    }
```
- In `onPointerUp`, dispatch to whichever tool is active:
```typescript
    if (this.selecting && (this.tool || this.fieldTool)) {
      this.selecting = false;
      this.selRect.setVisible(false);
      const t = this.worldToTile(p.x, p.y);
      const rect = { x0: this.selStartTile.x, y0: this.selStartTile.y, x1: t.x, y1: t.y };
      if (this.tool) designate(this.state, rect, this.tool);
      else if (this.fieldTool) designateField(this.state, rect, this.fieldTool);
      this.ctx.events.emit('game:state', computeHud(this.state));
      return;
    }
```
- In `onCommand`, add a case and make the two tool-setters mutually exclusive:
```typescript
      case 'setTool': this.tool = (msg.payload?.tool ?? null) as DesignationMode | null; this.fieldTool = null; this.placingType = null; this.ghost.setVisible(false); break;
      case 'setFieldTool': this.fieldTool = (msg.payload?.tool ?? null) as FieldTool | null; this.tool = null; this.placingType = null; this.ghost.setVisible(false); break;
```
(Replace the existing single-line `case 'setTool': ...` with the two lines above.)

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: tsc 0, build exit 0.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(colony): field tool + drag-rectangle input in WorldScene

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: UI — «Поля» toolbar in the HUD

**Files:**
- Modify: `src/games/colony/ui/ColonyHud.tsx`
- (Verify via tsc + build.)

**Interfaces:**
- Consumes: `cmd('setFieldTool', { tool })` (existing `cmd` helper), `setFieldTool` command (Task 9).
- Produces: a toolbar that lets the player pick a crop (or «Убрать») for field designation, independent from the 1A zone toolbar.

- [ ] **Step 1: Implement the toolbar**

In `src/games/colony/ui/ColonyHud.tsx`:
- Add state near the other `useState`s:
```typescript
  const [fieldTool, setFieldToolState] = useState<'wheat' | 'potato' | 'legume' | 'flax' | 'clear' | null>(null);
```
- Add a helper next to `pickTool`:
```typescript
  const pickFieldTool = (t: 'wheat' | 'potato' | 'legume' | 'flax' | 'clear') => {
    const next = fieldTool === t ? null : t;
    setFieldToolState(next);
    cmd('setFieldTool', { tool: next });
  };
```
- Insert a new section right below the «Зоны добычи» block and above «Строительство»:
```tsx
          <div>
            <p className="label-mono mb-2">Поля</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: 'wheat', label: '🌾 Пшеница' },
                { id: 'potato', label: '🥔 Картофель' },
                { id: 'legume', label: '🫘 Бобовые' },
                { id: 'flax', label: '🧵 Лён' },
                { id: 'clear', label: '✕ Убрать' },
              ] as const).map((t) => (
                <button
                  key={t.id}
                  onClick={() => pickFieldTool(t.id)}
                  className={cx(
                    'rounded-xl border p-2 text-center font-display text-[0.7rem] transition-all',
                    fieldTool === t.id ? 'border-accent/60 bg-accent/20 text-accent' : 'border-edge/60 text-ink hover:border-accent/50',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="mt-1 font-mono text-[0.55rem] text-muted">выбери культуру, затем протяни прямоугольник по расчищенной земле</p>
          </div>
```

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: tsc 0, build exit 0.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(colony): field toolbar in HUD

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Playtest rewrite (fields replace farm buildings) + determinism smoke

**Files:**
- Modify: `tests/colony.playtest.test.ts` (farm building → field designation, same invariants)
- Test: `tests/colony.fieldCycle.test.ts` (extend — determinism smoke)

**Interfaces:**
- Consumes: everything above.
- Produces: playtest invariants preserved on the new field economy; a determinism guarantee for a run with fields + regrowth active.

- [ ] **Step 1: Rewrite the playtest scenarios**

Replace `tests/colony.playtest.test.ts` in full:
```typescript
import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { placeBlueprint } from '@/games/colony/systems/build';
import { designateField } from '@/games/colony/systems/fields';
import { tick, alive } from '@/games/colony/systems/tick';
import { TICKS_PER_DAY } from '@/games/colony/data/balance';
import { pickStartSite } from '@/games/colony/domain/worldgen';
import { passableAt, setBiome, setPassable } from '@/games/colony/systems/grid';

/**
 * Headless "playtest": exercises the full field-farming loop end-to-end —
 * designate wheat fields, colonists till/plant/harvest them — and asserts the
 * colony is actually survivable (no path deadlock, no instant starvation
 * spiral) over a full run. Catches gameplay/balance regressions that the
 * per-system unit tests do not.
 */

function nearbySlots(s: ReturnType<typeof createColony>, n: number): Array<{ x: number; y: number }> {
  const start = pickStartSite(s.map);
  const slots: Array<{ x: number; y: number }> = [];
  for (let r = 1; r <= 20 && slots.length < n; r++) {
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]) {
      const x = start.x + dx * r, y = start.y + dy * r;
      if (passableAt(s.map, x, y) && !slots.some(p => p.x === x && p.y === y)) {
        slots.push({ x, y });
        if (slots.length >= n) break;
      }
    }
  }
  return slots;
}

/** Clears a 5x5 patch of grass around `t` and designates it as a wheat field. */
function sowWheatField(s: ReturnType<typeof createColony>, t: { x: number; y: number }): void {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      setBiome(s.map, t.x + dx, t.y + dy, 'grass');
      setPassable(s.map, t.x + dx, t.y + dy, true);
    }
  }
  designateField(s, { x0: t.x - 2, y0: t.y - 2, x1: t.x + 2, y1: t.y + 2 }, 'wheat');
}

describe('colony Phase 0 playtest', () => {
  it('a colony given fields survives the run and produces food', () => {
    const s = createColony(2024);
    const [t1, t2, t3] = nearbySlots(s, 3);
    sowWheatField(s, t1);
    sowWheatField(s, t2);
    expect(placeBlueprint(s, 'storage', t3.x, t3.y).ok).toBe(true);

    s.colonists.forEach((c) => { c.priorities.build = 3; c.priorities.farm = 3; });

    for (let i = 0; i < TICKS_PER_DAY * 11 && !s.flags.gameOver; i++) tick(s);

    expect(alive(s).length).toBeGreaterThan(0);
    const totalXp = s.colonists.reduce((sum, c) => sum + c.skills.farming.level, 0);
    expect(totalXp).toBeGreaterThan(0);
  }, 60000);

  it('without any fields the colony eventually starves (negative control)', () => {
    const s = createColony(2024);
    s.colonists.forEach((c) => {
      c.priorities.farm = 0;
      c.priorities.research = 0;
    });
    for (let i = 0; i < TICKS_PER_DAY * 30 && !s.flags.gameOver; i++) tick(s);
    expect(s.flags.gameOver).toBe(true);
    expect(s.flags.victory).toBe(false);
  }, 60000);

  it('survives into the next season with a heated room and clothing buffer', () => {
    const s = createColony(777);
    const [t1, t2] = nearbySlots(s, 2);
    sowWheatField(s, t1);
    sowWheatField(s, t2);
    s.stock.clothing = 5;
    s.resources.wood.amount = 200;
    s.colonists.forEach((c) => { c.priorities.build = 3; c.priorities.farm = 3; });
    for (let i = 0; i < TICKS_PER_DAY * 8 && !s.flags.gameOver; i++) tick(s);
    expect(alive(s).length).toBeGreaterThan(0);
  }, 60000);
});
```

- [ ] **Step 2: Write the determinism smoke**

Append to `tests/colony.fieldCycle.test.ts`:
```typescript
import { tick } from '@/games/colony/systems/tick';
import { designateField } from '@/games/colony/systems/fields';

describe('field determinism', () => {
  it('a run with all 4 crops designated + active regrowth is deterministic and exception-free', () => {
    const build = (seed: number) => {
      const s = createColony(seed);
      const crops = ['wheat', 'potato', 'legume', 'flax'] as const;
      for (const crop of crops) {
        designateField(s, { x0: 0, y0: 0, x1: s.map.w - 1, y1: s.map.h - 1 }, crop);
      }
      s.colonists.forEach((c) => { c.priorities.farm = 3; });
      return s;
    };
    const a = build(3030), b = build(3030);
    for (let i = 0; i < 300; i++) { tick(a); tick(b); }
    expect(a.resources.food.amount).toBe(b.resources.food.amount);
    expect(a.resources.fiber.amount).toBe(b.resources.fiber.amount);
    expect(a.colonists.map((c) => `${c.pos.x.toFixed(3)},${c.pos.y.toFixed(3)}`))
      .toEqual(b.colonists.map((c) => `${c.pos.x.toFixed(3)},${c.pos.y.toFixed(3)}`));
  }, 30000);
});
```
(Note: designating the whole map with 4 crops in sequence means only the LAST crop, `flax`, actually ends up assigned per tile — `designateField` overwrites. That's fine for this test: it only needs *a* large, deterministic, exception-free field economy running alongside regrowth, not perfect crop diversity coverage.)

- [ ] **Step 3: Run the adapted/new tests**

Run: `npx vitest run tests/colony.playtest.test.ts tests/colony.fieldCycle.test.ts`
Expected: PASS. If the positive playtest scenario does not survive to day 11 with a 5×5 field, enlarge the field (e.g. 7×7) or add a third field — the exact area needed depends on final skill/xp pacing observed once the earlier tasks are actually running; treat this the same as any other TDD red-then-green loop.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "test(colony): playtest on fields instead of farm buildings + field determinism smoke

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Whole-suite verification + final fixes

**Files:**
- Any test that still assumes `BuildingType.farm` or `payloadVersion` 7 (fix in place).

- [ ] **Step 1: Run the full suite + typecheck + build**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: tsc 0; ALL tests pass; build exit 0.

- [ ] **Step 2: Fix any fallout**

Likely candidates if red:
- Any remaining `'farm'` `BuildingType` literal missed by the Task 6 grep sweep — re-run `grep -rn "'farm'" src/games/colony tests` and check each hit is a `JobType` usage (fine, unchanged) rather than a `BuildingType` one.
- `tests/colony.seam.test.ts` — should stay green automatically since `setFertility`/`fertilityAt` are the only fertility access points used anywhere (Tasks 2, 4, 5, 7 all route through them); if red, find the offending raw `.map.fertility[` read and replace it with the accessor.
- `tests/colony.projection.test.ts` — if it asserts an exact `buildingCounts` key set, update it to the post-farm-removal list.
- Fix each in place, keeping changes minimal and faithful to the spec.

- [ ] **Step 3: Re-run to confirm green**

Run: `npx tsc --noEmit && npm test`
Expected: tsc 0; all tests pass.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "test(colony): whole-suite green for Pillar 1B (fields/crops/regrowth)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage** (each §2 "Входит" item → task):
- Поля как зоны-разметка + инструмент + drag-rect: Tasks 2 (логика), 9 (ввод), 10 (тулбар). ✓
- 4 культуры + цикл till/plant/grow/ready/harvest: Tasks 1 (типы), 4 (работа). ✓
- Динамическое плодородие + севооборот: Tasks 2 (setFertility), 4 (мутация при сборе), 7 (персист через TileOverride). ✓
- Расчистка земли (реюз chop 1A): Task 2 (`designateField` отвергает `forest`/узлы). ✓
- Возобновление узлов: Task 5. ✓
- Удаление старой фермы: Task 6. ✓
- Ресурс `fiber`: Task 1. ✓
- Сейв v7→8: Task 7. ✓
- Рендер/HUD: Tasks 8, 9, 10. ✓
- §11 acceptance criteria & §12 test strategy: covered by per-task tests + Tasks 11/12. ✓

**Placeholder scan:** every code step has concrete, complete code; render/UI tasks that can't be headless-tested are explicitly tsc+build-gated (matching Foundation/1A), with the extractable pure helpers (`fieldColor`) unit-tested. Task 11's field-size caveat is a normal TDD "adjust if red" note, not an unresolved design gap — the underlying mechanic and its test are fully specified.

**Type consistency:** `ResourceId`/`CropId`/`FieldStage`/`BuildingType` changes are each paired with every complete-record literal they ripple into (`START_RESOURCES`, `RES_META`, projection `resources`/`buildingCounts`, `BUILD_*` records, `BUILDABLE`/`BUILDING_LABEL`, `GLYPH`, `BUILDING_COLOR`, `CROP_*` tables). Shared signatures used across tasks match: `designateField(s, rect, tool)`, `FieldTool`, `FieldPlot`, `advanceGrowth(s)`, `killUnripeCrops(s)`, `runRegrowth(s, rng)`, `fieldColor(plot, growthTicks)`, `setFertility(m, x, y, v)`, `ColonyState.fields: Map<number, FieldPlot>`, `ColonySave.fields: Array<[number, FieldPlot]>`, payloadVersion 8 in both `createColony` and `ColonyGameModule`.

---

*Execution: subagent-driven per task with review between tasks (recommended), or inline via executing-plans.*
