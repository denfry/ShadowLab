# Зеркальная Ложа — Этап 0 (движок) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure, deterministic, fully-tested engine for «Зеркальная Ложа» — a 2-player mirrored-room co-op escape — covering seed→run generation, three asymmetric puzzle archetypes, an event reducer, and a solvability validator. No UI, no network.

**Architecture:** Mirror the `among-the-quiet/engine/` shape: a pure TS module under `src/games/lodge/engine/` with a `mulberry32` RNG, an `Archetype` contract (`generate`/`reduce`/`isSolved`/`solutionEvents`), seed-randomized puzzle instances assembled into a `Run`, an event-sourced `applyEvent` reducer producing a `RunState`, and a `validateRun` that threads each puzzle's canonical solution through the reducer to prove the whole run is escapable. Both future clients will build identical runs from one seed and stay in sync by applying the same ordered event stream through the same reducer.

**Tech Stack:** TypeScript (strict), Vitest. No runtime dependencies. R3F and Supabase Realtime arrive in later этапы and are explicitly out of scope here.

## Global Constraints

- **Pure engine:** no React/DOM/network imports anywhere under `src/games/lodge/engine/**`.
- **Determinism:** identical `seed` ⇒ identical `Run`. RNG is `mulberry32` only — never `Math.random()`, `Date.now()`, or `new Date()`.
- **Asymmetry invariant:** every generated puzzle satisfies `lockOwner !== clueOwner`.
- **Tests:** Vitest, files named `tests/lodge-*.test.ts`, imports via the `@/` alias (`@/games/lodge/engine/...`). Single-file run: `npx vitest run <file>`.
- **TypeScript strict** is on, including `noFallthroughCasesInSwitch`. Typecheck with `npm run typecheck`.
- **No new dependencies** in Этап 0.
- **Commits:** Conventional Commits, scope `lodge`. Every commit ends with the trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` (shown as a second `-m` paragraph in each commit step).

---

## File Structure

Engine (all created in this plan):

- `src/games/lodge/engine/types.ts` — roles, difficulty, symbol vocabulary, view/solution/state tagged unions, events, `Run`/`RunState`, the `Archetype` contract.
- `src/games/lodge/engine/seed.ts` — `mulberry32` RNG + `randInt`/`pick`/`shuffle`.
- `src/games/lodge/engine/util.ts` — pure helpers: `arrEq`, `normEdge`, `edgeSetEq`, `fnv1a`, `chooseOwners`.
- `src/games/lodge/engine/archetypes/dial.ts` — Dial ↔ Legend archetype.
- `src/games/lodge/engine/archetypes/constellation.ts` — Star-map ↔ Constellation archetype.
- `src/games/lodge/engine/archetypes/candle.ts` — Verse ↔ Candelabra archetype.
- `src/games/lodge/engine/archetypes/index.ts` — `ARCHETYPES` registry + `ARCHETYPE_IDS`.
- `src/games/lodge/engine/generate.ts` — `createRun(seed, config)`.
- `src/games/lodge/engine/reducer.ts` — `initRunState`, `applyEvent`, `hashState`.
- `src/games/lodge/engine/validator.ts` — `validateRun`.
- `src/games/lodge/engine/index.ts` — public barrel.

Tests:

- `tests/lodge-types.test.ts`, `tests/lodge-seed.test.ts`, `tests/lodge-dial.test.ts`, `tests/lodge-constellation.test.ts`, `tests/lodge-candle.test.ts`, `tests/lodge-registry.test.ts`, `tests/lodge-generate.test.ts`, `tests/lodge-reducer.test.ts`, `tests/lodge-validator.test.ts`, `tests/lodge-engine.test.ts`.

---

## Task 1: Core types & constants

**Files:**
- Create: `src/games/lodge/engine/types.ts`
- Test: `tests/lodge-types.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `Role`, `ROLES`, `Difficulty`, `DIFFICULTY` (`Record<Difficulty, DifficultyConfig>`), `DifficultyConfig`, `SYMBOLS`, `GlyphSymbol`, `RoomView`, `Solution`, `PuzzleState`, `PuzzleEvent`, `LodgeEvent`, `GeneratedPuzzle`, `PuzzleInstance`, `Run`, `RunState`, `Archetype`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/lodge-types.test.ts
import { describe, expect, it } from 'vitest';
import { SYMBOLS, ROLES, DIFFICULTY } from '@/games/lodge/engine/types';

describe('lodge constants', () => {
  it('symbols are unique', () => {
    expect(new Set(SYMBOLS).size).toBe(SYMBOLS.length);
    expect(SYMBOLS.length).toBeGreaterThanOrEqual(8);
  });

  it('roles are exactly A and B', () => {
    expect([...ROLES]).toEqual(['A', 'B']);
  });

  it('difficulty lengths increase gentle < standard < devious', () => {
    expect(DIFFICULTY.gentle.dialLen).toBeLessThan(DIFFICULTY.standard.dialLen);
    expect(DIFFICULTY.standard.dialLen).toBeLessThan(DIFFICULTY.devious.dialLen);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lodge-types.test.ts`
Expected: FAIL — cannot resolve `@/games/lodge/engine/types`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/games/lodge/engine/types.ts
import type { Rng } from './seed';

export type Role = 'A' | 'B';
export const ROLES: readonly Role[] = ['A', 'B'];

export type Difficulty = 'gentle' | 'standard' | 'devious';
export interface DifficultyConfig {
  dialLen: number;
  starEdges: number;
  candleCount: number;
}
export const DIFFICULTY: Record<Difficulty, DifficultyConfig> = {
  gentle: { dialLen: 3, starEdges: 3, candleCount: 4 },
  standard: { dialLen: 4, starEdges: 4, candleCount: 5 },
  devious: { dialLen: 5, starEdges: 5, candleCount: 6 },
};

export const SYMBOLS = [
  'sun', 'moon', 'salt', 'sulphur', 'mercury', 'star', 'eye', 'serpent',
] as const;
export type GlyphSymbol = (typeof SYMBOLS)[number];

export type RoomView =
  | { kind: 'dial'; ring: GlyphSymbol[] }
  | { kind: 'legend'; legend: Record<string, number>; target: number[] }
  | { kind: 'starmap'; nodes: number; edges: [number, number][] }
  | { kind: 'constellation'; nodes: number }
  | { kind: 'verse'; order: number[] }
  | { kind: 'candelabra'; count: number };

export type Solution =
  | { kind: 'dial'; positions: number[] }
  | { kind: 'constellation'; edges: [number, number][] }
  | { kind: 'candle'; order: number[] };

export type PuzzleState =
  | { kind: 'dial'; pos: number; entered: number[] }
  | { kind: 'constellation'; edges: [number, number][] }
  | { kind: 'candle'; lit: number[] };

export type PuzzleEvent =
  | { type: 'dial.set'; value: number }
  | { type: 'dial.commit' }
  | { type: 'dial.clear' }
  | { type: 'constellation.toggle'; a: number; b: number }
  | { type: 'candle.light'; index: number }
  | { type: 'candle.reset' };

export interface LodgeEvent {
  seq: number;
  puzzleId: string;
  by: Role;
  event: PuzzleEvent;
}

export interface GeneratedPuzzle {
  archetypeId: string;
  clueOwner: Role;
  lockOwner: Role;
  views: Record<Role, RoomView>;
  solution: Solution;
  state: PuzzleState;
}
export interface PuzzleInstance extends GeneratedPuzzle {
  id: string;
  solved: boolean;
}

export interface Run {
  seed: number;
  difficulty: Difficulty;
  puzzles: PuzzleInstance[];
}
export interface RunState {
  run: Run;
  cursor: number;
  solvedCount: number;
  escaped: boolean;
  seq: number;
}

export interface Archetype {
  id: string;
  generate(rng: Rng, difficulty: Difficulty): GeneratedPuzzle;
  reduce(inst: PuzzleInstance, ev: PuzzleEvent): PuzzleInstance;
  isSolved(inst: PuzzleInstance): boolean;
  solutionEvents(inst: PuzzleInstance): PuzzleEvent[];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lodge-types.test.ts`
Expected: PASS (3 tests). The `import type { Rng } from './seed'` is type-only; it compiles even before `seed.ts` exists under `isolatedModules`/bundler resolution, but if your runner complains, create `seed.ts` first (Task 2) — they can be authored in either order. Prefer doing Task 1 then Task 2 back-to-back.

- [ ] **Step 5: Commit**

```bash
git add src/games/lodge/engine/types.ts tests/lodge-types.test.ts
git commit -m "feat(lodge): engine core types + archetype contract" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: RNG & pure helpers

**Files:**
- Create: `src/games/lodge/engine/seed.ts`, `src/games/lodge/engine/util.ts`
- Test: `tests/lodge-seed.test.ts`

**Interfaces:**
- Consumes: `Role`, `ROLES` from `types.ts`.
- Produces:
  - `seed.ts`: `type Rng = () => number`, `makeRng(seed: number): Rng`, `randInt(rng: Rng, n: number): number`, `pick<T>(rng: Rng, arr: readonly T[]): T`, `shuffle<T>(rng: Rng, arr: readonly T[]): T[]`.
  - `util.ts`: `arrEq(a: number[], b: number[]): boolean`, `normEdge(a: number, b: number): [number, number]`, `edgeSetEq(x: [number, number][], y: [number, number][]): boolean`, `fnv1a(s: string): number`, `chooseOwners(rng: Rng): { clueOwner: Role; lockOwner: Role }`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/lodge-seed.test.ts
import { describe, expect, it } from 'vitest';
import { makeRng, randInt, shuffle } from '@/games/lodge/engine/seed';
import { arrEq, normEdge, edgeSetEq, fnv1a, chooseOwners } from '@/games/lodge/engine/util';

describe('makeRng', () => {
  it('is deterministic for a given seed', () => {
    const a = Array.from({ length: 5 }, makeRng(42));
    const b = Array.from({ length: 5 }, makeRng(42));
    expect(a).toEqual(b);
  });

  it('differs across seeds', () => {
    expect(makeRng(1)()).not.toEqual(makeRng(2)());
  });

  it('randInt stays in range', () => {
    const rng = makeRng(7);
    for (let i = 0; i < 50; i++) {
      const n = randInt(rng, 6);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(6);
    }
  });

  it('shuffle is a deterministic permutation', () => {
    const src = [0, 1, 2, 3, 4];
    const s1 = shuffle(makeRng(9), src);
    const s2 = shuffle(makeRng(9), src);
    expect(s1).toEqual(s2);
    expect([...s1].sort()).toEqual(src);
    expect(src).toEqual([0, 1, 2, 3, 4]); // input not mutated
  });
});

describe('util helpers', () => {
  it('arrEq compares by value', () => {
    expect(arrEq([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(arrEq([1, 2], [1, 2, 3])).toBe(false);
  });

  it('normEdge sorts endpoints', () => {
    expect(normEdge(3, 1)).toEqual([1, 3]);
  });

  it('edgeSetEq ignores order and direction', () => {
    expect(edgeSetEq([[0, 1], [2, 3]], [[3, 2], [1, 0]])).toBe(true);
    expect(edgeSetEq([[0, 1]], [[0, 2]])).toBe(false);
  });

  it('fnv1a is stable and sensitive', () => {
    expect(fnv1a('abc')).toBe(fnv1a('abc'));
    expect(fnv1a('abc')).not.toBe(fnv1a('abd'));
  });

  it('chooseOwners always returns distinct roles', () => {
    const rng = makeRng(3);
    for (let i = 0; i < 20; i++) {
      const { clueOwner, lockOwner } = chooseOwners(rng);
      expect(clueOwner).not.toBe(lockOwner);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lodge-seed.test.ts`
Expected: FAIL — cannot resolve `@/games/lodge/engine/seed`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/games/lodge/engine/seed.ts
export type Rng = () => number;

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randInt(rng: Rng, n: number): number {
  return Math.floor(rng() * n);
}

export function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[randInt(rng, arr.length)];
}

export function shuffle<T>(rng: Rng, arr: readonly T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
```

```ts
// src/games/lodge/engine/util.ts
import type { Rng } from './seed';
import type { Role } from './types';

export function arrEq(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function normEdge(a: number, b: number): [number, number] {
  return a <= b ? [a, b] : [b, a];
}

export function edgeSetEq(x: [number, number][], y: [number, number][]): boolean {
  if (x.length !== y.length) return false;
  const key = (e: [number, number]) => normEdge(e[0], e[1]).join('-');
  const sx = new Set(x.map(key));
  return y.every((e) => sx.has(key(e))) && sx.size === new Set(y.map(key)).size;
}

export function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function chooseOwners(rng: Rng): { clueOwner: Role; lockOwner: Role } {
  return rng() < 0.5
    ? { clueOwner: 'B', lockOwner: 'A' }
    : { clueOwner: 'A', lockOwner: 'B' };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lodge-seed.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/games/lodge/engine/seed.ts src/games/lodge/engine/util.ts tests/lodge-seed.test.ts
git commit -m "feat(lodge): mulberry32 rng + pure engine helpers" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Dial ↔ Legend archetype

**Files:**
- Create: `src/games/lodge/engine/archetypes/dial.ts`
- Test: `tests/lodge-dial.test.ts`

**Interfaces:**
- Consumes: `Archetype`, `GeneratedPuzzle`, `PuzzleInstance`, `PuzzleEvent`, `RoomView`, `DIFFICULTY`, `SYMBOLS` from `types.ts`; `shuffle`, `randInt` from `seed.ts`; `arrEq`, `chooseOwners` from `util.ts`.
- Produces: `export const dialArchetype: Archetype` with `id === 'dial'`. Lock holder sees `{ kind: 'dial' }`; clue holder sees `{ kind: 'legend' }`. Solution kind `'dial'` with `positions: number[]` (indices into the lock holder's `ring`).

- [ ] **Step 1: Write the failing test**

```ts
// tests/lodge-dial.test.ts
import { describe, expect, it } from 'vitest';
import { makeRng } from '@/games/lodge/engine/seed';
import { dialArchetype } from '@/games/lodge/engine/archetypes/dial';
import type { PuzzleInstance } from '@/games/lodge/engine/types';

function instance(seed: number): PuzzleInstance {
  const gen = dialArchetype.generate(makeRng(seed), 'standard');
  return { ...gen, id: 'p0', solved: false };
}

describe('dialArchetype', () => {
  it('generate is deterministic', () => {
    expect(dialArchetype.generate(makeRng(5), 'standard'))
      .toEqual(dialArchetype.generate(makeRng(5), 'standard'));
  });

  it('lock and clue owners are distinct, with matching views', () => {
    const g = dialArchetype.generate(makeRng(1), 'standard');
    expect(g.clueOwner).not.toBe(g.lockOwner);
    expect(g.views[g.lockOwner].kind).toBe('dial');
    expect(g.views[g.clueOwner].kind).toBe('legend');
  });

  it('canonical solutionEvents solve the puzzle', () => {
    const inst = instance(13);
    let cur = inst;
    for (const ev of dialArchetype.solutionEvents(inst)) cur = dialArchetype.reduce(cur, ev);
    expect(dialArchetype.isSolved(cur)).toBe(true);
  });

  it('wrong sequence is not solved', () => {
    const inst = instance(13);
    const cur = dialArchetype.reduce(
      dialArchetype.reduce(inst, { type: 'dial.set', value: 999 }),
      { type: 'dial.commit' },
    );
    expect(dialArchetype.isSolved(cur)).toBe(false);
  });

  it('dial.clear resets entered progress', () => {
    const inst = instance(13);
    const a = dialArchetype.reduce(inst, { type: 'dial.set', value: 0 });
    const b = dialArchetype.reduce(a, { type: 'dial.commit' });
    const c = dialArchetype.reduce(b, { type: 'dial.clear' });
    expect(c.state).toEqual({ kind: 'dial', pos: 0, entered: [] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lodge-dial.test.ts`
Expected: FAIL — cannot resolve `@/games/lodge/engine/archetypes/dial`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/games/lodge/engine/archetypes/dial.ts
import type {
  Archetype, GeneratedPuzzle, PuzzleEvent, PuzzleInstance, RoomView, Role,
} from '../types';
import { SYMBOLS, DIFFICULTY } from '../types';
import { shuffle, randInt } from '../seed';
import { arrEq, chooseOwners } from '../util';

export const dialArchetype: Archetype = {
  id: 'dial',

  generate(rng, difficulty): GeneratedPuzzle {
    const { dialLen } = DIFFICULTY[difficulty];
    const { clueOwner, lockOwner } = chooseOwners(rng);

    const ringSize = Math.max(dialLen + 2, 5);
    const ring = shuffle(rng, SYMBOLS).slice(0, ringSize);

    const digits = shuffle(rng, ring.map((_, i) => i));
    const legend: Record<string, number> = {};
    ring.forEach((s, i) => { legend[s] = digits[i]; });

    const positions: number[] = [];
    for (let k = 0; k < dialLen; k++) positions.push(randInt(rng, ring.length));
    const target = positions.map((pos) => legend[ring[pos]]);

    const views = {} as Record<Role, RoomView>;
    views[lockOwner] = { kind: 'dial', ring };
    views[clueOwner] = { kind: 'legend', legend, target };

    return {
      archetypeId: 'dial',
      clueOwner,
      lockOwner,
      views,
      solution: { kind: 'dial', positions },
      state: { kind: 'dial', pos: 0, entered: [] },
    };
  },

  reduce(inst, ev): PuzzleInstance {
    if (inst.state.kind !== 'dial') return inst;
    const st = inst.state;
    if (ev.type === 'dial.set') return { ...inst, state: { ...st, pos: ev.value } };
    if (ev.type === 'dial.commit') return { ...inst, state: { ...st, entered: [...st.entered, st.pos] } };
    if (ev.type === 'dial.clear') return { ...inst, state: { kind: 'dial', pos: 0, entered: [] } };
    return inst;
  },

  isSolved(inst): boolean {
    if (inst.solution.kind !== 'dial' || inst.state.kind !== 'dial') return false;
    return arrEq(inst.state.entered, inst.solution.positions);
  },

  solutionEvents(inst): PuzzleEvent[] {
    if (inst.solution.kind !== 'dial') return [];
    const evs: PuzzleEvent[] = [];
    for (const pos of inst.solution.positions) {
      evs.push({ type: 'dial.set', value: pos });
      evs.push({ type: 'dial.commit' });
    }
    return evs;
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lodge-dial.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/games/lodge/engine/archetypes/dial.ts tests/lodge-dial.test.ts
git commit -m "feat(lodge): dial-legend puzzle archetype" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Star-map ↔ Constellation archetype

**Files:**
- Create: `src/games/lodge/engine/archetypes/constellation.ts`
- Test: `tests/lodge-constellation.test.ts`

**Interfaces:**
- Consumes: same `types.ts`/`seed.ts`/`util.ts` exports as Task 3, plus `normEdge`, `edgeSetEq` from `util.ts`.
- Produces: `export const constellationArchetype: Archetype` with `id === 'constellation'`. Clue holder sees `{ kind: 'starmap' }` (the edges to connect); lock holder sees `{ kind: 'constellation' }` (the pluggable board). Solution kind `'constellation'` with `edges: [number, number][]`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/lodge-constellation.test.ts
import { describe, expect, it } from 'vitest';
import { makeRng } from '@/games/lodge/engine/seed';
import { constellationArchetype as arch } from '@/games/lodge/engine/archetypes/constellation';
import type { PuzzleInstance } from '@/games/lodge/engine/types';

function instance(seed: number): PuzzleInstance {
  const gen = arch.generate(makeRng(seed), 'standard');
  return { ...gen, id: 'p0', solved: false };
}

describe('constellationArchetype', () => {
  it('generate is deterministic', () => {
    expect(arch.generate(makeRng(2), 'standard')).toEqual(arch.generate(makeRng(2), 'standard'));
  });

  it('clue holder sees starmap, lock holder sees board, owners distinct', () => {
    const g = arch.generate(makeRng(4), 'standard');
    expect(g.clueOwner).not.toBe(g.lockOwner);
    expect(g.views[g.clueOwner].kind).toBe('starmap');
    expect(g.views[g.lockOwner].kind).toBe('constellation');
  });

  it('canonical solutionEvents solve the puzzle', () => {
    const inst = instance(21);
    let cur = inst;
    for (const ev of arch.solutionEvents(inst)) cur = arch.reduce(cur, ev);
    expect(arch.isSolved(cur)).toBe(true);
  });

  it('toggling an edge twice removes it (not solved)', () => {
    const inst = instance(21);
    const evs = arch.solutionEvents(inst);
    let cur = inst;
    for (const ev of evs) cur = arch.reduce(cur, ev);
    cur = arch.reduce(cur, evs[0]); // toggle first solution edge off again
    expect(arch.isSolved(cur)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lodge-constellation.test.ts`
Expected: FAIL — cannot resolve the module.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/games/lodge/engine/archetypes/constellation.ts
import type {
  Archetype, GeneratedPuzzle, PuzzleEvent, PuzzleInstance, RoomView, Role,
} from '../types';
import { DIFFICULTY } from '../types';
import { shuffle } from '../seed';
import { chooseOwners, normEdge, edgeSetEq } from '../util';

const NODES = 6;

export const constellationArchetype: Archetype = {
  id: 'constellation',

  generate(rng, difficulty): GeneratedPuzzle {
    const { starEdges } = DIFFICULTY[difficulty];
    const { clueOwner, lockOwner } = chooseOwners(rng);

    const all: [number, number][] = [];
    for (let i = 0; i < NODES; i++) {
      for (let j = i + 1; j < NODES; j++) all.push([i, j]);
    }
    const edges = shuffle(rng, all).slice(0, starEdges);

    const views = {} as Record<Role, RoomView>;
    views[clueOwner] = { kind: 'starmap', nodes: NODES, edges };
    views[lockOwner] = { kind: 'constellation', nodes: NODES };

    return {
      archetypeId: 'constellation',
      clueOwner,
      lockOwner,
      views,
      solution: { kind: 'constellation', edges },
      state: { kind: 'constellation', edges: [] },
    };
  },

  reduce(inst, ev): PuzzleInstance {
    if (inst.state.kind !== 'constellation') return inst;
    if (ev.type !== 'constellation.toggle') return inst;
    const e = normEdge(ev.a, ev.b);
    const has = inst.state.edges.some((x) => x[0] === e[0] && x[1] === e[1]);
    const edges = has
      ? inst.state.edges.filter((x) => !(x[0] === e[0] && x[1] === e[1]))
      : [...inst.state.edges, e];
    return { ...inst, state: { kind: 'constellation', edges } };
  },

  isSolved(inst): boolean {
    if (inst.solution.kind !== 'constellation' || inst.state.kind !== 'constellation') return false;
    return edgeSetEq(inst.state.edges, inst.solution.edges);
  },

  solutionEvents(inst): PuzzleEvent[] {
    if (inst.solution.kind !== 'constellation') return [];
    return inst.solution.edges.map((e) => ({ type: 'constellation.toggle', a: e[0], b: e[1] }));
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lodge-constellation.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/games/lodge/engine/archetypes/constellation.ts tests/lodge-constellation.test.ts
git commit -m "feat(lodge): starmap-constellation puzzle archetype" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Verse ↔ Candelabra archetype

**Files:**
- Create: `src/games/lodge/engine/archetypes/candle.ts`
- Test: `tests/lodge-candle.test.ts`

**Interfaces:**
- Consumes: `types.ts`/`seed.ts`/`util.ts` (`shuffle`, `arrEq`, `chooseOwners`).
- Produces: `export const candleArchetype: Archetype` with `id === 'candle'`. Clue holder sees `{ kind: 'verse'; order }`; lock holder sees `{ kind: 'candelabra'; count }`. Solution kind `'candle'` with `order: number[]`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/lodge-candle.test.ts
import { describe, expect, it } from 'vitest';
import { makeRng } from '@/games/lodge/engine/seed';
import { candleArchetype as arch } from '@/games/lodge/engine/archetypes/candle';
import type { PuzzleInstance } from '@/games/lodge/engine/types';

function instance(seed: number): PuzzleInstance {
  const gen = arch.generate(makeRng(seed), 'standard');
  return { ...gen, id: 'p0', solved: false };
}

describe('candleArchetype', () => {
  it('generate is deterministic', () => {
    expect(arch.generate(makeRng(8), 'standard')).toEqual(arch.generate(makeRng(8), 'standard'));
  });

  it('clue holder reads verse, lock holder holds candelabra, owners distinct', () => {
    const g = arch.generate(makeRng(6), 'standard');
    expect(g.clueOwner).not.toBe(g.lockOwner);
    expect(g.views[g.clueOwner].kind).toBe('verse');
    expect(g.views[g.lockOwner].kind).toBe('candelabra');
  });

  it('lighting in the verse order solves it', () => {
    const inst = instance(33);
    let cur = inst;
    for (const ev of arch.solutionEvents(inst)) cur = arch.reduce(cur, ev);
    expect(arch.isSolved(cur)).toBe(true);
  });

  it('candle.reset clears progress', () => {
    const inst = instance(33);
    const a = arch.reduce(inst, { type: 'candle.light', index: 0 });
    const b = arch.reduce(a, { type: 'candle.reset' });
    expect(b.state).toEqual({ kind: 'candle', lit: [] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lodge-candle.test.ts`
Expected: FAIL — cannot resolve the module.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/games/lodge/engine/archetypes/candle.ts
import type {
  Archetype, GeneratedPuzzle, PuzzleEvent, PuzzleInstance, RoomView, Role,
} from '../types';
import { DIFFICULTY } from '../types';
import { shuffle } from '../seed';
import { arrEq, chooseOwners } from '../util';

export const candleArchetype: Archetype = {
  id: 'candle',

  generate(rng, difficulty): GeneratedPuzzle {
    const { candleCount } = DIFFICULTY[difficulty];
    const { clueOwner, lockOwner } = chooseOwners(rng);
    const order = shuffle(rng, Array.from({ length: candleCount }, (_, i) => i));

    const views = {} as Record<Role, RoomView>;
    views[clueOwner] = { kind: 'verse', order };
    views[lockOwner] = { kind: 'candelabra', count: candleCount };

    return {
      archetypeId: 'candle',
      clueOwner,
      lockOwner,
      views,
      solution: { kind: 'candle', order },
      state: { kind: 'candle', lit: [] },
    };
  },

  reduce(inst, ev): PuzzleInstance {
    if (inst.state.kind !== 'candle') return inst;
    if (ev.type === 'candle.light') return { ...inst, state: { kind: 'candle', lit: [...inst.state.lit, ev.index] } };
    if (ev.type === 'candle.reset') return { ...inst, state: { kind: 'candle', lit: [] } };
    return inst;
  },

  isSolved(inst): boolean {
    if (inst.solution.kind !== 'candle' || inst.state.kind !== 'candle') return false;
    return arrEq(inst.state.lit, inst.solution.order);
  },

  solutionEvents(inst): PuzzleEvent[] {
    if (inst.solution.kind !== 'candle') return [];
    return inst.solution.order.map((i) => ({ type: 'candle.light', index: i }));
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lodge-candle.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/games/lodge/engine/archetypes/candle.ts tests/lodge-candle.test.ts
git commit -m "feat(lodge): verse-candelabra puzzle archetype" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Archetype registry

**Files:**
- Create: `src/games/lodge/engine/archetypes/index.ts`
- Test: `tests/lodge-registry.test.ts`

**Interfaces:**
- Consumes: `dialArchetype`, `constellationArchetype`, `candleArchetype`; `Archetype` type.
- Produces: `ARCHETYPES: Record<string, Archetype>` and `ARCHETYPE_IDS: string[]`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/lodge-registry.test.ts
import { describe, expect, it } from 'vitest';
import { makeRng } from '@/games/lodge/engine/seed';
import { ARCHETYPES, ARCHETYPE_IDS } from '@/games/lodge/engine/archetypes';

describe('archetype registry', () => {
  it('contains the three stage-0 archetypes, each keyed by its id', () => {
    expect(ARCHETYPE_IDS.sort()).toEqual(['candle', 'constellation', 'dial']);
    for (const id of ARCHETYPE_IDS) expect(ARCHETYPES[id].id).toBe(id);
  });

  it('every archetype round-trips: generate → solutionEvents → solved', () => {
    for (const id of ARCHETYPE_IDS) {
      const arch = ARCHETYPES[id];
      for (let seed = 0; seed < 30; seed++) {
        const gen = arch.generate(makeRng(seed), 'standard');
        const inst = { ...gen, id: 'p0', solved: false };
        let cur = inst;
        for (const ev of arch.solutionEvents(inst)) cur = arch.reduce(cur, ev);
        expect(arch.isSolved(cur)).toBe(true);
        expect(gen.clueOwner).not.toBe(gen.lockOwner);
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lodge-registry.test.ts`
Expected: FAIL — cannot resolve `@/games/lodge/engine/archetypes`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/games/lodge/engine/archetypes/index.ts
import type { Archetype } from '../types';
import { dialArchetype } from './dial';
import { constellationArchetype } from './constellation';
import { candleArchetype } from './candle';

export const ARCHETYPES: Record<string, Archetype> = {
  dial: dialArchetype,
  constellation: constellationArchetype,
  candle: candleArchetype,
};

export const ARCHETYPE_IDS: string[] = Object.keys(ARCHETYPES);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lodge-registry.test.ts`
Expected: PASS (2 tests, 90+ assertions).

- [ ] **Step 5: Commit**

```bash
git add src/games/lodge/engine/archetypes/index.ts tests/lodge-registry.test.ts
git commit -m "feat(lodge): archetype registry + round-trip coverage" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Run generation

**Files:**
- Create: `src/games/lodge/engine/generate.ts`
- Test: `tests/lodge-generate.test.ts`

**Interfaces:**
- Consumes: `makeRng`, `shuffle` from `seed.ts`; `ARCHETYPES`, `ARCHETYPE_IDS` from `archetypes`; `Run`, `Difficulty`, `PuzzleInstance` from `types.ts`.
- Produces: `interface RunConfig { difficulty?: Difficulty; archetypeIds?: string[] }`, `createRun(seed: number, config?: RunConfig): Run`. Puzzle ids are `p0`, `p1`, … in chain order. Default chain is a seed-shuffled permutation of all `ARCHETYPE_IDS`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/lodge-generate.test.ts
import { describe, expect, it } from 'vitest';
import { createRun } from '@/games/lodge/engine/generate';

describe('createRun', () => {
  it('is deterministic for a given seed', () => {
    expect(createRun(123)).toEqual(createRun(123));
  });

  it('uses every archetype once, with unique sequential ids', () => {
    const run = createRun(123);
    expect(run.puzzles.map((p) => p.id)).toEqual(['p0', 'p1', 'p2']);
    expect(new Set(run.puzzles.map((p) => p.archetypeId)).size).toBe(3);
  });

  it('respects an explicit archetype chain', () => {
    const run = createRun(1, { archetypeIds: ['candle', 'dial'] });
    expect(run.puzzles.map((p) => p.archetypeId)).toEqual(['candle', 'dial']);
  });

  it('every puzzle starts unsolved and asymmetric', () => {
    const run = createRun(77, { difficulty: 'devious' });
    for (const p of run.puzzles) {
      expect(p.solved).toBe(false);
      expect(p.clueOwner).not.toBe(p.lockOwner);
    }
    expect(run.difficulty).toBe('devious');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lodge-generate.test.ts`
Expected: FAIL — cannot resolve `@/games/lodge/engine/generate`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/games/lodge/engine/generate.ts
import { makeRng, shuffle } from './seed';
import { ARCHETYPES, ARCHETYPE_IDS } from './archetypes';
import type { Run, Difficulty, PuzzleInstance } from './types';

export interface RunConfig {
  difficulty?: Difficulty;
  archetypeIds?: string[];
}

export function createRun(seed: number, config: RunConfig = {}): Run {
  const difficulty = config.difficulty ?? 'standard';
  const rng = makeRng(seed);
  const ids = config.archetypeIds ?? shuffle(rng, ARCHETYPE_IDS);

  const puzzles: PuzzleInstance[] = ids.map((aid, i) => {
    const gen = ARCHETYPES[aid].generate(rng, difficulty);
    return { ...gen, id: `p${i}`, solved: false };
  });

  return { seed, difficulty, puzzles };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lodge-generate.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/games/lodge/engine/generate.ts tests/lodge-generate.test.ts
git commit -m "feat(lodge): seed-driven run generation" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Event reducer & state hash

**Files:**
- Create: `src/games/lodge/engine/reducer.ts`
- Test: `tests/lodge-reducer.test.ts`

**Interfaces:**
- Consumes: `ARCHETYPES` from `archetypes`; `fnv1a` from `util.ts`; `Run`, `RunState`, `LodgeEvent` from `types.ts`; `createRun` (test only).
- Produces: `initRunState(run: Run): RunState`, `applyEvent(state: RunState, ev: LodgeEvent): RunState`, `hashState(state: RunState): number`. `applyEvent` updates `seq` always; ignores events for unknown or already-solved puzzles; advances `cursor` past solved puzzles; sets `escaped` when all puzzles are solved.

- [ ] **Step 1: Write the failing test**

```ts
// tests/lodge-reducer.test.ts
import { describe, expect, it } from 'vitest';
import { createRun } from '@/games/lodge/engine/generate';
import { initRunState, applyEvent, hashState } from '@/games/lodge/engine/reducer';
import { ARCHETYPES } from '@/games/lodge/engine/archetypes';
import type { RunState } from '@/games/lodge/engine/types';

function solveAll(run = createRun(123)): RunState {
  let state = initRunState(run);
  let seq = 0;
  for (const p of run.puzzles) {
    const live = state.run.puzzles.find((x) => x.id === p.id)!;
    for (const ev of ARCHETYPES[p.archetypeId].solutionEvents(live)) {
      state = applyEvent(state, { seq: ++seq, puzzleId: p.id, by: p.lockOwner, event: ev });
    }
  }
  return state;
}

describe('reducer', () => {
  it('initRunState starts fresh', () => {
    const s = initRunState(createRun(1));
    expect(s).toMatchObject({ cursor: 0, solvedCount: 0, escaped: false, seq: 0 });
  });

  it('threading every solution escapes the run', () => {
    const s = solveAll();
    expect(s.solvedCount).toBe(3);
    expect(s.escaped).toBe(true);
    expect(s.cursor).toBe(3);
  });

  it('updates seq even for an unknown puzzle id', () => {
    const s = initRunState(createRun(1));
    const next = applyEvent(s, { seq: 9, puzzleId: 'nope', by: 'A', event: { type: 'dial.clear' } });
    expect(next.seq).toBe(9);
    expect(next.solvedCount).toBe(0);
  });

  it('hashState is deterministic and changes as state advances', () => {
    const s0 = initRunState(createRun(123));
    const s1 = solveAll();
    expect(hashState(s0)).toBe(hashState(initRunState(createRun(123))));
    expect(hashState(s1)).not.toBe(hashState(s0));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lodge-reducer.test.ts`
Expected: FAIL — cannot resolve `@/games/lodge/engine/reducer`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/games/lodge/engine/reducer.ts
import { ARCHETYPES } from './archetypes';
import { fnv1a } from './util';
import type { Run, RunState, LodgeEvent } from './types';

export function initRunState(run: Run): RunState {
  return { run, cursor: 0, solvedCount: 0, escaped: false, seq: 0 };
}

export function applyEvent(state: RunState, ev: LodgeEvent): RunState {
  const idx = state.run.puzzles.findIndex((p) => p.id === ev.puzzleId);
  if (idx < 0) return { ...state, seq: ev.seq };

  const puzzle = state.run.puzzles[idx];
  if (puzzle.solved) return { ...state, seq: ev.seq };

  const arch = ARCHETYPES[puzzle.archetypeId];
  const reduced = arch.reduce(puzzle, ev.event);
  const solved = arch.isSolved(reduced);
  const nextPuzzle = { ...reduced, solved };

  const puzzles = state.run.puzzles.map((p, i) => (i === idx ? nextPuzzle : p));
  const solvedCount = state.solvedCount + (solved ? 1 : 0);
  const escaped = solvedCount === puzzles.length;

  let cursor = state.cursor;
  while (cursor < puzzles.length && puzzles[cursor].solved) cursor++;

  return { run: { ...state.run, puzzles }, cursor, solvedCount, escaped, seq: ev.seq };
}

export function hashState(state: RunState): number {
  const payload = JSON.stringify({
    seq: state.seq,
    escaped: state.escaped,
    cursor: state.cursor,
    p: state.run.puzzles.map((p) => ({ id: p.id, solved: p.solved, state: p.state })),
  });
  return fnv1a(payload);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lodge-reducer.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/games/lodge/engine/reducer.ts tests/lodge-reducer.test.ts
git commit -m "feat(lodge): event reducer + state hash" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Solvability validator

**Files:**
- Create: `src/games/lodge/engine/validator.ts`
- Test: `tests/lodge-validator.test.ts`

**Interfaces:**
- Consumes: `ARCHETYPES`; `initRunState`, `applyEvent` from `reducer.ts`; `Run` from `types.ts`; `createRun` (test only).
- Produces: `validateRun(run: Run): string[]` — empty array means valid. Checks unique ids, `lockOwner !== clueOwner`, known archetype, that each puzzle's canonical `solutionEvents` actually solve it through the reducer, and that the full run reaches `escaped`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/lodge-validator.test.ts
import { describe, expect, it } from 'vitest';
import { createRun } from '@/games/lodge/engine/generate';
import { validateRun } from '@/games/lodge/engine/validator';

describe('validateRun', () => {
  it('passes for many generated seeds and difficulties', () => {
    for (const difficulty of ['gentle', 'standard', 'devious'] as const) {
      for (let seed = 0; seed < 40; seed++) {
        expect(validateRun(createRun(seed, { difficulty }))).toEqual([]);
      }
    }
  });

  it('flags a broken asymmetry invariant', () => {
    const run = createRun(5);
    run.puzzles[0] = { ...run.puzzles[0], clueOwner: run.puzzles[0].lockOwner };
    expect(validateRun(run).some((m) => m.includes('asymmetry'))).toBe(true);
  });

  it('flags a duplicate puzzle id', () => {
    const run = createRun(5);
    run.puzzles[1] = { ...run.puzzles[1], id: run.puzzles[0].id };
    expect(validateRun(run).some((m) => m.includes('duplicate'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lodge-validator.test.ts`
Expected: FAIL — cannot resolve `@/games/lodge/engine/validator`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/games/lodge/engine/validator.ts
import { ARCHETYPES } from './archetypes';
import { initRunState, applyEvent } from './reducer';
import type { Run } from './types';

export function validateRun(run: Run): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();

  for (const p of run.puzzles) {
    if (seen.has(p.id)) problems.push(`duplicate puzzle id: ${p.id}`);
    seen.add(p.id);
    if (p.clueOwner === p.lockOwner) {
      problems.push(`${p.id}: asymmetry broken — clueOwner === lockOwner`);
    }
    if (!ARCHETYPES[p.archetypeId]) {
      problems.push(`${p.id}: unknown archetype ${p.archetypeId}`);
    }
  }

  let state = initRunState(run);
  let seq = 0;
  for (const p of run.puzzles) {
    const arch = ARCHETYPES[p.archetypeId];
    if (!arch) continue;
    const live = state.run.puzzles.find((x) => x.id === p.id)!;
    for (const ev of arch.solutionEvents(live)) {
      state = applyEvent(state, { seq: ++seq, puzzleId: p.id, by: p.lockOwner, event: ev });
    }
    const after = state.run.puzzles.find((x) => x.id === p.id)!;
    if (!after.solved) problems.push(`${p.id}: canonical solution did not solve the puzzle`);
  }
  if (!state.escaped) problems.push('run not completable: escape never reached');

  return problems;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lodge-validator.test.ts`
Expected: PASS (3 tests, 120+ assertions).

- [ ] **Step 5: Commit**

```bash
git add src/games/lodge/engine/validator.ts tests/lodge-validator.test.ts
git commit -m "feat(lodge): solvability + asymmetry validator" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Public barrel & integration smoke

**Files:**
- Create: `src/games/lodge/engine/index.ts`
- Test: `tests/lodge-engine.test.ts`

**Interfaces:**
- Consumes: all engine modules.
- Produces: a single public entrypoint re-exporting types and `makeRng`, `randInt`, `pick`, `shuffle`, `createRun`, `RunConfig`, `initRunState`, `applyEvent`, `hashState`, `validateRun`, `ARCHETYPES`, `ARCHETYPE_IDS`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/lodge-engine.test.ts
import { describe, expect, it } from 'vitest';
import {
  createRun, validateRun, initRunState, applyEvent, hashState, ARCHETYPES,
} from '@/games/lodge/engine';
import type { RunState } from '@/games/lodge/engine';

describe('lodge engine (public API)', () => {
  it('a generated run is valid and fully solvable end-to-end', () => {
    const run = createRun(2026);
    expect(validateRun(run)).toEqual([]);

    let state: RunState = initRunState(run);
    let seq = 0;
    for (const p of run.puzzles) {
      const live = state.run.puzzles.find((x) => x.id === p.id)!;
      for (const ev of ARCHETYPES[p.archetypeId].solutionEvents(live)) {
        state = applyEvent(state, { seq: ++seq, puzzleId: p.id, by: p.lockOwner, event: ev });
      }
    }
    expect(state.escaped).toBe(true);
  });

  it('two clients on the same seed + event stream converge by hash', () => {
    const seed = 99;
    const runA = createRun(seed);
    const runB = createRun(seed);
    let a = initRunState(runA);
    let b = initRunState(runB);

    const stream = [] as Parameters<typeof applyEvent>[1][];
    let seq = 0;
    for (const p of runA.puzzles) {
      const live = a.run.puzzles.find((x) => x.id === p.id)!;
      for (const ev of ARCHETYPES[p.archetypeId].solutionEvents(live)) {
        stream.push({ seq: ++seq, puzzleId: p.id, by: p.lockOwner, event: ev });
        a = applyEvent(a, stream[stream.length - 1]);
      }
    }
    for (const ev of stream) b = applyEvent(b, ev);

    expect(hashState(a)).toBe(hashState(b));
    expect(a.escaped && b.escaped).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lodge-engine.test.ts`
Expected: FAIL — cannot resolve `@/games/lodge/engine`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/games/lodge/engine/index.ts
export * from './types';
export { makeRng, randInt, pick, shuffle } from './seed';
export { createRun } from './generate';
export type { RunConfig } from './generate';
export { initRunState, applyEvent, hashState } from './reducer';
export { validateRun } from './validator';
export { ARCHETYPES, ARCHETYPE_IDS } from './archetypes';
```

- [ ] **Step 4: Run the full suite + typecheck**

Run: `npx vitest run tests/lodge-engine.test.ts`
Expected: PASS (2 tests).

Run: `npm run typecheck`
Expected: no errors.

Run: `npm test`
Expected: all suites green (the 18 baseline tests plus the new `lodge-*` suites).

- [ ] **Step 5: Commit**

```bash
git add src/games/lodge/engine/index.ts tests/lodge-engine.test.ts
git commit -m "feat(lodge): public engine barrel + integration smoke" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage** (against `2026-06-23-zerkalnaya-lozha-design.md`):
- Секция 2 raskладка (`types`, `seed`, `archetypes/`, `generate`, `reducer`, `validator`, `index`) — Tasks 1–10 create every listed file. ✔
- Archetype contract (`generate`/`reduce`/`isSolved` + `solutionEvents` for solvability) — Task 1 defines it, Tasks 3–5 implement it. ✔
- Three starter archetypes (dial↔legend, constellation, candle) — Tasks 3, 4, 5. ✔
- Determinism + sync contract (same seed → identical run; shared reducer over ordered events → convergence) — Task 7 determinism test, Task 10 two-client hash-convergence test. ✔
- Validator: `lockOwner ≠ clueOwner`, derivable solution, chain completable, no soft-locks — Task 9. ✔
- `stateHash` for the later desync guard (Секция 3) — Task 8 `hashState`. ✔
- Out of scope here (R3F, Supabase Realtime, lobby, UI) — correctly deferred to Этапы 1–3; not in this plan. ✔

**2. Placeholder scan:** no `TBD`/`TODO`/"add error handling"/"similar to Task N"; every code step shows full code; every run step shows the exact command and expected result. ✔

**3. Type consistency:** `Rng`, `Role`, `RoomView`, `Solution`, `PuzzleState`, `PuzzleEvent`, `LodgeEvent`, `GeneratedPuzzle`, `PuzzleInstance`, `Run`, `RunState`, `Archetype`, `RunConfig` are defined in Tasks 1/7 and consumed with identical names/shapes downstream. Archetype objects expose exactly `id`/`generate`/`reduce`/`isSolved`/`solutionEvents`. `createRun`, `initRunState`, `applyEvent`, `hashState`, `validateRun`, `ARCHETYPES`, `ARCHETYPE_IDS` names match across producer and consumer tasks and the barrel. ✔

---

## Notes for the implementer

- Author Task 1 (`types.ts`) and Task 2 (`seed.ts`/`util.ts`) close together: `types.ts` has a type-only import of `Rng` from `seed.ts`, and `util.ts` imports `Role` from `types.ts`. None of these are runtime cycles.
- Keep every engine file free of React/DOM/network imports — that boundary is what lets Этап 2 reuse this module verbatim on both clients.
- Run `npm test` once at the end to confirm the new `lodge-*` suites sit green alongside the existing 18 baseline tests.
