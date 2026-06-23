# Зеркальная Ложа — Этап 3a (регистрация + баланс) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Register «Зеркальная Ложа» as a real, launchable portal game (multiplayer-only, via `/play/lodge`) and fix the generator so each player always gets at least one interactive lock puzzle.

**Architecture:** Follow the Shadow Trace pure-React `GameModule` pattern (no-op `mount`, the game lives in `Hud: ({ctx}) => <LodgeGame ctx={ctx}/>`). `LodgeGame` reuses the Этап-2 `LobbyScreen` + `NetGameView` (multiplayer-only, no Solo branch), wired to `ctx.exit()` and `ctx.params.room`. The role-balance fix is a deterministic post-generation flip inside the engine's `createRun`.

**Tech Stack:** TypeScript strict, Vitest, React 18. No new dependencies.

## Global Constraints

- **Engine = source of truth (incl. balance):** the role-balance fix lives in `createRun`, deterministic and unit-tested; never in the UI.
- **Reuse, not rewrite:** the catalog game is the existing `LobbyScreen` + `NetGameView` wrapped in `Hud` with `ctx`. Этап-2 files are touched only additively (`LobbyScreen` gains optional props); the dev harness (`/dev/lodge`) keeps working.
- **Multiplayer-only catalog entry:** `LodgeGame` shows lobby → net game; no Solo branch. Solo stays on the DEV route.
- **Theme reuse:** `LODGE_DEFINITION.theme = 'shadow'` — do NOT add a `GameTheme` member. (Cosmetic: the poster card shows the shadow motif/"DETECTIVE" chip — deferred theming polish, acceptable.)
- **Ephemeral:** no `ctx.save`/achievements/records wiring (out of scope). Only `ctx.exit()` and `ctx.params.room` are used.
- **Determinism:** `createRun` stays deterministic (same seed → identical `Run`); no `Math.random()`/`Date.now()` in the engine.
- **TypeScript strict** (incl. `noFallthroughCasesInSwitch`). Typecheck: `npm run typecheck`.
- **Commits:** Conventional Commits, scope `lodge`; each ends with a second `-m` paragraph: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## File Structure

- `src/games/lodge/engine/generate.ts` — **modify**: `flipPuzzleRoles` + `balanceLockOwners`, applied in `createRun`.
- `src/types/game-module.ts` — **modify**: `GameId` += `'lodge'`.
- `src/games/lodge/definition.ts` — **create**: `LODGE_DEFINITION`.
- `src/games/lodge/dev/LobbyScreen.tsx` — **modify (additive)**: optional `initialCode?`/`onExitToPortal?`.
- `src/games/lodge/ui/LodgeGame.tsx` — **create**: catalog entry (`lobby ↔ net`, ctx-aware).
- `src/games/lodge/LodgeGameModule.tsx` — **create**: `lodgeModule: GameModule`.
- `src/games/index.ts` — **modify**: register the lodge entry.
- Tests: `tests/lodge-balance.test.ts`, `tests/lodge-registration.test.ts`.

---

## Task 1: Role balance in createRun

**Files:**
- Modify: `src/games/lodge/engine/generate.ts`
- Test: `tests/lodge-balance.test.ts`

**Interfaces:**
- Consumes: `Role`/`PuzzleInstance` from `./types` (add to the existing import); `createRun`/`validateRun` (test).
- Produces: `createRun` output now guarantees, for runs with ≥2 puzzles, that both roles appear as `lockOwner`. Determinism unchanged.

- [ ] **Step 1: Write the failing test**

```ts
// tests/lodge-balance.test.ts
import { describe, expect, it } from 'vitest';
import { createRun, validateRun } from '@/games/lodge/engine';

describe('createRun role balance', () => {
  it('is deterministic', () => {
    expect(createRun(2026)).toEqual(createRun(2026));
  });

  it('gives both roles at least one lock puzzle across many seeds', () => {
    for (let seed = 0; seed < 60; seed++) {
      const owners = new Set(createRun(seed).puzzles.map((p) => p.lockOwner));
      expect(owners.has('A')).toBe(true);
      expect(owners.has('B')).toBe(true);
    }
  });

  it('seed 2026 (previously all-B) is balanced, still valid, still asymmetric', () => {
    const run = createRun(2026);
    expect(new Set(run.puzzles.map((p) => p.lockOwner)).size).toBe(2);
    expect(validateRun(run)).toEqual([]);
    for (const p of run.puzzles) expect(p.clueOwner).not.toBe(p.lockOwner);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lodge-balance.test.ts`
Expected: FAIL — the "both roles" / "seed 2026 balanced" assertions fail (seed 2026 currently yields an all-`B` run).

- [ ] **Step 3: Write minimal implementation**

Replace the contents of `src/games/lodge/engine/generate.ts` with:

```ts
import { makeRng, shuffle } from './seed';
import { ARCHETYPES, ARCHETYPE_IDS } from './archetypes';
import type { Run, Difficulty, PuzzleInstance, Role } from './types';

export interface RunConfig {
  difficulty?: Difficulty;
  archetypeIds?: string[];
}

const other = (role: Role): Role => (role === 'A' ? 'B' : 'A');

/** Re-assign a puzzle to the opposite roles (swap clue/lock owners and the
 *  two role-keyed views). Solution/state are role-agnostic and untouched, so
 *  the puzzle's logic — and the `lock !== clue` invariant — are preserved. */
function flipPuzzleRoles(p: PuzzleInstance): PuzzleInstance {
  return {
    ...p,
    clueOwner: other(p.clueOwner),
    lockOwner: other(p.lockOwner),
    views: { A: p.views.B, B: p.views.A },
  };
}

/** Guarantee both roles own at least one lock puzzle. If every puzzle shares the
 *  same lockOwner (a lopsided run), flip the first puzzle. Deterministic. */
function balanceLockOwners(puzzles: PuzzleInstance[]): PuzzleInstance[] {
  if (puzzles.length < 2) return puzzles;
  if (new Set(puzzles.map((p) => p.lockOwner)).size > 1) return puzzles;
  return puzzles.map((p, i) => (i === 0 ? flipPuzzleRoles(p) : p));
}

export function createRun(seed: number, config: RunConfig = {}): Run {
  const difficulty = config.difficulty ?? 'standard';
  const rng = makeRng(seed);
  const ids = config.archetypeIds ?? shuffle(rng, ARCHETYPE_IDS);

  const raw: PuzzleInstance[] = ids.map((aid, i) => {
    const gen = ARCHETYPES[aid].generate(rng, difficulty);
    return { ...gen, id: `p${i}`, solved: false };
  });

  return { seed, difficulty, puzzles: balanceLockOwners(raw) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lodge-balance.test.ts`
Expected: PASS (3 tests).

Run: `npm test`
Expected: all green — the existing 74 + 3 = 77. The balance change only affects lopsided runs; session/convergence tests compute the lock owner dynamically, so none regress.

- [ ] **Step 5: Commit**

```bash
git add src/games/lodge/engine/generate.ts tests/lodge-balance.test.ts
git commit -m "feat(lodge): balance lock ownership so each role gets a lock" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: GameId union + LODGE_DEFINITION

**Files:**
- Modify: `src/types/game-module.ts`
- Create: `src/games/lodge/definition.ts`
- Test: `tests/lodge-registration.test.ts`

**Interfaces:**
- Consumes: `GameDefinition` type.
- Produces: `GameId` now includes `'lodge'`; `LODGE_DEFINITION: GameDefinition` (id `'lodge'`, theme `'shadow'`, status `'available'`).

- [ ] **Step 1: Write the failing test**

```ts
// tests/lodge-registration.test.ts
import { describe, expect, it } from 'vitest';
import { LODGE_DEFINITION } from '@/games/lodge/definition';

describe('LODGE_DEFINITION', () => {
  it('is a valid, available portal entry on the shadow theme', () => {
    expect(LODGE_DEFINITION.id).toBe('lodge');
    expect(LODGE_DEFINITION.theme).toBe('shadow');
    expect(LODGE_DEFINITION.status).toBe('available');
    expect(LODGE_DEFINITION.title.length).toBeGreaterThan(0);
    expect(LODGE_DEFINITION.tagline.length).toBeGreaterThan(0);
    expect(LODGE_DEFINITION.description.length).toBeGreaterThan(0);
    expect(LODGE_DEFINITION.bootHint.length).toBeGreaterThan(0);
    expect(LODGE_DEFINITION.tags.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lodge-registration.test.ts`
Expected: FAIL — cannot resolve `@/games/lodge/definition`.

- [ ] **Step 3: Write minimal implementation**

In `src/types/game-module.ts`, extend the `GameId` union (line 5):
```ts
export type GameId = 'shadow-trace' | 'colony' | 'lodge';
```

Create the definition:
```ts
// src/games/lodge/definition.ts
import type { GameDefinition } from '@/types/game-module';

export const LODGE_DEFINITION: GameDefinition = {
  id: 'lodge',
  title: 'Зеркальная Ложа',
  tagline: 'Кооп-побег на двоих. Опиши, что видишь — и выберитесь вместе.',
  description:
    'Реалтайм кооп-эскейп на двоих в 3D: вы в зеркальных крыльях оккультной ложи. ' +
    'Подсказки к твоим механизмам спрятаны у напарника — говорите голосом, ' +
    'проворачивайте ритуальные пазлы и выберитесь вместе.',
  theme: 'shadow',
  status: 'available',
  tags: ['co-op', 'multiplayer', 'puzzle', '3d'],
  bootHint: 'Зажигаем свечи…',
};
```

- [ ] **Step 4: Run test + typecheck**

Run: `npx vitest run tests/lodge-registration.test.ts`
Expected: PASS (1 test).

Run: `npm run typecheck`
Expected: no errors. Adding `'lodge'` to `GameId` is expected to compile cleanly (saves key by plain `string`; the only theme-keyed map, `motifByTheme` in `GameCard.tsx`, is keyed by `GameTheme` and lodge reuses `'shadow'`). If `tsc` DOES surface a non-exhaustive `switch`/map on `GameId`, add a minimal `lodge` branch mirroring the nearest existing game, and note it in the report.

- [ ] **Step 5: Commit**

```bash
git add src/types/game-module.ts src/games/lodge/definition.ts tests/lodge-registration.test.ts
git commit -m "feat(lodge): GameId 'lodge' + LODGE_DEFINITION" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: LobbyScreen — optional portal props

**Files:**
- Modify: `src/games/lodge/dev/LobbyScreen.tsx`

**Interfaces:**
- Consumes: `makeRoomCode`/`isValidRoomCode` (unchanged).
- Produces: `LobbyScreen` now accepts optional `initialCode?: string` (prefills the join code) and `onExitToPortal?: () => void` (renders a "← В портал" button when provided). The existing `onStart` contract and the dev-harness call site (which passes neither) are unchanged.

> No unit test (DOM glue) — verified by typecheck + the Task 6 smoke. The change is additive and backward-compatible.

- [ ] **Step 1: Replace the component with the additive version**

```tsx
// src/games/lodge/dev/LobbyScreen.tsx
import { useState } from 'react';
import { makeRoomCode, isValidRoomCode } from '@/games/lodge/net';

export interface LobbyResult {
  name: string;
  code: string;
  isHost: boolean;
}

export function LobbyScreen({
  onStart,
  initialCode,
  onExitToPortal,
}: {
  onStart: (r: LobbyResult) => void;
  initialCode?: string;
  onExitToPortal?: () => void;
}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState(initialCode ?? '');
  const ready = name.trim().length > 0;

  const create = () => onStart({ name: name.trim(), code: makeRoomCode(Math.random), isHost: true });
  const join = () => {
    const c = code.trim().toUpperCase();
    if (isValidRoomCode(c)) onStart({ name: name.trim(), code: c, isHost: false });
  };

  return (
    <div style={{ maxWidth: 420, margin: '60px auto', color: '#e8e0ff', font: '14px monospace' }}>
      {onExitToPortal && (
        <button onClick={onExitToPortal} style={{ marginBottom: 12 }}>← В портал</button>
      )}
      <h2>Зеркальная Ложа — лобби</h2>
      <label style={{ display: 'block', margin: '12px 0 4px' }}>Имя</label>
      <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%' }} />
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button disabled={!ready} onClick={create}>Создать комнату</button>
      </div>
      <div style={{ marginTop: 16 }}>
        <label style={{ display: 'block', marginBottom: 4 }}>Код комнаты</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="ABCDEF" style={{ flex: 1 }} />
          <button disabled={!ready || !isValidRoomCode(code.trim().toUpperCase())} onClick={join}>Войти</button>
        </div>
      </div>
      <p style={{ color: '#8a86a6', marginTop: 16 }}>Подсказка: открой эту страницу в двух вкладках — создай комнату в одной, войди по коду в другой (транспорт BroadcastChannel). Seed выберет хост.</p>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: no errors. (The dev `LodgeDevEntry` calls `<LobbyScreen onStart={...} />` — both new props are optional, so it still compiles.)

- [ ] **Step 3: Commit**

```bash
git add src/games/lodge/dev/LobbyScreen.tsx
git commit -m "feat(lodge): LobbyScreen optional initialCode + onExitToPortal" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: LodgeGame + LodgeGameModule

**Files:**
- Create: `src/games/lodge/ui/LodgeGame.tsx`, `src/games/lodge/LodgeGameModule.tsx`

**Interfaces:**
- Consumes: `GameContext`/`GameInstance`/`GameModule` types; `LODGE_DEFINITION` (Task 2); `LobbyScreen`/`LobbyResult` (Task 3); `NetGameView` (Этап 2).
- Produces: `LodgeGame({ ctx })` — multiplayer-only entry (`lobby ↔ net`); `lodgeModule: GameModule` (no-op `mount` + `Hud`).

> No unit test (React glue) — verified by typecheck + the Task 6 smoke.

- [ ] **Step 1: Write LodgeGame**

```tsx
// src/games/lodge/ui/LodgeGame.tsx
import { useState } from 'react';
import type { GameContext } from '@/types/game-module';
import { LobbyScreen, type LobbyResult } from '@/games/lodge/dev/LobbyScreen';
import { NetGameView } from '@/games/lodge/dev/NetGameView';

type Screen = { s: 'lobby' } | { s: 'net'; lobby: LobbyResult };

export function LodgeGame({ ctx }: { ctx: GameContext }) {
  const [screen, setScreen] = useState<Screen>({ s: 'lobby' });

  if (screen.s === 'net') {
    return <NetGameView lobby={screen.lobby} onExit={() => setScreen({ s: 'lobby' })} />;
  }
  return (
    <LobbyScreen
      initialCode={ctx.params.room}
      onExitToPortal={() => ctx.exit()}
      onStart={(lobby) => setScreen({ s: 'net', lobby })}
    />
  );
}
```

- [ ] **Step 2: Write LodgeGameModule**

```tsx
// src/games/lodge/LodgeGameModule.tsx
import type { GameContext, GameInstance, GameModule } from '@/types/game-module';
import { LODGE_DEFINITION } from './definition';
import { LodgeGame } from './ui/LodgeGame';

/** Lodge is a pure-React game (no Phaser): mount() is a no-op and the whole
 *  experience lives in the HUD overlay, like Shadow Trace. */
export const lodgeModule: GameModule = {
  definition: LODGE_DEFINITION,
  payloadVersion: 1,

  async mount(_container: HTMLElement, _ctx: GameContext): Promise<GameInstance> {
    return {
      pause() {},
      resume() {},
      destroy() {},
    };
  },

  Hud: ({ ctx }) => <LodgeGame ctx={ctx} />,
};
```

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck`
Expected: no errors (all imports resolve; `lodgeModule` satisfies `GameModule`).

- [ ] **Step 4: Commit**

```bash
git add src/games/lodge/ui/LodgeGame.tsx src/games/lodge/LodgeGameModule.tsx
git commit -m "feat(lodge): portal game entry (LodgeGame) + GameModule" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Register lodge in the catalog

**Files:**
- Modify: `src/games/index.ts`

**Interfaces:**
- Consumes: `GameRegistry`; `LODGE_DEFINITION` (Task 2); `lodgeModule` (Task 4, lazy).
- Produces: lodge registered in the catalog; launchable via `/play/lodge`.

- [ ] **Step 1: Register the lodge entry**

In `src/games/index.ts`, add the import alongside the existing definition imports:
```ts
import { LODGE_DEFINITION } from './lodge/definition';
```
and add this registration inside `registerGames()` after the existing `GameRegistry.register(...)` calls:
```ts
  GameRegistry.register({
    definition: LODGE_DEFINITION,
    load: () => import('./lodge/LodgeGameModule').then((m) => m.lodgeModule),
  });
```

- [ ] **Step 2: Verify typecheck + full suite + build**

Run: `npm run typecheck`
Expected: no errors.

Run: `npm test`
Expected: all green (78 — 74 baseline + 3 balance + 1 registration).

Run: `npm run build`
Expected: build succeeds; the lodge module + R3F/net land in a lazy chunk (the launcher loads it on demand), and the main `index`/`vendor` bundles are unaffected.

- [ ] **Step 3: Commit**

```bash
git add src/games/index.ts
git commit -m "feat(lodge): register «Зеркальная Ложа» in the portal catalog" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Portal smoke + final verification

**Files:** none (verification only; commit only if a fix is needed).

> Behavior gate for the portal wiring (no unit tests on the React glue). Prefer driving the browser (webapp-testing); if unavailable here, run the automated gate and hand the portal/cross-tab smoke to the user with exact steps.

- [ ] **Step 1: Final automated gate**

Run: `npm run typecheck` → no errors.
Run: `npm test` → all green (78).
Run: `npm run build` → succeeds; lodge in a lazy chunk, main bundle unaffected.

- [ ] **Step 2: Portal smoke (delegated unless a browser is available)**

Run (background): `npm run dev`. Then:
1. Open `http://localhost:5173/games` → «Зеркальная Ложа» appears as an available card.
2. Click it → `/games/lodge` detail → launch → `/play/lodge`.
3. The multiplayer lobby renders (name + create/join + "← В портал").
4. "← В портал" returns to the portal (`ctx.exit()`).
5. Direct-join: open `/play/lodge?room=ABCDEF` → the join code is prefilled.
6. Two tabs: create in one, join-by-code in the other → Старт → solve → both show `ESCAPED`. (Confirms the host now has interactive lock stations — the balance fix.)

- [ ] **Step 3: Stop the dev server.** If any step required a code fix, commit it:

```bash
git add -A
git commit -m "fix(lodge): address stage-3a smoke findings" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage** (against `2026-06-23-zerkalnaya-lozha-stage3a-registration-design.md`):
- `GameId` += `'lodge'`; `LODGE_DEFINITION` (theme `'shadow'`, status `'available'`) — Task 2. ✔
- `LodgeGameModule` (no-op mount + Hud) + `LodgeGame` (multiplayer-only lobby↔net, `ctx.exit()`/`ctx.params.room`) — Task 4. ✔
- Additive `LobbyScreen` props (`initialCode`/`onExitToPortal`) — Task 3. ✔
- Registration in the catalog; launch via `/play/lodge` — Task 5. ✔
- Balance: deterministic flip so both roles own ≥1 lock — Task 1. ✔
- Done-definition (catalog → launch → lobby → exit; `?room=` prefill; balance; tests/build) — Tasks 2–6. ✔
- Out of scope (3D clue rooms, timer, pings, archetypes, persistence, own theme, solo-in-catalog) — none implemented. ✔

**2. Placeholder scan:** no `TBD`/`TODO`/"add error handling"/"similar to Task N". Glue tasks state why they carry no unit test and where behavior is verified (Task 6). The GameId-ripple note (Task 2) gives a concrete fallback. ✔

**3. Type consistency:** `LODGE_DEFINITION` satisfies `GameDefinition`; `lodgeModule` satisfies `GameModule`; `LodgeGame({ ctx: GameContext })` uses `ctx.exit()`/`ctx.params.room` (both on `GameContext`); `LobbyScreen`'s new optional props match `LodgeGame`'s call; `flipPuzzleRoles`/`balanceLockOwners` operate on `PuzzleInstance`/`Role` from the engine and preserve `createRun`'s `Run` return. ✔

---

## Notes for the implementer

- Task 1 is the only TDD task and the real risk surface (it changes engine output) — run the FULL suite after it, not just the focused test, to confirm no Этап-0/1/2 regression.
- Tasks 2–5 are mostly transcription + typecheck; the union change in Task 2 is the one place to watch — run `npm run typecheck` and close any surfaced exhaustive-`switch` minimally (expected: none).
- Do not skip Task 6. If browser automation is unavailable, run the automated gate and report the portal + cross-tab smoke as delegated, with the exact local steps.
- Keep hex ASCII; keep engine files free of React/DOM imports.
