# Colony Pillar 1A «Добыча и зоны» Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the foundation's inert resource nodes into a player-directed gathering economy: rectangular designations (chop/mine/forage), `mine`/`forage` jobs (+ zone-gated `woodcut`), new resources (stone/clay/iron/gold + berries→food), and bridges/tunnels as buildable passability structures.

**Architecture:** Pure-systems engine (flat serializable `ColonyState` + deterministic seeded systems in a tick pipeline; Phaser host + React HUD). New player intent (`designations`) lives in `ColonyState`. Designation/harvest logic is pure and unit-tested; Phaser render/input layers are tsc+build-gated (no headless render tests), with any extractable helper unit-tested.

**Tech Stack:** TypeScript, Vitest, Phaser 3, React 18, Vite. Path alias `@/` → `src/`.

## Global Constraints

- **Determinism:** the only randomness source is the seeded `Rng` with serialized `rngState`. All system loops use fixed iteration order. `Set`/`Map` iteration is insertion-order — preserve it. One seed + identical commands → identical run.
- **SoA seam:** never read/write raw `map.biome[...]`/`map.passable[...]`/`map.tiles` outside `systems/grid.ts`. Use grid accessors. A seam-guard test (`tests/colony.seam.test.ts`) enforces this.
- **Save compatibility:** bump `payloadVersion` (6→7) in BOTH `domain/createColony.ts` (`version`) and `ColonyGameModule.ts` (`COLONY_PAYLOAD_VERSION`). Old saves are rejected on mount (mechanism exists). The SoA grid is NOT serialized — it regenerates from seed; only sparse overrides + player state persist.
- **Quality gate per task:** `npx tsc --noEmit` exits 0 AND the named tests pass before commit. Type expansions (`ResourceId`/`JobType`/`SkillId`/`BuildingType`) ripple into complete-record literals — fix every record in the same task so tsc stays green.
- **UI copy:** Russian, matching existing labels.
- **Commit style:** end commit messages with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Work happens on branch `worktree-feat+colony-pillar1a-gathering`.

---

### Task 1: New resources scaffold (stone/clay/iron/gold) + storage capacity

**Files:**
- Modify: `src/games/colony/domain/types.ts` (ResourceId)
- Modify: `src/games/colony/data/balance.ts` (START_RESOURCES)
- Modify: `src/games/colony/domain/createColony.ts` (resources init)
- Modify: `src/games/colony/systems/work.ts` (addResource type, applyStorageCapacity loop)
- Modify: `src/games/colony/systems/projection.ts` (resources literal)
- Modify: `src/games/colony/ui/ColonyHud.tsx` (RES_META)
- Test: `tests/colony.resources.test.ts` (create)

**Interfaces:**
- Produces: `ResourceId = 'food' | 'wood' | 'science' | 'stone' | 'clay' | 'iron' | 'gold'`; `createColony(seed).resources` has all 7 keys; `addResource(s, id, amt)` accepts any `ResourceId`.

- [ ] **Step 1: Write the failing test**

Create `tests/colony.resources.test.ts`:
```typescript
import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { computeHud } from '@/games/colony/systems/projection';

describe('new resources', () => {
  it('createColony seeds stone/clay/iron/gold at 0 with capacity', () => {
    const s = createColony(1);
    for (const id of ['stone', 'clay', 'iron', 'gold'] as const) {
      expect(s.resources[id].amount).toBe(0);
      expect(s.resources[id].capacity).toBeGreaterThan(0);
    }
  });
  it('hud projection includes the new resources', () => {
    const hud = computeHud(createColony(1));
    for (const id of ['stone', 'clay', 'iron', 'gold'] as const) {
      expect(hud.resources[id]).toBeDefined();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/colony.resources.test.ts`
Expected: FAIL (resources.stone undefined / type errors).

- [ ] **Step 3: Implement**

In `src/games/colony/domain/types.ts` change:
```typescript
export type ResourceId = 'food' | 'wood' | 'science' | 'stone' | 'clay' | 'iron' | 'gold';
```

In `src/games/colony/data/balance.ts`, extend `START_RESOURCES`:
```typescript
export const START_RESOURCES: Record<ResourceId, Resource_> = {
  food: { amount: 120, capacity: 200 },
  wood: { amount: 60, capacity: 200 },
  science: { amount: 0, capacity: 200 },
  stone: { amount: 0, capacity: 200 },
  clay: { amount: 0, capacity: 200 },
  iron: { amount: 0, capacity: 200 },
  gold: { amount: 0, capacity: 200 },
};
```

In `src/games/colony/domain/createColony.ts`, replace the `resources:` block:
```typescript
    resources: {
      food: { ...START_RESOURCES.food },
      wood: { ...START_RESOURCES.wood },
      science: { ...START_RESOURCES.science },
      stone: { ...START_RESOURCES.stone },
      clay: { ...START_RESOURCES.clay },
      iron: { ...START_RESOURCES.iron },
      gold: { ...START_RESOURCES.gold },
    },
```

In `src/games/colony/systems/work.ts`:
- Change `addResource` signature to all resources:
```typescript
const addResource = (s: ColonyState, id: import('../domain/types').ResourceId, amt: number) => {
  const r = s.resources[id];
  r.amount = clamp(r.amount + amt, 0, r.capacity);
};
```
- Replace `applyStorageCapacity`'s id list with all resources:
```typescript
function applyStorageCapacity(s: ColonyState): void {
  const built = s.buildings.filter((b) => b.type === 'storage' && b.built).length;
  const cap = 200 + built * STORAGE_CAPACITY_BONUS;
  for (const id of ['food', 'wood', 'science', 'stone', 'clay', 'iron', 'gold'] as const) s.resources[id].capacity = cap;
}
```

In `src/games/colony/systems/projection.ts`, replace the `resources:` literal:
```typescript
    resources: {
      food: { ...s.resources.food },
      wood: { ...s.resources.wood },
      science: { ...s.resources.science },
      stone: { ...s.resources.stone },
      clay: { ...s.resources.clay },
      iron: { ...s.resources.iron },
      gold: { ...s.resources.gold },
    },
```

In `src/games/colony/ui/ColonyHud.tsx`, extend `RES_META`:
```typescript
const RES_META: Record<ResourceId, { label: string; glyph: string; tone: 'good' | 'warn' | 'accent' }> = {
  food: { label: 'Еда', glyph: '🌾', tone: 'good' },
  wood: { label: 'Дерево', glyph: '🪵', tone: 'warn' },
  science: { label: 'Наука', glyph: '🔬', tone: 'accent' },
  stone: { label: 'Камень', glyph: '🪨', tone: 'warn' },
  clay: { label: 'Глина', glyph: '🧱', tone: 'warn' },
  iron: { label: 'Железо', glyph: '⛓️', tone: 'accent' },
  gold: { label: 'Золото', glyph: '🪙', tone: 'accent' },
};
```

- [ ] **Step 4: Run test + typecheck**

Run: `npx vitest run tests/colony.resources.test.ts && npx tsc --noEmit`
Expected: PASS, tsc exit 0.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(colony): stone/clay/iron/gold resources + storage capacity

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Mining skill + mine/forage job types scaffold

**Files:**
- Modify: `src/games/colony/domain/types.ts` (SkillId, JobType)
- Modify: `src/games/colony/domain/skills.ts` (SKILL_IDS, SKILL_NAMES)
- Modify: `src/games/colony/domain/createColony.ts` (JOB_TYPES)
- Modify: `src/games/colony/ui/panels/Inspector.tsx` (JOBS list)
- Test: `tests/colony.resources.test.ts` (extend) — or new assertions

**Interfaces:**
- Produces: `SkillId += 'mining'`; `JobType = 'farm' | 'woodcut' | 'mine' | 'forage' | 'research' | 'build' | 'tailor'`; `createColony` colonists have `priorities.mine` and `priorities.forage`; `emptySkills().mining` exists.

- [ ] **Step 1: Write the failing test**

Append to `tests/colony.resources.test.ts`:
```typescript
import { emptySkills } from '@/games/colony/domain/skills';

describe('mining skill + harvest jobs', () => {
  it('colonists have mine/forage priorities and a mining skill', () => {
    const s = createColony(1);
    const c = s.colonists[0];
    expect(c.priorities.mine).toBeGreaterThanOrEqual(0);
    expect(c.priorities.forage).toBeGreaterThanOrEqual(0);
    expect(emptySkills().mining).toEqual({ level: 0, xp: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/colony.resources.test.ts`
Expected: FAIL (priorities.mine undefined / mining missing).

- [ ] **Step 3: Implement**

In `src/games/colony/domain/types.ts`:
```typescript
export type SkillId =
  | 'farming' | 'woodcutting' | 'mining' | 'building' | 'research'
  | 'cooking' | 'medicine' | 'shooting' | 'melee';
export type JobType = 'farm' | 'woodcut' | 'mine' | 'forage' | 'research' | 'build' | 'tailor';
```

In `src/games/colony/domain/skills.ts`:
```typescript
export const SKILL_IDS: SkillId[] = [
  'farming', 'woodcutting', 'mining', 'building', 'research', 'cooking', 'medicine', 'shooting', 'melee',
];
export const SKILL_NAMES: Record<SkillId, string> = {
  farming: 'Земледелие', woodcutting: 'Лесорубство', mining: 'Добыча', building: 'Строительство',
  research: 'Исследования', cooking: 'Готовка', medicine: 'Медицина',
  shooting: 'Стрельба', melee: 'Ближний бой',
};
```

In `src/games/colony/domain/createColony.ts` change the JOB_TYPES line:
```typescript
const JOB_TYPES: JobType[] = ['farm', 'woodcut', 'mine', 'forage', 'research', 'build', 'tailor'];
```

In `src/games/colony/ui/panels/Inspector.tsx`, extend the `JOBS` array:
```typescript
const JOBS: { id: JobType; label: string }[] = [
  { id: 'build', label: 'Стройка' },
  { id: 'farm', label: 'Ферма' },
  { id: 'forage', label: 'Сбор' },
  { id: 'woodcut', label: 'Рубка' },
  { id: 'mine', label: 'Добыча' },
  { id: 'research', label: 'Наука' },
  { id: 'tailor', label: 'Пошив' },
];
```

- [ ] **Step 4: Run test + typecheck**

Run: `npx vitest run tests/colony.resources.test.ts && npx tsc --noEmit`
Expected: PASS, tsc 0.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(colony): mining skill + mine/forage job types

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Designations module (pure) + state field

**Files:**
- Modify: `src/games/colony/domain/types.ts` (ColonyState.designations)
- Modify: `src/games/colony/domain/createColony.ts` (init designations)
- Create: `src/games/colony/systems/designations.ts`
- Test: `tests/colony.designations.test.ts` (create)

**Interfaces:**
- Produces:
  - `DesignationMode = 'chop' | 'mine' | 'forage' | 'cancel'`
  - `MODE_KINDS: Record<'chop' | 'mine' | 'forage', NodeKind[]>` = `{ chop: ['wood'], mine: ['stone','clay','iron','gold'], forage: ['berries'] }`
  - `interface Rect { x0: number; y0: number; x1: number; y1: number }`
  - `designate(s: ColonyState, rect: Rect, mode: DesignationMode): void`
  - `ColonyState.designations: Set<number>` (tile indices `y*w+x`)

- [ ] **Step 1: Write the failing test**

Create `tests/colony.designations.test.ts`:
```typescript
import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { designate } from '@/games/colony/systems/designations';
import { setNode, idx } from '@/games/colony/systems/grid';

describe('designations', () => {
  it('chop marks only wood nodes inside the rect', () => {
    const s = createColony(1);
    setNode(s.map, 10, 10, { kind: 'wood', amount: 5, max: 5 });
    setNode(s.map, 11, 10, { kind: 'stone', amount: 5, max: 5 });
    setNode(s.map, 30, 30, { kind: 'wood', amount: 5, max: 5 }); // outside
    designate(s, { x0: 9, y0: 9, x1: 12, y1: 12 }, 'chop');
    expect(s.designations.has(idx(10, 10, s.map.w))).toBe(true);
    expect(s.designations.has(idx(11, 10, s.map.w))).toBe(false); // stone, not chop
    expect(s.designations.has(idx(30, 30, s.map.w))).toBe(false); // outside rect
  });
  it('mine marks any ore kind; forage marks berries', () => {
    const s = createColony(2);
    setNode(s.map, 5, 5, { kind: 'iron', amount: 5, max: 5 });
    setNode(s.map, 6, 5, { kind: 'berries', amount: 5, max: 5 });
    designate(s, { x0: 4, y0: 4, x1: 7, y1: 7 }, 'mine');
    expect(s.designations.has(idx(5, 5, s.map.w))).toBe(true);
    expect(s.designations.has(idx(6, 5, s.map.w))).toBe(false);
    designate(s, { x0: 4, y0: 4, x1: 7, y1: 7 }, 'forage');
    expect(s.designations.has(idx(6, 5, s.map.w))).toBe(true);
  });
  it('cancel clears any designation in the rect', () => {
    const s = createColony(3);
    setNode(s.map, 8, 8, { kind: 'wood', amount: 5, max: 5 });
    designate(s, { x0: 7, y0: 7, x1: 9, y1: 9 }, 'chop');
    expect(s.designations.size).toBe(1);
    designate(s, { x0: 7, y0: 7, x1: 9, y1: 9 }, 'cancel');
    expect(s.designations.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/colony.designations.test.ts`
Expected: FAIL (designate not found / designations undefined).

- [ ] **Step 3: Implement**

In `src/games/colony/domain/types.ts`, add a field to `ColonyState` (after `assignCursor`):
```typescript
  designations: Set<number>; // tile indices marked for harvest (player intent)
```

In `src/games/colony/domain/createColony.ts`, add to the returned state object (next to `assignCursor: 0,`):
```typescript
    designations: new Set<number>(),
```

Create `src/games/colony/systems/designations.ts`:
```typescript
import type { ColonyState, NodeKind } from '../domain/types';
import { idx, nodeAt, inBounds } from './grid';

export type DesignationMode = 'chop' | 'mine' | 'forage' | 'cancel';
export interface Rect { x0: number; y0: number; x1: number; y1: number; }

export const MODE_KINDS: Record<'chop' | 'mine' | 'forage', NodeKind[]> = {
  chop: ['wood'],
  mine: ['stone', 'clay', 'iron', 'gold'],
  forage: ['berries'],
};

/** Marks/clears designations on nodes inside the rect. cancel clears any; others
 *  add tiles whose node kind matches the mode. Fixed iteration order (det). */
export function designate(s: ColonyState, rect: Rect, mode: DesignationMode): void {
  const x0 = Math.min(rect.x0, rect.x1), x1 = Math.max(rect.x0, rect.x1);
  const y0 = Math.min(rect.y0, rect.y1), y1 = Math.max(rect.y0, rect.y1);
  const kinds = mode === 'cancel' ? null : MODE_KINDS[mode];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!inBounds(x, y, s.map)) continue;
      const i = idx(x, y, s.map.w);
      if (mode === 'cancel') { s.designations.delete(i); continue; }
      const node = nodeAt(s.map, x, y);
      if (node && kinds!.includes(node.kind)) s.designations.add(i);
    }
  }
}
```

- [ ] **Step 4: Run test + typecheck**

Run: `npx vitest run tests/colony.designations.test.ts && npx tsc --noEmit`
Expected: PASS, tsc 0.

Note: `tsc` will now flag `tests/colony.save.roundtrip.test.ts` only if it constructs a full `ColonyState` literal — it does not (it uses `createColony`/`toSave`). `fromSave` does not yet set `designations`; that is fixed in Task 9. If tsc flags `fromSave` returning a `ColonyState` missing `designations`, add `designations: new Set<number>(),` to the `fromSave` return now (it will be populated properly in Task 9).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(colony): designations module + ColonyState.designations

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Scheduler — designated-only targets + mine/forage routing

**Files:**
- Modify: `src/games/colony/systems/jobScheduler.ts`
- Modify: `tests/colony.jobs.test.ts` (adapt the woodcutter test — now requires designation)
- Test: `tests/colony.mining.test.ts` (create — scheduler half)

**Interfaces:**
- Consumes: `s.designations` (Task 3), `MODE_KINDS` concept (node kind → job group).
- Produces: scheduler only targets designated nodes; `woodcut`→designated wood, `mine`→designated ore, `forage`→designated berries.

- [ ] **Step 1: Write the failing test**

Create `tests/colony.mining.test.ts`:
```typescript
import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { runJobScheduler } from '@/games/colony/systems/jobScheduler';
import { setNode, idx } from '@/games/colony/systems/grid';

describe('mining scheduler', () => {
  it('mine job targets a designated ore node; ignores undesignated', () => {
    const s = createColony(1);
    const c0 = s.colonists[0];
    const tx = Math.round(c0.pos.x), ty = Math.round(c0.pos.y);
    setNode(s.map, tx, ty, { kind: 'stone', amount: 20, max: 20 });
    // undesignated stone elsewhere on a passable-adjacent tile
    s.colonists.forEach((c) => {
      c.task = 'idle';
      (['farm', 'forage', 'woodcut', 'research', 'build', 'tailor'] as const).forEach((j) => (c.priorities[j] = 0));
      c.priorities.mine = 3;
    });
    // not designated yet → no assignment
    runJobScheduler(s);
    expect(s.colonists.some((c) => c.task === 'goto_work')).toBe(false);
    // designate, then it assigns
    s.designations.add(idx(tx, ty, s.map.w));
    s.colonists.forEach((c) => { c.task = 'idle'; });
    runJobScheduler(s);
    expect(s.colonists.some((c) => c.task === 'goto_work' && c.targetTile?.x === tx && c.targetTile?.y === ty)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/colony.mining.test.ts`
Expected: FAIL (mine job not handled / undesignated node still targeted).

- [ ] **Step 3: Implement**

In `src/games/colony/systems/jobScheduler.ts`:

Add a node→category helper and gate the node index by designations. Replace the node loop inside `buildTargetIndex`:
```typescript
  for (const [i, node] of s.map.nodes) {
    if (node.amount <= 0) continue;
    if (!s.designations.has(i)) continue; // only designated nodes are work targets
    pts.push({ x: i % s.map.w, y: Math.floor(i / s.map.w), cat: nodeCat(node.kind) });
  }
```

Add near the top of the file (after imports):
```typescript
import type { NodeKind } from '../domain/types';

function nodeCat(kind: NodeKind): string {
  if (kind === 'wood') return 'node:wood';
  if (kind === 'berries') return 'node:berries';
  return 'node:ore'; // stone/clay/iron/gold; fish never designated
}
```

In `findTarget`, replace the `woodcut` branch and add `mine`/`forage`:
```typescript
  if (job === 'woodcut' || job === 'mine' || job === 'forage') {
    const cat = job === 'woodcut' ? 'node:wood' : job === 'forage' ? 'node:berries' : 'node:ore';
    const t = nearest(ix, s.map.w, s.map.h, from, cat);
    return t ? { tile: t } : null;
  }
```

(Delete the old `if (job === 'woodcut') { ... }` block.)

In `src/games/colony/systems/jobScheduler.ts`, update `JOB_ORDER`:
```typescript
const JOB_ORDER: JobType[] = ['build', 'farm', 'forage', 'woodcut', 'mine', 'research', 'tailor'];
```

**Adapt `tests/colony.jobs.test.ts`** — the woodcutter test (the `it('assigns a woodcutter to a wood node placed via setNode', ...)`). Add the `idx` import and designate the node. Change the import line:
```typescript
import { setNode, passableAt, neighbors4, idx } from '@/games/colony/systems/grid';
```
and after the `setNode(s.map, tx, ty, ...)` call inside that test add:
```typescript
    s.designations.add(idx(tx, ty, s.map.w));
```

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run tests/colony.mining.test.ts tests/colony.jobs.test.ts tests/colony.scheduler.test.ts && npx tsc --noEmit`
Expected: PASS (all three files), tsc 0.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(colony): scheduler targets only designated nodes; mine/forage routing

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Work — generalized harvest + resource yield + designation cleanup

**Files:**
- Modify: `src/games/colony/data/balance.ts` (MINE_BASE, FORAGE_BASE)
- Modify: `src/games/colony/systems/work.ts` (HARVEST table; harvest branch)
- Test: `tests/colony.mining.test.ts` (extend — work half)

**Interfaces:**
- Consumes: `addResource` (Task 1), `s.designations` (Task 3).
- Produces: harvesting a node yields its mapped resource; depletion clears node + its designation; wood→`grass`, ore/berries leave biome unchanged.

- [ ] **Step 1: Write the failing test**

Append to `tests/colony.mining.test.ts`:
```typescript
import { runWork } from '@/games/colony/systems/work';
import { setBiome, biomeAt, nodeAt } from '@/games/colony/systems/grid';

describe('mining work', () => {
  it('mining a stone node yields stone; depletion clears node + designation; biome stays rock', () => {
    const s = createColony(5);
    const c = s.colonists[0];
    const tx = Math.round(c.pos.x), ty = Math.round(c.pos.y);
    setBiome(s.map, tx, ty, 'rock');
    setNode(s.map, tx, ty, { kind: 'stone', amount: 0.01, max: 20 }); // depletes in 1 tick
    s.designations.add(idx(tx, ty, s.map.w));
    c.task = 'work'; c.targetTile = { x: tx, y: ty }; c.targetBuildingId = undefined; c.pos = { x: tx, y: ty };
    const stone0 = s.resources.stone.amount;
    runWork(s);
    expect(s.resources.stone.amount).toBeGreaterThan(stone0);
    expect(nodeAt(s.map, tx, ty)).toBeUndefined();
    expect(s.designations.has(idx(tx, ty, s.map.w))).toBe(false);
    expect(biomeAt(s.map, tx, ty)).toBe('rock'); // ore leaves rock, not grass
  });
  it('foraging berries yields food', () => {
    const s = createColony(6);
    const c = s.colonists[0];
    const tx = Math.round(c.pos.x), ty = Math.round(c.pos.y);
    setNode(s.map, tx, ty, { kind: 'berries', amount: 5, max: 5 });
    s.designations.add(idx(tx, ty, s.map.w));
    c.task = 'work'; c.targetTile = { x: tx, y: ty }; c.targetBuildingId = undefined; c.pos = { x: tx, y: ty };
    const food0 = s.resources.food.amount;
    runWork(s);
    expect(s.resources.food.amount).toBeGreaterThan(food0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/colony.mining.test.ts`
Expected: FAIL (stone not added — work only harvests wood).

- [ ] **Step 3: Implement**

In `src/games/colony/data/balance.ts`, add after `WOODCUT_BASE`:
```typescript
export const MINE_BASE = 0.4;         // *skill ; камень/глина/руда
export const FORAGE_BASE = 0.5;       // *skill ; ягоды → еда
```

In `src/games/colony/systems/work.ts`:
- Add imports: extend the balance import to include `MINE_BASE, FORAGE_BASE`, and add types import for `NodeKind`, `SkillId`, `ResourceId`:
```typescript
import type { Building, Colonist, ColonyState, NodeKind, ResourceId, SkillId } from '../domain/types';
```
and add `MINE_BASE, FORAGE_BASE` to the existing `../data/balance` import list. Add `idx` to the grid import list.
- Add a harvest table near the top (after imports):
```typescript
const HARVEST: Record<NodeKind, { res: ResourceId; skill: SkillId; base: number } | null> = {
  wood:    { res: 'wood',  skill: 'woodcutting', base: WOODCUT_BASE },
  stone:   { res: 'stone', skill: 'mining',      base: MINE_BASE },
  clay:    { res: 'clay',  skill: 'mining',      base: MINE_BASE },
  iron:    { res: 'iron',  skill: 'mining',      base: MINE_BASE },
  gold:    { res: 'gold',  skill: 'mining',      base: MINE_BASE },
  berries: { res: 'food',  skill: 'farming',     base: FORAGE_BASE },
  fish:    null, // fishing → Pillar 2
};
```
- Replace the whole "Рубка леса на тайле-цели" block (the `if (!building && c.targetTile) { ... }`) with the generalized harvest:
```typescript
    // Добыча узла на тайле-цели (рубка/добыча/сбор).
    if (!building && c.targetTile) {
      const tx = c.targetTile.x, ty = c.targetTile.y;
      const node = nodeAt(s.map, tx, ty);
      const rule = node ? HARVEST[node.kind] : null;
      if (node && rule && node.amount > 0) {
        const want = rule.base * skillMultiplier(c.skills[rule.skill].level) * workSpeed(c) * cf;
        const took = depleteNode(s.map, tx, ty, want);
        addResource(s, rule.res, took);
        grantXp(c.skills[rule.skill], XP_PER_WORK_TICK);
        if (!nodeAt(s.map, tx, ty)) {                 // узел истощён
          s.designations.delete(idx(tx, ty, s.map.w)); // снять пометку
          if (node.kind === 'wood') setBiome(s.map, tx, ty, 'grass');
          finishWork(c);
        }
      } else {
        finishWork(c); // цель невалидна
      }
      continue;
    }
```

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run tests/colony.mining.test.ts tests/colony.work.test.ts && npx tsc --noEmit`
Expected: PASS (incl. the existing `colony.work` chopping test — wood still → grass), tsc 0.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(colony): generalized node harvest (stone/clay/iron/gold/berries) + designation cleanup

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Bridges & tunnels — types, buildings, placement validation, costs

**Files:**
- Modify: `src/games/colony/domain/types.ts` (BuildingType)
- Modify: `src/games/colony/data/balance.ts` (BUILD_COST/REQUIRED/WORK_SLOTS/JOB + stone costs)
- Modify: `src/games/colony/data/buildings.ts` (BUILDABLE, BUILDING_LABEL)
- Modify: `src/games/colony/systems/build.ts` (canPlaceType)
- Modify: `src/games/colony/systems/projection.ts` (buildingCounts literal)
- Modify: `src/games/colony/ui/panels/BuildMenu.tsx` (GLYPH + cost display)
- Modify: `src/games/colony/scenes/WorldScene.ts` (ghost uses canPlaceType)
- Test: `tests/colony.bridgeTunnel.test.ts` (create — placement half)

**Interfaces:**
- Produces: `BuildingType += 'bridge' | 'tunnel'`; `canPlaceType(s, type, x, y): boolean` (bridge⇒water, tunnel⇒mountain, else existing rules); `placeBlueprint` validates via `canPlaceType`.

- [ ] **Step 1: Write the failing test**

Create `tests/colony.bridgeTunnel.test.ts`:
```typescript
import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { canPlaceType, placeBlueprint } from '@/games/colony/systems/build';
import { setBiome, forEachTile, biomeAt } from '@/games/colony/systems/grid';

function findTile(s: ReturnType<typeof createColony>, biome: string): { x: number; y: number } {
  let found = { x: -1, y: -1 };
  forEachTile(s.map, (_i, x, y) => { if (found.x < 0 && biomeAt(s.map, x, y) === biome) found = { x, y }; });
  return found;
}

describe('bridge/tunnel placement', () => {
  it('bridge only on water, tunnel only on mountain', () => {
    const s = createColony(1);
    setBiome(s.map, 20, 20, 'water');
    setBiome(s.map, 22, 20, 'mountain');
    setBiome(s.map, 24, 20, 'grass');
    expect(canPlaceType(s, 'bridge', 20, 20)).toBe(true);
    expect(canPlaceType(s, 'bridge', 24, 20)).toBe(false); // grass
    expect(canPlaceType(s, 'tunnel', 22, 20)).toBe(true);
    expect(canPlaceType(s, 'tunnel', 20, 20)).toBe(false); // water
  });
  it('placing a bridge deducts wood and creates an unbuilt blueprint', () => {
    const s = createColony(1);
    setBiome(s.map, 20, 20, 'water');
    s.resources.wood.amount = 100;
    const wood0 = s.resources.wood.amount;
    const res = placeBlueprint(s, 'bridge', 20, 20);
    expect(res.ok).toBe(true);
    expect(s.resources.wood.amount).toBeLessThan(wood0);
    expect(s.buildings.some((b) => b.type === 'bridge' && !b.built)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/colony.bridgeTunnel.test.ts`
Expected: FAIL (canPlaceType not exported / bridge type unknown).

- [ ] **Step 3: Implement**

In `src/games/colony/domain/types.ts`:
```typescript
export type BuildingType = 'farm' | 'bedroom' | 'storage' | 'lab' | 'wall' | 'door' | 'heater' | 'tailor' | 'bridge' | 'tunnel';
```

In `src/games/colony/data/balance.ts`, extend the four building records (add `bridge`/`tunnel`, add stone to a few; keep existing entries):
```typescript
export const BUILD_COST: Record<BuildingType, Partial<Record<ResourceId, number>>> = {
  farm: { wood: 20 }, bedroom: { wood: 25 }, storage: { wood: 15, stone: 5 }, lab: { wood: 35, stone: 5 },
  wall: { stone: 5 }, door: { wood: 8 }, heater: { wood: 30, stone: 5 }, tailor: { wood: 25 },
  bridge: { wood: 8 }, tunnel: { wood: 5, stone: 5 },
};

export const BUILD_REQUIRED: Record<BuildingType, number> = {
  farm: 30, bedroom: 35, storage: 25, lab: 45, wall: 8, door: 10, heater: 25, tailor: 30,
  bridge: 15, tunnel: 25,
};

export const BUILDING_WORK_SLOTS: Record<BuildingType, number> = {
  farm: 3, bedroom: 0, storage: 0, lab: 2, wall: 0, door: 0, heater: 0, tailor: 2,
  bridge: 0, tunnel: 0,
};

export const BUILDING_JOB: Record<BuildingType, JobType | undefined> = {
  farm: 'farm', lab: 'research', bedroom: undefined, storage: undefined,
  wall: undefined, door: undefined, heater: undefined, tailor: 'tailor',
  bridge: undefined, tunnel: undefined,
};
```

In `src/games/colony/data/buildings.ts`:
```typescript
export const BUILDABLE: BuildingType[] = ['farm', 'bedroom', 'storage', 'lab', 'wall', 'door', 'heater', 'tailor', 'bridge', 'tunnel'];

export const BUILDING_LABEL: Record<BuildingType, string> = {
  farm: 'Ферма', bedroom: 'Спальня', storage: 'Склад', lab: 'Лаборатория',
  wall: 'Стена', door: 'Дверь', heater: 'Обогреватель', tailor: 'Верстак',
  bridge: 'Мост', tunnel: 'Туннель',
};
```

In `src/games/colony/systems/build.ts`, add `canPlaceType` and route `placeBlueprint` through it:
```typescript
import { biomeAt, buildingIdAt, inBounds } from './grid';
import type { BuildingType, ColonyState } from '../domain/types';

function occupied(s: ColonyState, x: number, y: number): boolean {
  if (buildingIdAt(s.map, x, y)) return true;
  return s.buildings.some((bl) => bl.tile.x === x && bl.tile.y === y);
}

export function canPlaceType(s: ColonyState, type: BuildingType, x: number, y: number): boolean {
  if (!inBounds(x, y, s.map)) return false;
  if (occupied(s, x, y)) return false;
  const b = biomeAt(s.map, x, y);
  if (type === 'bridge') return b === 'water';
  if (type === 'tunnel') return b === 'mountain';
  return b !== 'water' && b !== 'mountain';
}
```
Keep the existing `canPlace(s, x, y)` for callers (it stays as-is). Change `placeBlueprint`'s first guard:
```typescript
  if (!canPlaceType(s, type, x, y)) return { ok: false, reason: 'нельзя строить здесь' };
```

In `src/games/colony/systems/projection.ts`, extend the `buildingCounts` literal:
```typescript
  const buildingCounts: Record<BuildingType, number> = { farm: 0, bedroom: 0, storage: 0, lab: 0, wall: 0, door: 0, heater: 0, tailor: 0, bridge: 0, tunnel: 0 };
```

In `src/games/colony/ui/panels/BuildMenu.tsx`, extend `GLYPH` and show stone cost when present:
```typescript
const GLYPH: Record<BuildingType, string> = {
  farm: '🌾', bedroom: '🛏️', storage: '📦', lab: '🔬',
  wall: '🧱', door: '🚪', heater: '🔥', tailor: '🪡', bridge: '🌉', tunnel: '⛏️',
};
```
Replace the cost `<span>` line with:
```tsx
          <span className="block font-mono text-[0.6rem] text-muted">
            {BUILD_COST[b].wood ? `${BUILD_COST[b].wood}🪵 ` : ''}{BUILD_COST[b].stone ? `${BUILD_COST[b].stone}🪨` : ''}
          </span>
```

In `src/games/colony/scenes/WorldScene.ts`, change the ghost validity check in `onPointerMove` to use the placing type:
```typescript
      const ok = canPlaceType(this.state, this.placingType, t.x, t.y);
```
and update the import:
```typescript
import { placeBlueprint, canPlaceType } from '../systems/build';
```

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run tests/colony.bridgeTunnel.test.ts tests/colony.build.test.ts tests/colony.projection.test.ts && npx tsc --noEmit`
Expected: PASS, tsc 0.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(colony): bridge/tunnel building types + placement validation + stone costs

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: grid.nearestPassableAdjacent + scheduler build-target adjacency

**Files:**
- Modify: `src/games/colony/systems/grid.ts` (nearestPassableAdjacent)
- Modify: `src/games/colony/systems/jobScheduler.ts` (build target = passable tile or adjacent)
- Test: `tests/colony.bridgeTunnel.test.ts` (extend — adjacency half)

**Interfaces:**
- Produces: `nearestPassableAdjacent(m: ColonyMap, x: number, y: number): Pt | undefined` — a 4-neighbor with `passable=1`, or undefined.
- Consumes: `canPlaceType`/bridge blueprints from Task 6.

- [ ] **Step 1: Write the failing test**

Append to `tests/colony.bridgeTunnel.test.ts`:
```typescript
import { nearestPassableAdjacent, setPassable, passableAt } from '@/games/colony/systems/grid';
import { runJobScheduler } from '@/games/colony/systems/jobScheduler';
import { placeBlueprint as place2 } from '@/games/colony/systems/build';

describe('build target adjacency', () => {
  it('nearestPassableAdjacent finds a passable neighbor of an impassable tile', () => {
    const s = createColony(1);
    setBiome(s.map, 40, 40, 'water'); setPassable(s.map, 40, 40, false);
    setBiome(s.map, 41, 40, 'grass'); setPassable(s.map, 41, 40, true);
    const adj = nearestPassableAdjacent(s.map, 40, 40);
    expect(adj).toBeDefined();
    expect(passableAt(s.map, adj!.x, adj!.y)).toBe(true);
  });
  it('a bridge blueprint is targeted via a passable adjacent tile, not the water tile', () => {
    const s = createColony(1);
    // place a bridge next to the first colonist so a passable neighbour exists
    const c0 = s.colonists[0];
    const wx = Math.round(c0.pos.x) + 1, wy = Math.round(c0.pos.y);
    setBiome(s.map, wx, wy, 'water'); setPassable(s.map, wx, wy, false);
    s.resources.wood.amount = 100;
    place2(s, 'bridge', wx, wy);
    s.colonists.forEach((c) => { c.task = 'idle'; (['farm','forage','woodcut','mine','research','tailor'] as const).forEach((j) => (c.priorities[j] = 0)); c.priorities.build = 3; });
    runJobScheduler(s);
    const builder = s.colonists.find((c) => c.task === 'goto_work' && c.targetBuildingId);
    expect(builder).toBeDefined();
    expect(passableAt(s.map, builder!.targetTile!.x, builder!.targetTile!.y)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/colony.bridgeTunnel.test.ts`
Expected: FAIL (nearestPassableAdjacent missing / builder target on water).

- [ ] **Step 3: Implement**

In `src/games/colony/systems/grid.ts`, add after `neighbors4`:
```typescript
/** Ближайший 4-сосед с passable=1 (для целей постройки на непроходимом тайле). */
export function nearestPassableAdjacent(m: ColonyMap, x: number, y: number): Pt | undefined {
  for (const d of DIRS) {
    const nx = x + d.x, ny = y + d.y;
    if (inBounds(nx, ny, m) && m.passable[idx(nx, ny, m.w)] === 1) return { x: nx, y: ny };
  }
  return undefined;
}
```

In `src/games/colony/systems/jobScheduler.ts`:
- Add to the grid import: `passableAt, nearestPassableAdjacent`.
- In `findTarget`, the `job === 'build'` branch: after resolving `b`, compute a reachable target tile:
```typescript
  if (job === 'build') {
    const t = nearest(ix, s.map.w, s.map.h, from, 'build', (p) => {
      const b = byTile.get(`${p.x},${p.y}`)!;
      return workersOn(s, b.id) < 1;
    });
    if (!t) return null;
    const b = byTile.get(`${t.x},${t.y}`)!;
    const tile = passableAt(s.map, b.tile.x, b.tile.y) ? b.tile : nearestPassableAdjacent(s.map, b.tile.x, b.tile.y);
    if (!tile) return null; // непроходимо и нет прохода — пропускаем
    return { tile, buildingId: b.id };
  }
```

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run tests/colony.bridgeTunnel.test.ts tests/colony.jobs.test.ts && npx tsc --noEmit`
Expected: PASS, tsc 0.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(colony): build-target adjacency for bridges/tunnels (nearestPassableAdjacent)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Work — bridge/tunnel completion → passable + nav dirty

**Files:**
- Modify: `src/games/colony/systems/work.ts` (build-complete branch)
- Test: `tests/colony.bridgeTunnel.test.ts` (extend — completion half)

**Interfaces:**
- Consumes: `setPassable`, `markDirtyAt` (already imported in work.ts), bridge blueprints.
- Produces: on bridge/tunnel completion the tile becomes passable + nav cluster marked dirty.

- [ ] **Step 1: Write the failing test**

Append to `tests/colony.bridgeTunnel.test.ts`:
```typescript
import { runWork } from '@/games/colony/systems/work';

describe('bridge/tunnel completion', () => {
  it('completing a bridge makes the water tile passable', () => {
    const s = createColony(1);
    const wx = 50, wy = 50;
    setBiome(s.map, wx, wy, 'water'); setPassable(s.map, wx, wy, false);
    const bp = { id: 'br1', type: 'bridge' as const, tile: { x: wx, y: wy }, workSlots: 0, jobType: undefined, built: false, buildProgress: 0, buildRequired: 2 };
    s.buildings.push(bp);
    const c = s.colonists[0];
    c.task = 'work'; c.targetBuildingId = 'br1'; c.targetTile = { x: wx, y: wy }; c.pos = { x: wx + 1, y: wy };
    for (let i = 0; i < 50 && !bp.built; i++) runWork(s);
    expect(bp.built).toBe(true);
    expect(passableAt(s.map, wx, wy)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/colony.bridgeTunnel.test.ts`
Expected: FAIL (tile still impassable after build).

- [ ] **Step 3: Implement**

In `src/games/colony/systems/work.ts`, inside the build-completion block (where `building.built = true; setBuildingId(...)` happens, right after the `wall` handling), add:
```typescript
        if (building.type === 'bridge' || building.type === 'tunnel') {
          setPassable(s.map, building.tile.x, building.tile.y, true);
          if (s.nav) markDirtyAt(s.nav, building.tile.x, building.tile.y);
        }
```

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run tests/colony.bridgeTunnel.test.ts && npx tsc --noEmit`
Expected: PASS, tsc 0.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(colony): bridge/tunnel completion opens passability + nav invalidation

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Save — designations + new resources + version 7 + bridge/tunnel restore

**Files:**
- Modify: `src/games/colony/domain/save.ts` (ColonySave.designations, toSave/fromSave, restore passability)
- Modify: `src/games/colony/domain/createColony.ts` (version 7)
- Modify: `src/games/colony/ColonyGameModule.ts` (COLONY_PAYLOAD_VERSION 7)
- Test: `tests/colony.save.roundtrip.test.ts` (extend)

**Interfaces:**
- Produces: `ColonySave.designations: number[]`; round-trip preserves designations + new resources; `fromSave` sets `passable=true` for built bridges/tunnels and `designations: new Set(p.designations)`.

- [ ] **Step 1: Write the failing test**

Append to `tests/colony.save.roundtrip.test.ts` (a fresh `describe`):
```typescript
import { describe as d2, it as i2, expect as e2 } from 'vitest';
import { createColony as cc } from '@/games/colony/domain/createColony';
import { toSave as ts, fromSave as fs } from '@/games/colony/domain/save';
import { setBiome as sb, setPassable as sp, setNode as sn, idx as ix2, passableAt as pa } from '@/games/colony/systems/grid';

d2('save: designations + new resources + bridge passability', () => {
  i2('round-trips designations, resources, and bridge passability', () => {
    const s = cc(99);
    sn(s.map, 12, 12, { kind: 'stone', amount: 10, max: 10 });
    s.designations.add(ix2(12, 12, s.map.w));
    s.resources.stone.amount = 42;
    // a completed bridge on water
    sb(s.map, 13, 13, 'water'); sp(s.map, 13, 13, false);
    s.buildings.push({ id: 'br', type: 'bridge', tile: { x: 13, y: 13 }, workSlots: 0, jobType: undefined, built: true, buildProgress: 15, buildRequired: 15 });
    const r = fs(ts(s));
    e2(r.designations.has(ix2(12, 12, r.map.w))).toBe(true);
    e2(r.resources.stone.amount).toBe(42);
    e2(pa(r.map, 13, 13)).toBe(true); // bridge restored passability
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/colony.save.roundtrip.test.ts`
Expected: FAIL (designations not on save / bridge tile impassable).

- [ ] **Step 3: Implement**

In `src/games/colony/domain/save.ts`:
- Add to `ColonySave` interface (after `assignCursor: number;`):
```typescript
  designations: number[];
```
- In `toSave`, add the field (after `assignCursor: s.assignCursor,`):
```typescript
    designations: [...s.designations],
```
- In `fromSave`, in the building-restore loop add bridge/tunnel passability:
```typescript
  for (const b of p.buildings) {
    if (!b.built) continue;
    setBuildingId(map, b.tile.x, b.tile.y, b.id);
    if (b.type === 'wall') setPassable(map, b.tile.x, b.tile.y, false);
    if (b.type === 'bridge' || b.type === 'tunnel') setPassable(map, b.tile.x, b.tile.y, true);
  }
```
- In the `fromSave` return object, add (and set version from payload — already does `version: p.version`):
```typescript
    designations: new Set<number>(p.designations ?? []),
    assignCursor: p.assignCursor ?? 0,
```
  (Replace the existing `assignCursor` line; keep both fields present.)

In `src/games/colony/domain/createColony.ts`, change `version: 6,` to:
```typescript
    version: 7,
```

In `src/games/colony/ColonyGameModule.ts`, change:
```typescript
const COLONY_PAYLOAD_VERSION = 7;
```

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run tests/colony.save.roundtrip.test.ts tests/colony.migration.test.ts && npx tsc --noEmit`
Expected: PASS, tsc 0. (If `colony.migration.test.ts` hardcodes version 6 as "current", update its expected current version to 7.)

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(colony): persist designations + new resources; save v7; restore bridge/tunnel passability

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Render — DesignationLayer overlay + bridge/tunnel/node sprites

**Files:**
- Create: `src/games/colony/scenes/render/DesignationLayer.ts`
- Modify: `src/games/colony/scenes/render/textures.ts` (bridge/tunnel + missing node sprites)
- Modify: `src/games/colony/scenes/render/SpriteLayer.ts` (draw bridge/tunnel buildings + new node kinds)
- Modify: `src/games/colony/scenes/WorldScene.ts` (instantiate + update + destroy DesignationLayer)
- Test: `tests/colony.designationLayer.test.ts` (create — pure color helper only)

**Interfaces:**
- Produces: `designationColor(kind: NodeKind): number` (pure, exported from DesignationLayer); `class DesignationLayer { constructor(scene, state); update(): void; destroy(): void }`.

**Note:** Phaser layers are tsc+build-gated (no headless render test), matching the foundation. Only the pure color helper is unit-tested. Follow `WaterLayer.ts`/`SpriteLayer.ts` patterns for scene/graphics lifecycle and `visibleTileRange` culling (see `WorldScene.drawTempOverlay` for the culling idiom).

- [ ] **Step 1: Write the failing test**

Create `tests/colony.designationLayer.test.ts`:
```typescript
import { describe, expect, it } from 'vitest';
import { designationColor } from '@/games/colony/scenes/render/DesignationLayer';

describe('designation overlay color', () => {
  it('maps node kinds to mode colors', () => {
    expect(designationColor('wood')).toBe(0x84de5a);                 // chop = green
    for (const k of ['stone', 'clay', 'iron', 'gold'] as const) {
      expect(designationColor(k)).toBe(0xe8a13a);                    // mine = orange
    }
    expect(designationColor('berries')).toBe(0xb46ed8);              // forage = purple
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/colony.designationLayer.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Create `src/games/colony/scenes/render/DesignationLayer.ts`:
```typescript
import Phaser from 'phaser';
import type { ColonyState, NodeKind } from '../../domain/types';
import { TILE } from '../../data/balance';
import { nodeAt } from '../../systems/grid';
import { visibleTileRange } from '../cameraMath';

/** Цвет подсветки зоны по виду узла: рубка=зелёный, добыча=оранжевый, сбор=фиолетовый. */
export function designationColor(kind: NodeKind): number {
  if (kind === 'wood') return 0x84de5a;
  if (kind === 'berries') return 0xb46ed8;
  return 0xe8a13a; // stone/clay/iron/gold (+fish, never designated)
}

export class DesignationLayer {
  private gfx: Phaser.GameObjects.Graphics;
  constructor(private scene: Phaser.Scene, private state: ColonyState) {
    this.gfx = scene.add.graphics().setDepth(-450); // above temp overlay (-500), below sprites
  }
  update(): void {
    this.gfx.clear();
    if (this.state.designations.size === 0) return;
    const cam = this.scene.cameras.main;
    const r = visibleTileRange(cam.scrollX, cam.scrollY, cam.zoom, cam.width, cam.height, TILE, this.state.map.w, this.state.map.h);
    for (let y = r.y0; y <= r.y1; y++) {
      for (let x = r.x0; x <= r.x1; x++) {
        const i = y * this.state.map.w + x;
        if (!this.state.designations.has(i)) continue;
        const node = nodeAt(this.state.map, x, y);
        if (!node) continue;
        this.gfx.fillStyle(designationColor(node.kind), 0.35);
        this.gfx.fillRect(x * TILE, y * TILE, TILE - 1, TILE - 1);
      }
    }
  }
  destroy(): void { this.gfx.destroy(); }
}
```

In `src/games/colony/scenes/render/textures.ts`: add procedural sprite textures for `bridge` and `tunnel`, plus any missing node sprites (`stone`/`clay`/`iron`/`gold`/`berries`) following the existing `buildSpriteTextures` pattern (reuse the rock/tree sprite idioms; key names like `spr_bridge`, `spr_tunnel`, `spr_node_stone`, etc.). Match how the foundation already keys building/node sprites (inspect the file's existing keys before adding).

In `src/games/colony/scenes/render/SpriteLayer.ts`: in the building draw path, map `bridge`/`tunnel` building types to their sprite keys; in the node draw path, map the new node kinds to their sprite keys. Follow the existing switch/lookup the file uses for buildings and nodes (do not invent a new mechanism).

In `src/games/colony/scenes/WorldScene.ts`:
- Import: `import { DesignationLayer } from './render/DesignationLayer';`
- Field: `private designations!: DesignationLayer;`
- In `create()`, after `this.minimap = ...`: `this.designations = new DesignationLayer(this, this.state);`
- In `update()`, after `this.sprites.update();`: `this.designations.update();`
- In `shutdown()` and the `restart` command cleanup: `this.designations?.destroy();`

- [ ] **Step 4: Run test + typecheck + build**

Run: `npx vitest run tests/colony.designationLayer.test.ts && npx tsc --noEmit && npm run build`
Expected: PASS, tsc 0, build exit 0.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(colony): designation overlay + bridge/tunnel/node sprites

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: WorldScene input — designation tool + drag-rectangle

**Files:**
- Modify: `src/games/colony/scenes/WorldScene.ts`
- (No new unit test — pure `designate` already covered in Task 3; verify via tsc + build.)

**Interfaces:**
- Consumes: `designate(state, rect, mode)` (Task 3), `computeHud` (existing).
- Produces: `ui:command` type `setTool` with `payload.tool: 'chop' | 'mine' | 'forage' | 'cancel' | null`; an active tool makes pointer-drag paint a designation rectangle instead of panning.

- [ ] **Step 1: Implement the tool state + command**

In `src/games/colony/scenes/WorldScene.ts`:
- Imports: `import { designate, type DesignationMode } from '../systems/designations';`
- Fields:
```typescript
  private tool: DesignationMode | null = null;
  private selecting = false;
  private selStartTile = { x: 0, y: 0 };
  private selRect!: Phaser.GameObjects.Rectangle;
```
- In `create()`, after the ghost setup, add a selection rectangle:
```typescript
    this.selRect = this.add.rectangle(0, 0, TILE, TILE, 0xffffff, 0.12).setVisible(false).setDepth(8400);
    this.selRect.setStrokeStyle(1, 0xffffff, 0.5);
    this.selRect.setOrigin(0, 0);
```
- In `onCommand`, add cases:
```typescript
      case 'setTool': this.tool = (msg.payload?.tool ?? null) as DesignationMode | null; this.placingType = null; this.ghost.setVisible(false); break;
```
- In `onPointerDown` (before the pan branch / after the minimap + placingType guards), add a tool branch:
```typescript
    if (this.tool) {
      const t = this.worldToTile(p.x, p.y);
      this.selecting = true;
      this.selStartTile = t;
      this.selRect.setPosition(t.x * TILE, t.y * TILE).setSize(TILE, TILE).setVisible(true);
      return;
    }
```
- In `onPointerMove`, add (before the pan branch):
```typescript
    if (this.selecting && this.tool) {
      const t = this.worldToTile(p.x, p.y);
      const x0 = Math.min(this.selStartTile.x, t.x), y0 = Math.min(this.selStartTile.y, t.y);
      const x1 = Math.max(this.selStartTile.x, t.x), y1 = Math.max(this.selStartTile.y, t.y);
      this.selRect.setPosition(x0 * TILE, y0 * TILE).setSize((x1 - x0 + 1) * TILE, (y1 - y0 + 1) * TILE);
      return;
    }
```
- In `onPointerUp`, add at the top (before the isDragging logic):
```typescript
    if (this.selecting && this.tool) {
      this.selecting = false;
      this.selRect.setVisible(false);
      const t = this.worldToTile(p.x, p.y);
      designate(this.state, { x0: this.selStartTile.x, y0: this.selStartTile.y, x1: t.x, y1: t.y }, this.tool);
      this.ctx.events.emit('game:state', computeHud(this.state));
      return;
    }
```

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: tsc 0, build exit 0.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(colony): designation tool + drag-rectangle input in WorldScene

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: UI — designation toolbar in the HUD

**Files:**
- Modify: `src/games/colony/ui/ColonyHud.tsx` (toolbar section + active-tool state)
- (Verify via tsc + build; Inspector priorities + BuildMenu already done in Tasks 2 & 6.)

**Interfaces:**
- Consumes: `cmd('setTool', { tool })` bridge (existing `cmd` helper), `setTool` command (Task 11).
- Produces: a toolbar that lets the player pick chop/mine/forage/cancel (or deselect).

- [ ] **Step 1: Implement the toolbar**

In `src/games/colony/ui/ColonyHud.tsx`:
- Add state near the other `useState`s:
```typescript
  const [tool, setTool] = useState<'chop' | 'mine' | 'forage' | 'cancel' | null>(null);
```
- Add a helper that toggles a tool and emits the command:
```typescript
  const pickTool = (t: 'chop' | 'mine' | 'forage' | 'cancel') => {
    const next = tool === t ? null : t;
    setTool(next);
    cmd('setTool', { tool: next });
  };
```
- Insert a new section in the right panel, right above the «Строительство» block:
```tsx
          <div>
            <p className="label-mono mb-2">Зоны добычи</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: 'chop', label: '🌲 Рубка' },
                { id: 'mine', label: '⛏️ Добыча' },
                { id: 'forage', label: '🫐 Сбор' },
                { id: 'cancel', label: '✕ Отмена' },
              ] as const).map((t) => (
                <button
                  key={t.id}
                  onClick={() => pickTool(t.id)}
                  className={cx(
                    'rounded-xl border p-2 text-center font-display text-[0.7rem] transition-all',
                    tool === t.id ? 'border-accent/60 bg-accent/20 text-accent' : 'border-edge/60 text-ink hover:border-accent/50',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="mt-1 font-mono text-[0.55rem] text-muted">выбери режим, затем протяни прямоугольник по карте</p>
          </div>
```

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: tsc 0, build exit 0.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(colony): designation toolbar in HUD

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: Adapt movement test + mining determinism smoke

**Files:**
- Modify: `tests/colony.tick.test.ts` (adapt "colonists actually move" — auto-woodcut is now zone-gated)
- Test: `tests/colony.mining.test.ts` (extend — determinism smoke with designations + mining)

**Interfaces:**
- Consumes: everything above.
- Produces: a green test suite reflecting zone-gated gathering + a determinism guarantee for a run with designations and mining.

- [ ] **Step 1: Adapt the movement test**

In `tests/colony.tick.test.ts`, the `it('colonists actually move (positions change) over a day', ...)` test: colonists no longer auto-chop, so give them a reachable work target. Add imports at the top of the file:
```typescript
import { pickStartSite } from '@/games/colony/domain/worldgen';
import { passableAt, neighbors4 } from '@/games/colony/systems/grid';
```
Replace the test body with:
```typescript
  it('colonists actually move (positions change) over a day', () => {
    const s = createColony(11);
    // give them a reachable farm to walk to (gathering is zone-gated now)
    const start = pickStartSite(s.map);
    let spot = start;
    for (const n of neighbors4(start.x, start.y, s.map)) { if (passableAt(s.map, n.x, n.y)) { spot = n; break; } }
    s.buildings.push({ id: 'farmM', type: 'farm', tile: { x: spot.x, y: spot.y }, workSlots: 3, jobType: 'farm', built: true, buildProgress: 30, buildRequired: 30 });
    s.colonists.forEach((c) => { c.priorities.farm = 3; });
    const before = s.colonists.map((c) => `${c.pos.x.toFixed(2)},${c.pos.y.toFixed(2)}`);
    for (let i = 0; i < TICKS_PER_DAY; i++) tick(s);
    const after = s.colonists.map((c) => `${c.pos.x.toFixed(2)},${c.pos.y.toFixed(2)}`);
    expect(after).not.toEqual(before);
  }, 30000);
```

- [ ] **Step 2: Write the determinism smoke**

Append to `tests/colony.mining.test.ts`:
```typescript
import { tick } from '@/games/colony/systems/tick';
import { designate } from '@/games/colony/systems/designations';

describe('mining determinism', () => {
  it('a run with designations + mining is deterministic and exception-free', () => {
    const build = (seed: number) => {
      const s = createColony(seed);
      // designate every ore + wood + berries node in a band near the centre
      designate(s, { x0: 0, y0: 0, x1: s.map.w - 1, y1: s.map.h - 1 }, 'mine');
      designate(s, { x0: 0, y0: 0, x1: s.map.w - 1, y1: s.map.h - 1 }, 'chop');
      designate(s, { x0: 0, y0: 0, x1: s.map.w - 1, y1: s.map.h - 1 }, 'forage');
      s.colonists.forEach((c) => { c.priorities.mine = 3; c.priorities.woodcut = 3; c.priorities.forage = 3; });
      return s;
    };
    const a = build(2024), b = build(2024);
    for (let i = 0; i < 300; i++) { tick(a); tick(b); }
    expect(a.resources.stone.amount).toBe(b.resources.stone.amount);
    expect(a.resources.wood.amount).toBe(b.resources.wood.amount);
    expect(a.colonists.map((c) => `${c.pos.x.toFixed(3)},${c.pos.y.toFixed(3)}`))
      .toEqual(b.colonists.map((c) => `${c.pos.x.toFixed(3)},${c.pos.y.toFixed(3)}`));
  }, 30000);
});
```

- [ ] **Step 3: Run the adapted/new tests**

Run: `npx vitest run tests/colony.tick.test.ts tests/colony.mining.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "test(colony): adapt movement test to zone-gated gathering + mining determinism smoke

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: Whole-suite verification + final fixes

**Files:**
- Any test that still assumes auto-woodcut or version 6 (fix in place).

- [ ] **Step 1: Run the full suite + typecheck + build**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: tsc 0; ALL tests pass; build exit 0.

- [ ] **Step 2: Fix any fallout**

Likely candidates if red: `tests/colony.types.test.ts` (if it asserts exact SkillId/JobType/BuildingType arrays — update expected lists), `tests/colony.migration.test.ts` (current version → 7), `tests/colony.seam.test.ts` (ensure no raw `map.biome`/`map.passable` reads were added outside `grid.ts` — DesignationLayer/work use accessors, so this should stay green; if red, route the offending read through a grid accessor). Fix each in place, keeping changes minimal and faithful to the spec.

- [ ] **Step 3: Re-run to confirm green**

Run: `npx tsc --noEmit && npm test`
Expected: tsc 0; all tests pass.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "test(colony): whole-suite green for Pillar 1A (designations/mining/bridges)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage** (each §2 "Входит" item → task):
- Designations (chop/mine/forage/cancel, drag-rect, sparse set, overlay): Tasks 3 (data/logic), 10 (overlay), 11 (drag input), 12 (toolbar). ✓
- mine/forage jobs + zone-gated woodcut: Tasks 4 (scheduler), 5 (work). ✓
- New resources stone/clay/iron/gold + berries→food + storage capacity: Tasks 1, 5. ✓
- Bridge/tunnel buildable passability structures (+ nav dirty): Tasks 6 (types/placement), 7 (build-target adjacency), 8 (completion→passable). ✓
- HUD (resources, toolbar, build menu, priorities): Tasks 1 (RES_META), 2 (Inspector), 6 (BuildMenu), 12 (toolbar). ✓
- Save/determinism (designations + resources persist, version bump, reject old): Tasks 9, 13. ✓
- Behavior change (woodcut now zone-gated) + test adaptation: Tasks 4, 13, 14. ✓
- §11 acceptance criteria & §12 test strategy: covered by the per-task tests + Task 13/14. ✓

**Placeholder scan:** No "TBD/TODO/handle edge cases" — every code step has concrete code; render/UI tasks that can't be headless-tested are explicitly tsc+build-gated (matching the foundation's Phaser convention), with the one extractable helper (`designationColor`) unit-tested.

**Type consistency:** `ResourceId`/`JobType`/`SkillId`/`BuildingType` expansions are each paired with every complete-record literal they ripple into (START_RESOURCES, projection resources + buildingCounts, RES_META, GLYPH, BUILD_* records, SKILL_*, JOBS, JOB_TYPES). Shared signatures used across tasks match: `designate(s, rect, mode)`, `MODE_KINDS`, `nodeCat`, `HARVEST`, `canPlaceType(s, type, x, y)`, `nearestPassableAdjacent(m, x, y)`, `designationColor(kind)`, `ColonyState.designations: Set<number>`, `ColonySave.designations: number[]`, payloadVersion 7 in both createColony and ColonyGameModule.

---

*Execution: subagent-driven per task with review between tasks (recommended), or inline via executing-plans.*
