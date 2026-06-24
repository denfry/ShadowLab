# Зеркальная Ложа — Этап 1 (вертикальный 3D-срез) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an isolated dev harness that renders all three lodge puzzle archetypes in 3D (React Three Fiber), drives them through the Этап-0 engine via a Zustand store, and lets you solve a generated run by hand up to the `escaped` banner.

**Architecture:** A thin R3F view layer over the pure engine. The only non-trivial UI logic lives in pure adapters (`RoomView + PuzzleState → render props`) and a Zustand store wrapping `applyEvent` — both unit-tested. R3F station components consume those tested layers and map pointer clicks to `PuzzleEvent`s. The harness mounts on a DEV-only route `/dev/lodge`; the portal catalog and `GameId` union are untouched.

**Tech Stack:** React 18, Vite 5, Zustand (already present), TypeScript strict, Vitest. New: `three`, `@react-three/fiber` (v8), `@react-three/drei` (v9).

## Global Constraints

- **Engine is source of truth:** UI never re-implements puzzle rules; it reads `RunState` and sends `PuzzleEvent`s through the store's `dispatch` (which wraps `applyEvent`). No engine imports of React/DOM are introduced.
- **R3F version line:** `@react-three/fiber` **v8** (React-18 line) — NOT v9 (needs React 19). `@react-three/drei` **v9**. Install all three packages together so peer deps resolve.
- **Isolation:** no changes to `src/types/game-module.ts` (`GameId`/`GameTheme`), no `GameRegistry` entry, no portal catalog. The harness is reachable only via the DEV-guarded `/dev/lodge` route and is tree-shaken from production builds.
- **Lazy 3D:** R3F/three load only inside the lazy harness chunk + the `three` manualChunk; the main portal bundle must not grow.
- **Tests:** Vitest files `tests/lodge-*.test.ts` via the `@/` alias. R3F/WebGL views are NOT unit-tested — their logic lives in the tested adapters/store; behavior is checked once by a manual smoke (Task 10).
- **TypeScript strict** (incl. `noFallthroughCasesInSwitch`). Typecheck: `npm run typecheck`.
- **R3F JSX intrinsics** (`<mesh>`, `<cylinderGeometry>`, …) come from `@react-three/fiber`'s global JSX augmentation, loaded transitively because scene/station files import from `@react-three/fiber`/`@react-three/drei`. If a primitive-only file errors on intrinsic elements, add `import '@react-three/fiber';` at its top.
- **Commits:** Conventional Commits, scope `lodge`. Every commit ends with a second `-m` paragraph: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## File Structure

- `src/games/lodge/ui/adapters/dial.ts` · `constellation.ts` · `candle.ts` — pure `view+state → render props` (tested).
- `src/games/lodge/ui/store/useLodgeStore.ts` — Zustand bridge over the engine (tested).
- `src/games/lodge/ui/scene/stations/types.ts` — shared `StationProps`.
- `src/games/lodge/ui/scene/stations/DialStation.tsx` · `ConstellationStation.tsx` · `CandelabraStation.tsx` — R3F station renderers.
- `src/games/lodge/ui/scene/stations/registry.ts` — `stationFor(kind)`.
- `src/games/lodge/ui/scene/LodgeScene.tsx` — `<Canvas>`, lights, room, slots, camera focus.
- `src/games/lodge/ui/hud/LodgeHud.tsx` — overlay.
- `src/games/lodge/dev/DevPanel.tsx` — seed/difficulty/clue/auto-solve panel.
- `src/games/lodge/dev/LodgeDevHarness.tsx` — default-export composite (lazy target).
- `src/app/router.tsx` — add DEV-guarded `/dev/lodge` route.
- `vite.config.ts` — add `three` manualChunk.
- Tests: `tests/lodge-adapters.test.ts`, `tests/lodge-store.test.ts`.

---

## Task 1: Dependencies + lazy chunk

**Files:**
- Modify: `package.json` (deps), `vite.config.ts:14-21`

**Interfaces:**
- Consumes: nothing.
- Produces: `three`, `@react-three/fiber`, `@react-three/drei` installed; a `three` manualChunk.

- [ ] **Step 1: Install the R3F stack (v8 line)**

Run:
```bash
npm install three@^0.169.0 @react-three/fiber@^8 @react-three/drei@^9
```
Expected: installs without peer-dependency errors. (fiber v8 + drei v9 both target React 18.)

- [ ] **Step 2: Add a `three` manualChunk**

In `vite.config.ts`, change the `manualChunks` object to:
```ts
        manualChunks: {
          phaser: ['phaser'],
          three: ['three', '@react-three/fiber', '@react-three/drei'],
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
```

- [ ] **Step 3: Verify the baseline is still green**

Run: `npm run typecheck`
Expected: no errors.

Run: `npm test`
Expected: 58 passed (the Этап-0 suite is unaffected).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json vite.config.ts
git commit -m "build(lodge): add react-three-fiber stack + three chunk" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Pure render adapters

**Files:**
- Create: `src/games/lodge/ui/adapters/dial.ts`, `src/games/lodge/ui/adapters/constellation.ts`, `src/games/lodge/ui/adapters/candle.ts`
- Test: `tests/lodge-adapters.test.ts`

**Interfaces:**
- Consumes: `RoomView`, `PuzzleState` from `@/games/lodge/engine`.
- Produces:
  - `dialProps(view, state): { ringLabels: string[]; pointerAngleRad: number; enteredLabels: string[] }`
  - `constellationProps(view, state): { nodePositions: [number, number][]; edges: [number, number][] }`
  - `candleProps(view, state): { lit: boolean[]; positions: number[] }`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lodge-adapters.test.ts
import { describe, expect, it } from 'vitest';
import { dialProps } from '@/games/lodge/ui/adapters/dial';
import { constellationProps } from '@/games/lodge/ui/adapters/constellation';
import { candleProps } from '@/games/lodge/ui/adapters/candle';

describe('dialProps', () => {
  it('maps pos to a rotation angle and entered indices to labels', () => {
    const view = { kind: 'dial', ring: ['sun', 'moon', 'star', 'eye'] } as const;
    const state = { kind: 'dial', pos: 1, entered: [0, 2] } as const;
    const p = dialProps(view, state);
    expect(p.ringLabels).toEqual(['sun', 'moon', 'star', 'eye']);
    expect(p.pointerAngleRad).toBeCloseTo((1 / 4) * Math.PI * 2);
    expect(p.enteredLabels).toEqual(['sun', 'star']);
  });
});

describe('constellationProps', () => {
  it('places nodes on a unit circle and passes edges through', () => {
    const view = { kind: 'constellation', nodes: 4 } as const;
    const state = { kind: 'constellation', edges: [[0, 2]] as [number, number][] } as const;
    const p = constellationProps(view, state);
    expect(p.nodePositions).toHaveLength(4);
    for (const [x, y] of p.nodePositions) expect(Math.hypot(x, y)).toBeCloseTo(1);
    expect(p.edges).toEqual([[0, 2]]);
  });
});

describe('candleProps', () => {
  it('flags lit candles and centers positions', () => {
    const view = { kind: 'candelabra', count: 4 } as const;
    const state = { kind: 'candle', lit: [0, 2] } as const;
    const p = candleProps(view, state);
    expect(p.lit).toEqual([true, false, true, false]);
    expect(p.positions).toEqual([-1.5, -0.5, 0.5, 1.5]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lodge-adapters.test.ts`
Expected: FAIL — cannot resolve the adapter modules.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/games/lodge/ui/adapters/dial.ts
import type { RoomView, PuzzleState } from '@/games/lodge/engine';

export interface DialProps {
  ringLabels: string[];
  pointerAngleRad: number;
  enteredLabels: string[];
}

export function dialProps(
  view: Extract<RoomView, { kind: 'dial' }>,
  state: Extract<PuzzleState, { kind: 'dial' }>,
): DialProps {
  const n = view.ring.length;
  return {
    ringLabels: [...view.ring],
    pointerAngleRad: n === 0 ? 0 : (state.pos / n) * Math.PI * 2,
    enteredLabels: state.entered.map((i) => view.ring[i]),
  };
}
```

```ts
// src/games/lodge/ui/adapters/constellation.ts
import type { RoomView, PuzzleState } from '@/games/lodge/engine';

export interface ConstellationProps {
  nodePositions: [number, number][];
  edges: [number, number][];
}

export function constellationProps(
  view: Extract<RoomView, { kind: 'constellation' }>,
  state: Extract<PuzzleState, { kind: 'constellation' }>,
): ConstellationProps {
  const n = view.nodes;
  const nodePositions: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    nodePositions.push([Math.cos(a), Math.sin(a)]);
  }
  return { nodePositions, edges: state.edges.map((e) => [e[0], e[1]]) };
}
```

```ts
// src/games/lodge/ui/adapters/candle.ts
import type { RoomView, PuzzleState } from '@/games/lodge/engine';

export interface CandleProps {
  lit: boolean[];
  positions: number[];
}

export function candleProps(
  view: Extract<RoomView, { kind: 'candelabra' }>,
  state: Extract<PuzzleState, { kind: 'candle' }>,
): CandleProps {
  const count = view.count;
  const litSet = new Set(state.lit);
  const lit: boolean[] = [];
  const positions: number[] = [];
  for (let i = 0; i < count; i++) {
    lit.push(litSet.has(i));
    positions.push(i - (count - 1) / 2);
  }
  return { lit, positions };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lodge-adapters.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/games/lodge/ui/adapters tests/lodge-adapters.test.ts
git commit -m "feat(lodge): pure render adapters for the three archetypes" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Zustand store bridge

**Files:**
- Create: `src/games/lodge/ui/store/useLodgeStore.ts`
- Test: `tests/lodge-store.test.ts`

**Interfaces:**
- Consumes: `createRun`, `initRunState`, `applyEvent`, `ARCHETYPES`, types `RunState`/`Difficulty`/`Role`/`PuzzleEvent` from `@/games/lodge/engine`; `create` from `zustand`.
- Produces: `useLodgeStore` with state `{ runState, seed, difficulty, selectedPuzzleId }` and actions `regenerate(seed, difficulty)`, `select(puzzleId|null)`, `dispatch(puzzleId, by, event)`, `autoSolve(puzzleId)`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/lodge-store.test.ts
import { describe, expect, it, beforeEach } from 'vitest';
import { useLodgeStore } from '@/games/lodge/ui/store/useLodgeStore';
import { validateRun } from '@/games/lodge/engine';

beforeEach(() => useLodgeStore.getState().regenerate(123, 'standard'));

describe('useLodgeStore', () => {
  it('regenerate yields a valid run and selects the first puzzle', () => {
    const s = useLodgeStore.getState();
    expect(validateRun(s.runState.run)).toEqual([]);
    expect(s.selectedPuzzleId).toBe('p0');
    expect(s.runState.escaped).toBe(false);
  });

  it('dispatch advances seq', () => {
    const before = useLodgeStore.getState().runState.seq;
    useLodgeStore.getState().dispatch('p0', 'A', { type: 'dial.clear' });
    expect(useLodgeStore.getState().runState.seq).toBe(before + 1);
  });

  it('autoSolve on every puzzle reaches escaped', () => {
    for (const p of useLodgeStore.getState().runState.run.puzzles) {
      useLodgeStore.getState().autoSolve(p.id);
    }
    expect(useLodgeStore.getState().runState.escaped).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lodge-store.test.ts`
Expected: FAIL — cannot resolve `@/games/lodge/ui/store/useLodgeStore`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/games/lodge/ui/store/useLodgeStore.ts
import { create } from 'zustand';
import {
  createRun,
  initRunState,
  applyEvent,
  ARCHETYPES,
  type RunState,
  type Difficulty,
  type Role,
  type PuzzleEvent,
} from '@/games/lodge/engine';

export interface LodgeStore {
  runState: RunState;
  seed: number;
  difficulty: Difficulty;
  selectedPuzzleId: string | null;
  regenerate: (seed: number, difficulty: Difficulty) => void;
  select: (puzzleId: string | null) => void;
  dispatch: (puzzleId: string, by: Role, event: PuzzleEvent) => void;
  autoSolve: (puzzleId: string) => void;
}

const DEFAULT_SEED = 1;
const DEFAULT_DIFFICULTY: Difficulty = 'standard';

function freshState(seed: number, difficulty: Difficulty): RunState {
  return initRunState(createRun(seed, { difficulty }));
}

const INITIAL = freshState(DEFAULT_SEED, DEFAULT_DIFFICULTY);

export const useLodgeStore = create<LodgeStore>((set, get) => ({
  runState: INITIAL,
  seed: DEFAULT_SEED,
  difficulty: DEFAULT_DIFFICULTY,
  selectedPuzzleId: INITIAL.run.puzzles[0]?.id ?? null,

  regenerate(seed, difficulty) {
    const runState = freshState(seed, difficulty);
    set({ runState, seed, difficulty, selectedPuzzleId: runState.run.puzzles[0]?.id ?? null });
  },

  select(puzzleId) {
    set({ selectedPuzzleId: puzzleId });
  },

  dispatch(puzzleId, by, event) {
    const { runState } = get();
    set({ runState: applyEvent(runState, { seq: runState.seq + 1, puzzleId, by, event }) });
  },

  autoSolve(puzzleId) {
    const puzzle = get().runState.run.puzzles.find((p) => p.id === puzzleId);
    if (!puzzle) return;
    for (const ev of ARCHETYPES[puzzle.archetypeId].solutionEvents(puzzle)) {
      get().dispatch(puzzleId, puzzle.lockOwner, ev);
    }
  },
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lodge-store.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/games/lodge/ui/store/useLodgeStore.ts tests/lodge-store.test.ts
git commit -m "feat(lodge): zustand store bridging the engine" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Station shared type + DialStation

**Files:**
- Create: `src/games/lodge/ui/scene/stations/types.ts`, `src/games/lodge/ui/scene/stations/DialStation.tsx`

**Interfaces:**
- Consumes: `dialProps` (Task 2); types `PuzzleInstance`/`PuzzleEvent`/`Role` from engine; `Text` from `@react-three/drei`.
- Produces: `StationProps` (`{ puzzle: PuzzleInstance; dispatch: (puzzleId: string, by: Role, event: PuzzleEvent) => void }`); `DialStation: (props: StationProps) => JSX.Element | null`.

> No unit test — this is an R3F WebGL view. Verification is `npm run typecheck` plus the Task 10 smoke. The behavioral logic it relies on (`dialProps`) is already tested.

- [ ] **Step 1: Write the shared station type**

```ts
// src/games/lodge/ui/scene/stations/types.ts
import type { PuzzleInstance, PuzzleEvent, Role } from '@/games/lodge/engine';

export interface StationProps {
  puzzle: PuzzleInstance;
  dispatch: (puzzleId: string, by: Role, event: PuzzleEvent) => void;
}
```

- [ ] **Step 2: Write DialStation**

```tsx
// src/games/lodge/ui/scene/stations/DialStation.tsx
import { Text } from '@react-three/drei';
import type { PuzzleEvent } from '@/games/lodge/engine';
import { dialProps } from '@/games/lodge/ui/adapters/dial';
import type { StationProps } from './types';

export function DialStation({ puzzle, dispatch }: StationProps) {
  const view = puzzle.views[puzzle.lockOwner];
  const state = puzzle.state;
  if (view.kind !== 'dial' || state.kind !== 'dial') return null;

  const { ringLabels, pointerAngleRad, enteredLabels } = dialProps(view, state);
  const n = ringLabels.length;
  const send = (event: PuzzleEvent) => dispatch(puzzle.id, puzzle.lockOwner, event);

  return (
    <group>
      <group rotation={[0, 0, -pointerAngleRad]}>
        <mesh>
          <circleGeometry args={[1, 48]} />
          <meshStandardMaterial color={puzzle.solved ? '#caa24a' : '#3a3550'} />
        </mesh>
        {ringLabels.map((label, i) => {
          const a = (i / n) * Math.PI * 2;
          return (
            <Text
              key={i}
              position={[Math.sin(a) * 0.78, Math.cos(a) * 0.78, 0.02]}
              fontSize={0.16}
              color="#f0e6c8"
              anchorX="center"
              anchorY="middle"
            >
              {label}
            </Text>
          );
        })}
      </group>

      <mesh position={[0, 1.18, 0.05]}>
        <coneGeometry args={[0.1, 0.25, 8]} />
        <meshStandardMaterial color="#e0c050" />
      </mesh>

      <mesh position={[-1.5, 0, 0]} onClick={() => send({ type: 'dial.set', value: (state.pos - 1 + n) % n })}>
        <boxGeometry args={[0.3, 0.3, 0.3]} />
        <meshStandardMaterial color="#5a4a7a" />
      </mesh>
      <mesh position={[1.5, 0, 0]} onClick={() => send({ type: 'dial.set', value: (state.pos + 1) % n })}>
        <boxGeometry args={[0.3, 0.3, 0.3]} />
        <meshStandardMaterial color="#5a4a7a" />
      </mesh>
      <mesh position={[0, -1.5, 0]} onClick={() => send({ type: 'dial.commit' })}>
        <boxGeometry args={[0.5, 0.3, 0.3]} />
        <meshStandardMaterial color="#4a7a5a" />
      </mesh>
      <mesh position={[1.5, -1.5, 0]} onClick={() => send({ type: 'dial.clear' })}>
        <boxGeometry args={[0.3, 0.3, 0.3]} />
        <meshStandardMaterial color="#7a4a4a" />
      </mesh>

      <Text position={[0, -1.05, 0.05]} fontSize={0.14} color="#bdb6d6" anchorX="center">
        {`entered: ${enteredLabels.join(' ') || '—'}`}
      </Text>
    </group>
  );
}
```

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck`
Expected: no errors. (If intrinsic elements like `<mesh>` error, add `import '@react-three/fiber';` to the top of the file.)

- [ ] **Step 4: Commit**

```bash
git add src/games/lodge/ui/scene/stations/types.ts src/games/lodge/ui/scene/stations/DialStation.tsx
git commit -m "feat(lodge): DialStation R3F renderer" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: ConstellationStation

**Files:**
- Create: `src/games/lodge/ui/scene/stations/ConstellationStation.tsx`

**Interfaces:**
- Consumes: `constellationProps` (Task 2); `StationProps` (Task 4); `Line` from `@react-three/drei`; `useState` from React.
- Produces: `ConstellationStation: (props: StationProps) => JSX.Element | null`.

> R3F view — verified by typecheck + Task 10 smoke; `constellationProps` is already tested.

- [ ] **Step 1: Write ConstellationStation**

```tsx
// src/games/lodge/ui/scene/stations/ConstellationStation.tsx
import { useState } from 'react';
import { Line } from '@react-three/drei';
import { constellationProps } from '@/games/lodge/ui/adapters/constellation';
import type { StationProps } from './types';

export function ConstellationStation({ puzzle, dispatch }: StationProps) {
  const view = puzzle.views[puzzle.lockOwner];
  const state = puzzle.state;
  const [pending, setPending] = useState<number | null>(null);
  if (view.kind !== 'constellation' || state.kind !== 'constellation') return null;

  const { nodePositions, edges } = constellationProps(view, state);
  const at = (i: number): [number, number, number] => [nodePositions[i][0], nodePositions[i][1], 0];

  const clickNode = (i: number) => {
    if (pending === null) return setPending(i);
    if (pending === i) return setPending(null);
    dispatch(puzzle.id, puzzle.lockOwner, { type: 'constellation.toggle', a: pending, b: i });
    setPending(null);
  };

  return (
    <group>
      {edges.map((e, k) => (
        <Line key={k} points={[at(e[0]), at(e[1])]} color="#9fd0ff" lineWidth={2} />
      ))}
      {nodePositions.map((_, i) => (
        <mesh key={i} position={at(i)} onClick={() => clickNode(i)}>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshStandardMaterial
            color={pending === i ? '#ffe08a' : '#dfe8ff'}
            emissive={pending === i ? '#806000' : '#0a1430'}
            emissiveIntensity={1}
          />
        </mesh>
      ))}
    </group>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/games/lodge/ui/scene/stations/ConstellationStation.tsx
git commit -m "feat(lodge): ConstellationStation R3F renderer" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: CandelabraStation

**Files:**
- Create: `src/games/lodge/ui/scene/stations/CandelabraStation.tsx`

**Interfaces:**
- Consumes: `candleProps` (Task 2); `StationProps` (Task 4).
- Produces: `CandelabraStation: (props: StationProps) => JSX.Element | null`.

> R3F view — verified by typecheck + Task 10 smoke; `candleProps` is already tested.

- [ ] **Step 1: Write CandelabraStation**

```tsx
// src/games/lodge/ui/scene/stations/CandelabraStation.tsx
import '@react-three/fiber';
import type { PuzzleEvent } from '@/games/lodge/engine';
import { candleProps } from '@/games/lodge/ui/adapters/candle';
import type { StationProps } from './types';

export function CandelabraStation({ puzzle, dispatch }: StationProps) {
  const view = puzzle.views[puzzle.lockOwner];
  const state = puzzle.state;
  if (view.kind !== 'candelabra' || state.kind !== 'candle') return null;

  const { lit, positions } = candleProps(view, state);
  const send = (event: PuzzleEvent) => dispatch(puzzle.id, puzzle.lockOwner, event);

  return (
    <group>
      {positions.map((x, i) => (
        <group key={i} position={[x * 0.5, 0, 0]} onClick={() => send({ type: 'candle.light', index: i })}>
          <mesh>
            <cylinderGeometry args={[0.08, 0.08, 0.6, 12]} />
            <meshStandardMaterial color="#e8e0c8" />
          </mesh>
          {lit[i] && (
            <mesh position={[0, 0.45, 0]}>
              <sphereGeometry args={[0.07, 12, 12]} />
              <meshStandardMaterial color="#ffb060" emissive="#ff8000" emissiveIntensity={2} />
            </mesh>
          )}
        </group>
      ))}
      <mesh position={[0, -0.6, 0]} onClick={() => send({ type: 'candle.reset' })}>
        <boxGeometry args={[0.4, 0.2, 0.2]} />
        <meshStandardMaterial color="#7a4a4a" />
      </mesh>
    </group>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/games/lodge/ui/scene/stations/CandelabraStation.tsx
git commit -m "feat(lodge): CandelabraStation R3F renderer" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Station registry + LodgeScene

**Files:**
- Create: `src/games/lodge/ui/scene/stations/registry.ts`, `src/games/lodge/ui/scene/LodgeScene.tsx`

**Interfaces:**
- Consumes: the three station components (Tasks 4–6); `StationProps`; `useLodgeStore` (Task 3); `Canvas` from `@react-three/fiber`; `OrbitControls`, `Text` from `@react-three/drei`.
- Produces: `stationFor(viewKind: string): ComponentType<StationProps> | null`; `LodgeScene: () => JSX.Element`.

> R3F view — verified by typecheck + Task 10 smoke.

- [ ] **Step 1: Write the registry**

```ts
// src/games/lodge/ui/scene/stations/registry.ts
import type { ComponentType } from 'react';
import type { StationProps } from './types';
import { DialStation } from './DialStation';
import { ConstellationStation } from './ConstellationStation';
import { CandelabraStation } from './CandelabraStation';

const BY_KIND: Record<string, ComponentType<StationProps>> = {
  dial: DialStation,
  constellation: ConstellationStation,
  candelabra: CandelabraStation,
};

export function stationFor(viewKind: string): ComponentType<StationProps> | null {
  return BY_KIND[viewKind] ?? null;
}
```

- [ ] **Step 2: Write LodgeScene**

```tsx
// src/games/lodge/ui/scene/LodgeScene.tsx
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import { useLodgeStore } from '@/games/lodge/ui/store/useLodgeStore';
import { stationFor } from './stations/registry';

const SLOT_X = [-3, 0, 3];

export function LodgeScene() {
  const runState = useLodgeStore((s) => s.runState);
  const selected = useLodgeStore((s) => s.selectedPuzzleId);
  const select = useLodgeStore((s) => s.select);
  const dispatch = useLodgeStore((s) => s.dispatch);
  const puzzles = runState.run.puzzles;

  const selectedIndex = puzzles.findIndex((p) => p.id === selected);
  const targetX = SLOT_X[selectedIndex] ?? 0;

  return (
    <Canvas camera={{ position: [0, 1.5, 7], fov: 50 }} style={{ position: 'absolute', inset: 0 }}>
      <color attach="background" args={['#0a0712']} />
      <ambientLight intensity={0.25} />
      <pointLight position={[0, 3, 4]} intensity={40} color="#ffd0a0" />
      <pointLight position={[-4, 2, 2]} intensity={15} color="#a0c0ff" />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#140e1e" />
      </mesh>

      {puzzles.map((puzzle, i) => {
        const lockView = puzzle.views[puzzle.lockOwner];
        const Station = stationFor(lockView.kind);
        const x = SLOT_X[i] ?? (i - (puzzles.length - 1) / 2) * 3;
        const isSel = puzzle.id === selected;
        return (
          <group key={puzzle.id} position={[x, 0, 0]} scale={isSel ? 1.1 : 0.9}>
            <mesh position={[0, -1.25, 0]} onClick={() => select(puzzle.id)}>
              <boxGeometry args={[2.4, 0.2, 1.2]} />
              <meshStandardMaterial color={isSel ? '#2a2440' : '#171323'} />
            </mesh>
            {Station ? (
              <Station puzzle={puzzle} dispatch={dispatch} />
            ) : (
              <Text fontSize={0.2} color="#ff8888">{`?${lockView.kind}`}</Text>
            )}
            {puzzle.solved && (
              <Text position={[0, 1.7, 0]} fontSize={0.4} color="#7CFC9A" anchorX="center">
                ✓
              </Text>
            )}
          </group>
        );
      })}

      <OrbitControls target={[targetX, 0, 0]} enablePan={false} makeDefault />
    </Canvas>
  );
}
```

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/games/lodge/ui/scene/stations/registry.ts src/games/lodge/ui/scene/LodgeScene.tsx
git commit -m "feat(lodge): station registry + 3D scene" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: HUD + DevPanel

**Files:**
- Create: `src/games/lodge/ui/hud/LodgeHud.tsx`, `src/games/lodge/dev/DevPanel.tsx`

**Interfaces:**
- Consumes: `useLodgeStore` (Task 3); `randomSeed` from `@/core/utils/rng`; `Difficulty` from engine.
- Produces: `LodgeHud: () => JSX.Element`; `DevPanel: () => JSX.Element`.

> Plain DOM overlays (no R3F). Verified by typecheck + Task 10 smoke.

- [ ] **Step 1: Write LodgeHud**

```tsx
// src/games/lodge/ui/hud/LodgeHud.tsx
import { useLodgeStore } from '@/games/lodge/ui/store/useLodgeStore';

export function LodgeHud() {
  const runState = useLodgeStore((s) => s.runState);
  const total = runState.run.puzzles.length;
  return (
    <div
      style={{
        position: 'absolute', top: 12, left: 12, color: '#e8e0ff',
        font: '13px monospace', pointerEvents: 'none', lineHeight: 1.5,
      }}
    >
      <div>СВЯЗЬ: LOCAL · СВЕЧИ: —</div>
      <div>Оперируй замок по подсказке партнёра (панель справа).</div>
      <div>Решено: {runState.solvedCount}/{total}</div>
      {runState.escaped && <div style={{ color: '#7CFC9A', fontSize: 22 }}>ESCAPED ✓</div>}
    </div>
  );
}
```

- [ ] **Step 2: Write DevPanel**

```tsx
// src/games/lodge/dev/DevPanel.tsx
import { useState } from 'react';
import { useLodgeStore } from '@/games/lodge/ui/store/useLodgeStore';
import { randomSeed } from '@/core/utils/rng';
import type { Difficulty } from '@/games/lodge/engine';

const DIFFICULTIES: Difficulty[] = ['gentle', 'standard', 'devious'];

export function DevPanel() {
  const runState = useLodgeStore((s) => s.runState);
  const difficulty = useLodgeStore((s) => s.difficulty);
  const selectedPuzzleId = useLodgeStore((s) => s.selectedPuzzleId);
  const seed = useLodgeStore((s) => s.seed);
  const regenerate = useLodgeStore((s) => s.regenerate);
  const autoSolve = useLodgeStore((s) => s.autoSolve);
  const select = useLodgeStore((s) => s.select);
  const [seedInput, setSeedInput] = useState(String(seed));

  const regen = (d: Difficulty) => {
    const n = Number.parseInt(seedInput, 10);
    regenerate(Number.isFinite(n) ? n : randomSeed(), d);
  };

  return (
    <div
      style={{
        position: 'absolute', top: 12, right: 12, width: 300, maxHeight: '92vh', overflow: 'auto',
        background: 'rgba(10,8,18,0.88)', color: '#e8e0ff', font: '12px monospace',
        padding: 12, borderRadius: 8,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>DEV · Зеркальная Ложа</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <input value={seedInput} onChange={(e) => setSeedInput(e.target.value)} style={{ width: 110 }} />
        <button
          onClick={() => {
            const s = randomSeed();
            setSeedInput(String(s));
            regenerate(s, difficulty);
          }}
        >
          rnd
        </button>
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {DIFFICULTIES.map((d) => (
          <button key={d} onClick={() => regen(d)} style={{ fontWeight: d === difficulty ? 700 : 400 }}>
            {d}
          </button>
        ))}
      </div>
      {runState.run.puzzles.map((p) => (
        <div
          key={p.id}
          style={{ borderTop: '1px solid #332c44', paddingTop: 6, marginTop: 6, opacity: p.id === selectedPuzzleId ? 1 : 0.6 }}
        >
          <div>
            <button onClick={() => select(p.id)}>{p.id}</button> {p.archetypeId} {p.solved ? '✓' : ''}
          </div>
          <div style={{ color: '#9fd0ff', wordBreak: 'break-all' }}>
            clue({p.clueOwner}): {JSON.stringify(p.views[p.clueOwner])}
          </div>
          <button onClick={() => autoSolve(p.id)}>auto-solve</button>
        </div>
      ))}
      {runState.escaped && <div style={{ color: '#7CFC9A', marginTop: 8 }}>ESCAPED</div>}
    </div>
  );
}
```

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/games/lodge/ui/hud/LodgeHud.tsx src/games/lodge/dev/DevPanel.tsx
git commit -m "feat(lodge): HUD overlay + dev panel" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Harness + DEV route

**Files:**
- Create: `src/games/lodge/dev/LodgeDevHarness.tsx`
- Modify: `src/app/router.tsx`

**Interfaces:**
- Consumes: `LodgeScene` (Task 7), `LodgeHud`, `DevPanel` (Task 8); `lazy`, `Suspense` from React.
- Produces: default-exported `LodgeDevHarness`; a `/dev/lodge` route present only when `import.meta.env.DEV`.

> Verified by typecheck + Task 10 smoke.

- [ ] **Step 1: Write the harness**

```tsx
// src/games/lodge/dev/LodgeDevHarness.tsx
import { LodgeScene } from '@/games/lodge/ui/scene/LodgeScene';
import { LodgeHud } from '@/games/lodge/ui/hud/LodgeHud';
import { DevPanel } from './DevPanel';

export default function LodgeDevHarness() {
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0a0712' }}>
      <LodgeScene />
      <LodgeHud />
      <DevPanel />
    </div>
  );
}
```

- [ ] **Step 2: Wire the DEV-only route**

In `src/app/router.tsx`, add the lazy import after the existing imports:
```tsx
import { lazy, Suspense } from 'react';
const LodgeDevHarness = lazy(() => import('@/games/lodge/dev/LodgeDevHarness'));
```
Then change the `createBrowserRouter([...])` array so the launcher entry is followed by a DEV-guarded route:
```tsx
  // The launcher is full-screen and intentionally outside the portal chrome.
  { path: '/play/:id', element: <GameLauncherPage /> },
  ...(import.meta.env.DEV
    ? [
        {
          path: '/dev/lodge',
          element: (
            <Suspense fallback={<div style={{ color: '#fff', padding: 24 }}>Загрузка ложи…</div>}>
              <LodgeDevHarness />
            </Suspense>
          ),
        },
      ]
    : []),
]);
```

- [ ] **Step 3: Verify typecheck + full suite**

Run: `npm run typecheck`
Expected: no errors.

Run: `npm test`
Expected: all green (Этап-0 58 + lodge-adapters 3 + lodge-store 3 = 64).

- [ ] **Step 4: Commit**

```bash
git add src/games/lodge/dev/LodgeDevHarness.tsx src/app/router.tsx
git commit -m "feat(lodge): dev harness on a DEV-only /dev/lodge route" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Integration smoke + final verification

**Files:** none (verification only; commit only if a fix is needed).

**Interfaces:**
- Consumes: the whole harness.
- Produces: confirmation that the slice meets the spec's "готово" definition.

> This is the behavior gate for the R3F views (Tasks 4–9), which carry no unit tests. Prefer the webapp-testing skill (Playwright) to drive a real browser; if browser automation is unavailable in this environment, perform the manual steps and report what was observed.

- [ ] **Step 1: Start the dev server**

Run (background): `npm run dev`
Expected: Vite serves on a local port (e.g. http://localhost:5173).

- [ ] **Step 2: Drive the smoke (webapp-testing skill, or manual)**

Navigate to `http://localhost:5173/dev/lodge` and verify, in order:
1. The 3D canvas mounts (dark candlelit scene with three station pedestals).
2. The dev panel (top-right) lists three puzzles with `archetypeId` and a read-only `clue(...)` JSON each.
3. Enter seed `2026`, click `standard` → the scene regenerates.
4. Click a station's pedestal → it scales up and the camera recenters on it (OrbitControls target moves).
5. Click each puzzle's **auto-solve** in the panel → that station shows a green `✓` and the HUD `Решено:` count rises.
6. After all three are solved → the HUD shows `ESCAPED ✓` and the panel shows `ESCAPED`.
7. Optionally solve one puzzle by hand via the 3D controls (dial arrows/commit, constellation node pairs, candle clicks) to confirm pointer events dispatch through the engine.

- [ ] **Step 3: Confirm the build stays isolated**

Run: `npm run build`
Expected: build succeeds; the harness/three code is in the lazy `three` chunk, and `/dev/lodge` is absent from the production route table (the `import.meta.env.DEV` guard removes it).

- [ ] **Step 4: Final suite + typecheck**

Run: `npm run typecheck` → no errors.
Run: `npm test` → all green (64).

- [ ] **Step 5: Stop the dev server.** If any step required a code fix, commit it:

```bash
git add -A
git commit -m "fix(lodge): address stage-1 smoke findings" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage** (against `2026-06-23-zerkalnaya-lozha-stage1-slice-design.md`):
- Dev harness on `/dev/lodge`, DEV-guarded, lazy, no portal/`GameId` change — Task 9. ✔
- Lock-side in 3D + clue-side in dev panel — Tasks 4–8 (stations render `views[lockOwner]`; DevPanel shows `views[clueOwner]`). ✔
- All three archetypes (dial/constellation/candle) — Tasks 4, 5, 6 + registry (7). ✔
- One candlelit room, three stations, click-to-focus camera — Task 7 (`OrbitControls target` follows selection; pedestal click selects). ✔
- Zustand bridge as the netcode seam (`dispatch(puzzleId, by, event)`) — Task 3. ✔
- Pure adapters as the tested logic layer — Task 2. ✔
- R3F deps + lazy `three` chunk — Task 1. ✔
- Tests: store + adapters (vitest), one smoke — Tasks 2, 3, 10. ✔
- "Готово" definition (open → regenerate → solve → escaped) — Task 10 smoke mirrors it step-for-step. ✔
- Out of scope (network, clue 3D rooms, real timer, art, portal registration) — none of it appears in any task. ✔

**2. Placeholder scan:** no `TBD`/`TODO`/"add error handling"/"similar to Task N"; every code step shows full code; every run step shows the command and expected result. R3F view tasks explicitly state why they have no unit test (WebGL) and where behavior is verified (Task 10). ✔

**3. Type consistency:** `StationProps` (Task 4) is consumed identically by Tasks 5–7; `dispatch(puzzleId, by, event)` matches the store action (Task 3) and `LodgeEvent` shape; adapter function names (`dialProps`/`constellationProps`/`candleProps`) and their prop fields (`pointerAngleRad`, `nodePositions`, `lit`, `positions`) match between Task 2 and their consumers (Tasks 4–6); `stationFor` (Task 7) returns `ComponentType<StationProps>`. ✔

---

## Notes for the implementer

- Author the R3F view tasks (4–9) as transcription: the code blocks are complete and self-consistent. Keep hex colors ASCII.
- The only behavioral safety net for the 3D views is Task 10 — do not skip it. If browser automation isn't available, do the manual walkthrough and report exactly what rendered and which steps passed.
- Keep every file free of engine-rule logic — the store and adapters are the only places that touch the engine; stations only translate clicks to `PuzzleEvent`s and props to meshes.
