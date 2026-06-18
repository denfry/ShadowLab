# Shadow Trace v2 — Engine Foundation (Этап 0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure-logic foundation of the Shadow Trace v2 case engine — types, condition evaluator, state model, contradiction matcher, ending resolver/scoring, and a content validator — fully unit-tested, with zero UI.

**Architecture:** A self-contained engine package under `src/games/shadow-trace/engine/`, living alongside the existing v1 code (which stays untouched). Everything is pure and deterministic: functions take `(caseData, state)` and return new state or a result. Branching is data: nodes/evidence/endings are gated by `Condition` trees the engine evaluates. A `validateCase()` function guarantees no dead-ends before content ships.

**Tech Stack:** TypeScript (strict), Vitest, `@/` path alias → `src/`. No new dependencies.

**Scope note:** This plan is Этап 0 of the spec `docs/superpowers/specs/2026-06-18-shadow-trace-v2-design.md`. Этап 1 (the detective desk UI + media inspector), Этап 2 (video/fakes), Этап 3 (campaign), Этап 4 (content) are **separate plans** written after this engine exists and its API is real.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/games/shadow-trace/engine/media-types.ts` | Media data types (MediaSpec, SceneLayer, Hotspot, VideoFrame, Artifact, Rect) |
| `src/games/shadow-trace/engine/types.ts` | Core case types, runtime state types, deduction result |
| `src/games/shadow-trace/engine/conditions.ts` | `evaluateCondition` — runtime boolean over case state |
| `src/games/shadow-trace/engine/state.ts` | `createCaseProgress`, `applyEffects`, `visitNode`, `chooseOption` |
| `src/games/shadow-trace/engine/contradictions.ts` | `matchContradiction`, `discoverContradiction`, `addLink` |
| `src/games/shadow-trace/engine/endings.ts` | `resolveEnding`, `scoreCaseV2` |
| `src/games/shadow-trace/engine/validator.ts` | `validateCase` — reachability + structural checks |
| `src/games/shadow-trace/engine/index.ts` | Public barrel export |
| `tests/fixtures/sample-case-v2.ts` | A small valid v2 case shared by all engine tests |
| `tests/engine-conditions.test.ts` | Tests for `evaluateCondition` |
| `tests/engine-state.test.ts` | Tests for state transitions |
| `tests/engine-contradictions.test.ts` | Tests for contradiction matching/discovery |
| `tests/engine-endings.test.ts` | Tests for ending resolution + scoring |
| `tests/engine-validator.test.ts` | Tests for the content validator |

The existing v1 files (`domain/types.ts`, `systems/CaseManager.ts`, `systems/ScoringSystem.ts`, `ui/*`, `ShadowTraceGameModule.tsx`) are **not modified** in Этап 0.

---

## Task 0: Project setup (git + engine folder)

**Files:**
- Create: `src/games/shadow-trace/engine/` (directory)

- [ ] **Step 1: Initialize git so the plan's frequent commits work**

The project is not yet a git repository. Initialize it once:

Run:
```bash
cd /c/Projects/browser_game && git init && git add -A && git commit -m "chore: snapshot before shadow-trace v2 engine"
```
Expected: `Initialized empty Git repository` then a commit with the current tree.

> If you prefer not to use git, skip the `git commit` step in every task. The real checkpoint in each task is `npx vitest run ...` passing.

- [ ] **Step 2: Create the engine directory**

Run:
```bash
mkdir -p /c/Projects/browser_game/src/games/shadow-trace/engine /c/Projects/browser_game/tests/fixtures
```
Expected: no output, both directories exist.

---

## Task 1: v2 types + shared test fixture

**Files:**
- Create: `src/games/shadow-trace/engine/media-types.ts`
- Create: `src/games/shadow-trace/engine/types.ts`
- Create: `tests/fixtures/sample-case-v2.ts`

Types have no runtime behavior, so the "test" here is `tsc` compiling the fixture against the types. The fixture is a real, valid case used by every later task.

- [ ] **Step 1: Write the media types**

Create `src/games/shadow-trace/engine/media-types.ts`:
```ts
import type { Condition, Grant } from './types';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SceneLayer {
  id: string;
  z: number;
  shape: 'rect' | 'figure' | 'object' | 'text' | 'shadow' | 'reflection' | 'sprite';
  at: Rect;
  sprite?: string;
  tint?: string;
  rotation?: number;
  opacity?: number;
  props?: Record<string, unknown>;
}

export interface Hotspot {
  id: string;
  at: Rect;
  label: string;
  revealRequires?: Condition;
  grants?: Grant[];
}

export interface VideoFrame {
  t: number;
  changes: Array<Partial<SceneLayer>>;
  hotspots?: Hotspot[];
}

export interface Artifact {
  id: string;
  type:
    | 'clone'
    | 'shadow_mismatch'
    | 'impossible_reflection'
    | 'clock_conflict'
    | 'timestamp_metadata_mismatch'
    | 'splice_seam'
    | 'lighting_inconsistency';
  at?: Rect;
  tell: string;
  detectRequires?: Condition;
  grants?: Grant[];
}

export interface MediaSpec {
  kind: 'photo' | 'video';
  aspect: '4:3' | '16:9' | '1:1';
  style: 'cctv' | 'phone' | 'polaroid' | 'doc-scan' | 'thermal';
  layers: SceneLayer[];
  hotspots: Hotspot[];
  frames?: VideoFrame[];
  overlay?: { timestamp?: string; channel?: string; battery?: number; geostamp?: string };
  artifacts?: Artifact[];
}
```

- [ ] **Step 2: Write the core types**

Create `src/games/shadow-trace/engine/types.ts`:
```ts
import type { MediaSpec } from './media-types';

// ---- branching primitives ----
export type Condition =
  | { hasEvidence: string }
  | { hasFlag: string }
  | { foundContradiction: string }
  | { accuse: string }
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition };

export interface Effect {
  setFlag?: string;
  addNode?: string;
  lockNode?: string;
  addEvidence?: string;
  addStatement?: string;
}
export type Grant = Effect;

export type FactRef = { type: 'statement' | 'evidence' | 'metadata'; refId: string };
export type TimeSpan = { start?: string; end?: string };

// ---- authored case content ----
export interface Choice {
  id: string;
  label: string;
  requires?: Condition;
  effects: Effect[];
}

export interface LeadNode {
  id: string;
  type: 'location' | 'interrogation' | 'analysis' | 'cutscene';
  title: string;
  requires?: Condition;
  body: string[];
  choices?: Choice[];
  grants?: Grant[];
  oneShot?: boolean;
}

export interface Evidence {
  id: string;
  title: string;
  kind: 'message' | 'log' | 'document' | 'photo' | 'video' | 'object';
  summary: string;
  content?: string;
  media?: MediaSpec;
  metadata?: { time?: string; geo?: string; device?: string; exif?: Record<string, string> };
  relatedSuspectIds: string[];
  authenticity: 'real' | 'fake';
  revealsStatementIds?: string[];
}

export interface Statement {
  id: string;
  speakerId: string;
  claim: string;
  asserts: { subjectId: string; place?: string; timeStart?: string; timeEnd?: string; action?: string };
}

export interface Contradiction {
  id: string;
  between: [FactRef, FactRef];
  rule: 'time_overlap' | 'place_conflict' | 'mutual_exclusive' | 'authenticity';
  unlocks?: Grant[];
  weight: number;
}

export interface Suspect {
  id: string;
  name: string;
  role: string;
  alibi: string;
  motive?: string;
  truthProfile?: { wasAt?: string; at?: string; didAction?: string };
}

export type EndingQuality = 'truth' | 'partial' | 'miscarriage' | 'cold_case';

export interface Ending {
  id: string;
  title: string;
  requires: Condition;
  quality: EndingQuality;
  epilogue: string[];
  campaignEffects?: Effect[];
}

export interface FlagDef {
  id: string;
  description?: string;
}

export interface CaseV2 {
  id: string;
  title: string;
  difficulty: 'normal' | 'hard' | 'nightmare';
  synopsis: string;
  episodeOf?: string;
  startNodeIds: string[];
  nodes: LeadNode[];
  suspects: Suspect[];
  evidence: Evidence[];
  statements: Statement[];
  contradictions: Contradiction[];
  endings: Ending[];
  flagsSchema: FlagDef[];
}

// ---- runtime state ----
export interface PlayerLink {
  fromRef: FactRef;
  toRef: FactRef;
  relation: 'supports' | 'contradicts' | 'explains';
}

export interface Accusation {
  culpritId: string;
  method?: string;
  fakeEvidenceIds: string[];
  motiveId?: string;
  keyContradictionIds: string[];
}

export interface CaseProgressV2 {
  caseId: string;
  openNodes: string[];
  visitedNodes: string[];
  discoveredEvidence: string[];
  discoveredStatements: string[];
  flags: Record<string, boolean | number | string>;
  foundContradictions: string[];
  links: PlayerLink[];
  notes: string[];
  choicesMade: Record<string, string>;
  accusation?: Accusation;
}

export type Rank = 'F' | 'C' | 'B' | 'A' | 'S';

export interface DeductionResultV2 {
  rank: Rank;
  contradictionsFound: number;
  contradictionsTotal: number;
  correctLinks: number;
  falseLinks: number;
  fakesIdentified: number;
  fakesTotal: number;
  accusationQuality: EndingQuality;
  flagsForCampaign: string[];
}

// ---- campaign (type-only; consumers arrive in Этап 3) ----
export interface ConsequenceRecord {
  episodeId: string;
  type: 'jailed' | 'freed' | 'died' | 'allied' | 'betrayed';
  subjectId: string;
}

export interface CampaignState {
  campaignId: string;
  flags: Record<string, boolean | number | string>;
  reputation: { press: number; police: number; underworld: number };
  ledger: ConsequenceRecord[];
  retainedEvidence: string[];
  knownCharacters: string[];
}

export interface EpisodeRef {
  id: string;
  caseId: string;
  requires?: Condition;
  nextOptions: { episodeId: string; requires?: Condition }[];
}

export interface Campaign {
  id: string;
  title: string;
  episodes: EpisodeRef[];
  startEpisodeId: string;
}
```

- [ ] **Step 3: Write the shared fixture**

Create `tests/fixtures/sample-case-v2.ts`:
```ts
import type { CaseV2 } from '@/games/shadow-trace/engine/types';

/**
 * Minimal but fully valid v2 case used across engine tests.
 * Two suspects, a fake photo whose metadata time (21:30) contradicts Eron's
 * statement (home at 22:00). Finding that contradiction unlocks the lab node.
 */
export const sampleCase: CaseV2 = {
  id: 'sample',
  title: 'Образец дела',
  difficulty: 'hard',
  synopsis: 'Тестовое дело для движка.',
  startNodeIds: ['n_scene', 'n_interview'],
  flagsSchema: [{ id: 'lab_done', description: 'Лаборатория отработана' }],
  suspects: [
    { id: 's_eron', name: 'Эрон', role: 'ассистент', alibi: 'Был дома', truthProfile: { wasAt: 'office' } },
    { id: 's_mara', name: 'Мара', role: 'куратор', alibi: 'На приёме' },
  ],
  statements: [
    {
      id: 'st_eron_home',
      speakerId: 's_eron',
      claim: 'Я был дома в 22:00.',
      asserts: { subjectId: 's_eron', place: 'home', timeStart: '22:00', timeEnd: '23:00' },
    },
  ],
  evidence: [
    {
      id: 'e_photo',
      title: 'Снимок у входа',
      kind: 'photo',
      summary: 'Фигура у служебного входа.',
      authenticity: 'fake',
      relatedSuspectIds: ['s_eron'],
      metadata: { time: '21:30', geo: 'office', device: 'CCTV-3' },
      media: {
        kind: 'photo',
        aspect: '4:3',
        style: 'cctv',
        layers: [{ id: 'bg', z: 0, shape: 'rect', at: { x: 0, y: 0, w: 100, h: 100 } }],
        hotspots: [{ id: 'h_clock', at: { x: 10, y: 10, w: 20, h: 20 }, label: 'Часы на стене: 21:30' }],
        artifacts: [{ id: 'a_clock', type: 'clock_conflict', tell: 'Время на часах не бьётся с показанием' }],
      },
    },
    {
      id: 'e_log',
      title: 'Журнал доступа',
      kind: 'log',
      summary: 'Карта Эрона открыла дверь в 21:28.',
      content: '21:28 ACCESS GRANTED card=ERON',
      authenticity: 'real',
      relatedSuspectIds: ['s_eron'],
    },
  ],
  contradictions: [
    {
      id: 'c_time',
      between: [
        { type: 'statement', refId: 'st_eron_home' },
        { type: 'metadata', refId: 'e_photo' },
      ],
      rule: 'time_overlap',
      unlocks: [{ addNode: 'n_lab' }],
      weight: 2,
    },
  ],
  nodes: [
    {
      id: 'n_scene',
      type: 'location',
      title: 'Осмотр входа',
      body: ['У служебного входа лежит распечатка кадра.'],
      grants: [{ addEvidence: 'e_photo' }],
      oneShot: true,
    },
    {
      id: 'n_interview',
      type: 'interrogation',
      title: 'Допрос Эрона',
      body: ['— Я был дома весь вечер.'],
      grants: [{ addStatement: 'st_eron_home' }],
    },
    {
      id: 'n_lab',
      type: 'analysis',
      title: 'Лаборатория',
      requires: { foundContradiction: 'c_time' },
      body: ['Эксперт сверяет журнал доступа.'],
      grants: [{ addEvidence: 'e_log' }, { setFlag: 'lab_done' }],
    },
  ],
  endings: [
    {
      id: 'end_truth',
      title: 'Истина установлена',
      requires: { all: [{ foundContradiction: 'c_time' }, { hasFlag: 'lab_done' }, { accuse: 's_eron' }] },
      quality: 'truth',
      epilogue: ['Эрон сломался под тяжестью улик.'],
      campaignEffects: [{ setFlag: 'eron_jailed' }],
    },
    {
      id: 'end_partial',
      title: 'Верно, но шатко',
      requires: { accuse: 's_eron' },
      quality: 'partial',
      epilogue: ['Эрон задержан, но защита найдёт бреши.'],
    },
    {
      id: 'end_miscarriage',
      title: 'Осуждён невиновный',
      requires: { accuse: 's_mara' },
      quality: 'miscarriage',
      epilogue: ['Мара осуждена. Настоящий виновный на свободе.'],
    },
    {
      id: 'end_cold',
      title: 'Глухарь',
      requires: { all: [] },
      quality: 'cold_case',
      epilogue: ['Улик не хватило.'],
    },
  ],
};
```

- [ ] **Step 4: Verify types + fixture compile**

Run:
```bash
cd /c/Projects/browser_game && npm run typecheck
```
Expected: PASS (exit 0, no output). If `tsc` reports errors, fix the type or fixture until clean.

- [ ] **Step 5: Commit**

Run:
```bash
cd /c/Projects/browser_game && git add src/games/shadow-trace/engine tests/fixtures && git commit -m "feat(shadow-trace): v2 engine types + sample case fixture"
```

---

## Task 2: Condition evaluator

**Files:**
- Create: `src/games/shadow-trace/engine/conditions.ts`
- Test: `tests/engine-conditions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/engine-conditions.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { evaluateCondition } from '@/games/shadow-trace/engine/conditions';
import type { CaseProgressV2, Condition } from '@/games/shadow-trace/engine/types';

const state: CaseProgressV2 = {
  caseId: 'sample',
  openNodes: [],
  visitedNodes: [],
  discoveredEvidence: ['e_photo'],
  discoveredStatements: ['st_eron_home'],
  flags: { lab_done: true },
  foundContradictions: ['c_time'],
  links: [],
  notes: [],
  choicesMade: {},
  accusation: { culpritId: 's_eron', fakeEvidenceIds: [], keyContradictionIds: [] },
};

describe('evaluateCondition', () => {
  it('matches hasEvidence / hasFlag / foundContradiction / accuse', () => {
    expect(evaluateCondition({ hasEvidence: 'e_photo' }, state)).toBe(true);
    expect(evaluateCondition({ hasEvidence: 'e_log' }, state)).toBe(false);
    expect(evaluateCondition({ hasFlag: 'lab_done' }, state)).toBe(true);
    expect(evaluateCondition({ hasFlag: 'nope' }, state)).toBe(false);
    expect(evaluateCondition({ foundContradiction: 'c_time' }, state)).toBe(true);
    expect(evaluateCondition({ accuse: 's_eron' }, state)).toBe(true);
    expect(evaluateCondition({ accuse: 's_mara' }, state)).toBe(false);
  });

  it('composes all / any / not', () => {
    const cond: Condition = {
      all: [{ hasFlag: 'lab_done' }, { not: { hasEvidence: 'e_log' } }, { any: [{ accuse: 's_eron' }, { hasFlag: 'x' }] }],
    };
    expect(evaluateCondition(cond, state)).toBe(true);
    expect(evaluateCondition({ all: [{ hasFlag: 'lab_done' }, { hasEvidence: 'e_log' }] }, state)).toBe(false);
  });

  it('treats empty all as true and empty any as false', () => {
    expect(evaluateCondition({ all: [] }, state)).toBe(true);
    expect(evaluateCondition({ any: [] }, state)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd /c/Projects/browser_game && npx vitest run tests/engine-conditions.test.ts
```
Expected: FAIL — cannot resolve `@/games/shadow-trace/engine/conditions`.

- [ ] **Step 3: Write minimal implementation**

Create `src/games/shadow-trace/engine/conditions.ts`:
```ts
import type { CaseProgressV2, Condition } from './types';

/** Pure boolean evaluation of a Condition tree against current case state. */
export function evaluateCondition(cond: Condition, state: CaseProgressV2): boolean {
  if ('hasEvidence' in cond) return state.discoveredEvidence.includes(cond.hasEvidence);
  if ('hasFlag' in cond) return Boolean(state.flags[cond.hasFlag]);
  if ('foundContradiction' in cond) return state.foundContradictions.includes(cond.foundContradiction);
  if ('accuse' in cond) return state.accusation?.culpritId === cond.accuse;
  if ('all' in cond) return cond.all.every((c) => evaluateCondition(c, state));
  if ('any' in cond) return cond.any.some((c) => evaluateCondition(c, state));
  if ('not' in cond) return !evaluateCondition(cond.not, state);
  return false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd /c/Projects/browser_game && npx vitest run tests/engine-conditions.test.ts
```
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

Run:
```bash
cd /c/Projects/browser_game && git add src/games/shadow-trace/engine/conditions.ts tests/engine-conditions.test.ts && git commit -m "feat(shadow-trace): v2 condition evaluator"
```

---

## Task 3: State model

**Files:**
- Create: `src/games/shadow-trace/engine/state.ts`
- Test: `tests/engine-state.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/engine-state.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  createCaseProgress,
  applyEffects,
  visitNode,
  chooseOption,
} from '@/games/shadow-trace/engine/state';
import { sampleCase } from './fixtures/sample-case-v2';
import type { CaseV2 } from '@/games/shadow-trace/engine/types';

describe('createCaseProgress', () => {
  it('opens the start nodes and starts empty', () => {
    const p = createCaseProgress(sampleCase);
    expect(p.openNodes).toEqual(['n_scene', 'n_interview']);
    expect(p.discoveredEvidence).toEqual([]);
    expect(p.foundContradictions).toEqual([]);
  });
});

describe('applyEffects', () => {
  it('is immutable and idempotent for set-like effects', () => {
    const p = createCaseProgress(sampleCase);
    const next = applyEffects(p, [{ addEvidence: 'e_photo' }, { setFlag: 'lab_done' }]);
    expect(next).not.toBe(p);
    expect(p.discoveredEvidence).toEqual([]); // original untouched
    expect(next.discoveredEvidence).toEqual(['e_photo']);
    expect(next.flags.lab_done).toBe(true);
    const again = applyEffects(next, [{ addEvidence: 'e_photo' }]);
    expect(again.discoveredEvidence).toEqual(['e_photo']); // no duplicate
  });

  it('lockNode removes an open node', () => {
    const p = createCaseProgress(sampleCase);
    const next = applyEffects(p, [{ lockNode: 'n_scene' }]);
    expect(next.openNodes).toEqual(['n_interview']);
  });
});

describe('visitNode', () => {
  it('grants a node payload and marks it visited', () => {
    const p = createCaseProgress(sampleCase);
    const next = visitNode(sampleCase, p, 'n_scene');
    expect(next.discoveredEvidence).toContain('e_photo');
    expect(next.visitedNodes).toContain('n_scene');
  });

  it('refuses to visit a locked or gated node', () => {
    const p = createCaseProgress(sampleCase);
    const next = visitNode(sampleCase, p, 'n_lab'); // not open, requires contradiction
    expect(next).toBe(p);
  });
});

describe('chooseOption', () => {
  it('applies choice effects and records the choice', () => {
    const withChoice: CaseV2 = {
      ...sampleCase,
      nodes: sampleCase.nodes.map((n) =>
        n.id === 'n_interview'
          ? { ...n, choices: [{ id: 'press', label: 'Надавить', effects: [{ setFlag: 'pressed' }] }] }
          : n,
      ),
    };
    const p = createCaseProgress(withChoice);
    const next = chooseOption(withChoice, p, 'n_interview', 'press');
    expect(next.flags.pressed).toBe(true);
    expect(next.choicesMade.n_interview).toBe('press');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd /c/Projects/browser_game && npx vitest run tests/engine-state.test.ts
```
Expected: FAIL — cannot resolve `@/games/shadow-trace/engine/state`.

- [ ] **Step 3: Write minimal implementation**

Create `src/games/shadow-trace/engine/state.ts`:
```ts
import type { CaseV2, CaseProgressV2, Effect } from './types';
import { evaluateCondition } from './conditions';

const addUnique = (arr: string[], v: string): string[] => (arr.includes(v) ? arr : [...arr, v]);

export function createCaseProgress(caseData: CaseV2): CaseProgressV2 {
  return {
    caseId: caseData.id,
    openNodes: [...caseData.startNodeIds],
    visitedNodes: [],
    discoveredEvidence: [],
    discoveredStatements: [],
    flags: {},
    foundContradictions: [],
    links: [],
    notes: [],
    choicesMade: {},
  };
}

/** Apply a list of effects immutably. Set-like effects are idempotent. */
export function applyEffects(state: CaseProgressV2, effects: Effect[] | undefined): CaseProgressV2 {
  if (!effects || effects.length === 0) return state;
  const next: CaseProgressV2 = {
    ...state,
    openNodes: [...state.openNodes],
    discoveredEvidence: [...state.discoveredEvidence],
    discoveredStatements: [...state.discoveredStatements],
    flags: { ...state.flags },
  };
  for (const e of effects) {
    if (e.setFlag) next.flags[e.setFlag] = true;
    if (e.addNode) next.openNodes = addUnique(next.openNodes, e.addNode);
    if (e.lockNode) next.openNodes = next.openNodes.filter((id) => id !== e.lockNode);
    if (e.addEvidence) next.discoveredEvidence = addUnique(next.discoveredEvidence, e.addEvidence);
    if (e.addStatement) next.discoveredStatements = addUnique(next.discoveredStatements, e.addStatement);
  }
  return next;
}

/** Visit an open, unblocked node: apply its grants, mark visited. No-op otherwise. */
export function visitNode(caseData: CaseV2, state: CaseProgressV2, nodeId: string): CaseProgressV2 {
  const node = caseData.nodes.find((n) => n.id === nodeId);
  if (!node) return state;
  if (!state.openNodes.includes(nodeId)) return state;
  if (node.requires && !evaluateCondition(node.requires, state)) return state;
  const granted = applyEffects(state, node.grants);
  return { ...granted, visitedNodes: addUnique(granted.visitedNodes, nodeId) };
}

/** Make a choice at a node: apply its effects, record it. No-op if gated/missing. */
export function chooseOption(
  caseData: CaseV2,
  state: CaseProgressV2,
  nodeId: string,
  choiceId: string,
): CaseProgressV2 {
  const node = caseData.nodes.find((n) => n.id === nodeId);
  const choice = node?.choices?.find((c) => c.id === choiceId);
  if (!choice) return state;
  if (choice.requires && !evaluateCondition(choice.requires, state)) return state;
  const applied = applyEffects(state, choice.effects);
  return { ...applied, choicesMade: { ...applied.choicesMade, [nodeId]: choiceId } };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd /c/Projects/browser_game && npx vitest run tests/engine-state.test.ts
```
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

Run:
```bash
cd /c/Projects/browser_game && git add src/games/shadow-trace/engine/state.ts tests/engine-state.test.ts && git commit -m "feat(shadow-trace): v2 case state model"
```

---

## Task 4: Contradiction matcher

**Files:**
- Create: `src/games/shadow-trace/engine/contradictions.ts`
- Test: `tests/engine-contradictions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/engine-contradictions.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  matchContradiction,
  discoverContradiction,
  addLink,
} from '@/games/shadow-trace/engine/contradictions';
import { createCaseProgress } from '@/games/shadow-trace/engine/state';
import { sampleCase } from './fixtures/sample-case-v2';
import type { FactRef } from '@/games/shadow-trace/engine/types';

const stRef: FactRef = { type: 'statement', refId: 'st_eron_home' };
const metaRef: FactRef = { type: 'metadata', refId: 'e_photo' };

describe('matchContradiction', () => {
  it('matches a pair regardless of order', () => {
    expect(matchContradiction(sampleCase, stRef, metaRef)?.id).toBe('c_time');
    expect(matchContradiction(sampleCase, metaRef, stRef)?.id).toBe('c_time');
  });

  it('returns null for an unrelated pair', () => {
    expect(matchContradiction(sampleCase, stRef, { type: 'evidence', refId: 'e_log' })).toBeNull();
  });
});

describe('discoverContradiction', () => {
  it('marks found and applies unlocks (opens n_lab)', () => {
    const p = createCaseProgress(sampleCase);
    const next = discoverContradiction(sampleCase, p, 'c_time');
    expect(next.foundContradictions).toContain('c_time');
    expect(next.openNodes).toContain('n_lab');
  });

  it('is a no-op when already found', () => {
    const p = discoverContradiction(sampleCase, createCaseProgress(sampleCase), 'c_time');
    const again = discoverContradiction(sampleCase, p, 'c_time');
    expect(again).toBe(p);
  });
});

describe('addLink', () => {
  it('discovers the contradiction on a correct contradicts link', () => {
    const p = createCaseProgress(sampleCase);
    const next = addLink(sampleCase, p, { fromRef: stRef, toRef: metaRef, relation: 'contradicts' });
    expect(next.links).toHaveLength(1);
    expect(next.foundContradictions).toContain('c_time');
  });

  it('keeps a wrong contradicts link as a harmless hypothesis', () => {
    const p = createCaseProgress(sampleCase);
    const next = addLink(sampleCase, p, {
      fromRef: stRef,
      toRef: { type: 'evidence', refId: 'e_log' },
      relation: 'contradicts',
    });
    expect(next.links).toHaveLength(1);
    expect(next.foundContradictions).toEqual([]);
  });

  it('does not match contradictions for non-contradicts relations', () => {
    const p = createCaseProgress(sampleCase);
    const next = addLink(sampleCase, p, { fromRef: stRef, toRef: metaRef, relation: 'supports' });
    expect(next.foundContradictions).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd /c/Projects/browser_game && npx vitest run tests/engine-contradictions.test.ts
```
Expected: FAIL — cannot resolve `@/games/shadow-trace/engine/contradictions`.

- [ ] **Step 3: Write minimal implementation**

Create `src/games/shadow-trace/engine/contradictions.ts`:
```ts
import type { CaseV2, CaseProgressV2, Contradiction, FactRef, PlayerLink } from './types';
import { applyEffects } from './state';

const sameRef = (a: FactRef, b: FactRef): boolean => a.type === b.type && a.refId === b.refId;

const samePair = (pair: readonly [FactRef, FactRef], a: FactRef, b: FactRef): boolean =>
  (sameRef(pair[0], a) && sameRef(pair[1], b)) || (sameRef(pair[0], b) && sameRef(pair[1], a));

/** The authored contradiction a `contradicts` link maps to, or null. Order-independent. */
export function matchContradiction(caseData: CaseV2, a: FactRef, b: FactRef): Contradiction | null {
  return caseData.contradictions.find((c) => samePair(c.between, a, b)) ?? null;
}

/** Mark a contradiction found and apply its unlocks. No-op if already found or unknown. */
export function discoverContradiction(
  caseData: CaseV2,
  state: CaseProgressV2,
  contradictionId: string,
): CaseProgressV2 {
  if (state.foundContradictions.includes(contradictionId)) return state;
  const c = caseData.contradictions.find((x) => x.id === contradictionId);
  if (!c) return state;
  const withFound: CaseProgressV2 = {
    ...state,
    foundContradictions: [...state.foundContradictions, contradictionId],
  };
  return applyEffects(withFound, c.unlocks);
}

/** Record a board link; a correct `contradicts` link auto-discovers its contradiction. */
export function addLink(caseData: CaseV2, state: CaseProgressV2, link: PlayerLink): CaseProgressV2 {
  const withLink: CaseProgressV2 = { ...state, links: [...state.links, link] };
  if (link.relation !== 'contradicts') return withLink;
  const matched = matchContradiction(caseData, link.fromRef, link.toRef);
  if (!matched) return withLink;
  return discoverContradiction(caseData, withLink, matched.id);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd /c/Projects/browser_game && npx vitest run tests/engine-contradictions.test.ts
```
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

Run:
```bash
cd /c/Projects/browser_game && git add src/games/shadow-trace/engine/contradictions.ts tests/engine-contradictions.test.ts && git commit -m "feat(shadow-trace): v2 contradiction matcher"
```

---

## Task 5: Ending resolver + scoring

**Files:**
- Create: `src/games/shadow-trace/engine/endings.ts`
- Test: `tests/engine-endings.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/engine-endings.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { resolveEnding, scoreCaseV2 } from '@/games/shadow-trace/engine/endings';
import { createCaseProgress } from '@/games/shadow-trace/engine/state';
import { addLink } from '@/games/shadow-trace/engine/contradictions';
import { sampleCase } from './fixtures/sample-case-v2';
import type { CaseProgressV2, FactRef } from '@/games/shadow-trace/engine/types';

const stRef: FactRef = { type: 'statement', refId: 'st_eron_home' };
const metaRef: FactRef = { type: 'metadata', refId: 'e_photo' };

/** A fully-solved run: contradiction found, lab flag set, correct accusation, fake flagged. */
function solved(): CaseProgressV2 {
  let p = createCaseProgress(sampleCase);
  p = addLink(sampleCase, p, { fromRef: stRef, toRef: metaRef, relation: 'contradicts' });
  p = { ...p, flags: { ...p.flags, lab_done: true } };
  p = { ...p, accusation: { culpritId: 's_eron', fakeEvidenceIds: ['e_photo'], keyContradictionIds: ['c_time'] } };
  return p;
}

describe('resolveEnding', () => {
  it('returns the first ending whose requires holds (truth for a full solve)', () => {
    expect(resolveEnding(sampleCase, solved()).id).toBe('end_truth');
  });

  it('falls through to partial when the proof is incomplete', () => {
    const p = { ...createCaseProgress(sampleCase), accusation: { culpritId: 's_eron', fakeEvidenceIds: [], keyContradictionIds: [] } };
    expect(resolveEnding(sampleCase, p).id).toBe('end_partial');
  });

  it('returns miscarriage when accusing the innocent', () => {
    const p = { ...createCaseProgress(sampleCase), accusation: { culpritId: 's_mara', fakeEvidenceIds: [], keyContradictionIds: [] } };
    expect(resolveEnding(sampleCase, p).id).toBe('end_miscarriage');
  });

  it('returns cold_case catch-all with no accusation', () => {
    expect(resolveEnding(sampleCase, createCaseProgress(sampleCase)).quality).toBe('cold_case');
  });
});

describe('scoreCaseV2', () => {
  it('gives a perfect S for a full solve and carries campaign flags', () => {
    const r = scoreCaseV2(sampleCase, solved());
    expect(r.accusationQuality).toBe('truth');
    expect(r.contradictionsFound).toBe(1);
    expect(r.contradictionsTotal).toBe(1);
    expect(r.fakesIdentified).toBe(1);
    expect(r.fakesTotal).toBe(1);
    expect(r.correctLinks).toBe(1);
    expect(r.falseLinks).toBe(0);
    expect(r.rank).toBe('S');
    expect(r.flagsForCampaign).toEqual(['eron_jailed']);
  });

  it('penalises false contradicts links', () => {
    let p = solved();
    p = addLink(sampleCase, p, { fromRef: stRef, toRef: { type: 'evidence', refId: 'e_log' }, relation: 'contradicts' });
    const r = scoreCaseV2(sampleCase, p);
    expect(r.falseLinks).toBe(1);
    expect(r.rank).not.toBe('S');
  });

  it('scores a miscarriage low', () => {
    const p = { ...createCaseProgress(sampleCase), accusation: { culpritId: 's_mara', fakeEvidenceIds: [], keyContradictionIds: [] } };
    const r = scoreCaseV2(sampleCase, p);
    expect(r.accusationQuality).toBe('miscarriage');
    expect(r.rank).toBe('F');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd /c/Projects/browser_game && npx vitest run tests/engine-endings.test.ts
```
Expected: FAIL — cannot resolve `@/games/shadow-trace/engine/endings`.

- [ ] **Step 3: Write minimal implementation**

Create `src/games/shadow-trace/engine/endings.ts`:
```ts
import type { CaseV2, CaseProgressV2, Ending, DeductionResultV2, Rank, EndingQuality } from './types';
import { evaluateCondition } from './conditions';
import { matchContradiction } from './contradictions';

const COLD_CASE_FALLBACK: Ending = {
  id: 'cold_case_default',
  title: 'Дело закрыто без ответа',
  requires: { all: [] },
  quality: 'cold_case',
  epilogue: ['Улик не хватило. Дело отправлено в архив.'],
};

/** First ending whose `requires` holds, top-down. Synthetic cold_case if none match. */
export function resolveEnding(caseData: CaseV2, state: CaseProgressV2): Ending {
  return caseData.endings.find((e) => evaluateCondition(e.requires, state)) ?? COLD_CASE_FALLBACK;
}

function rankFor(score: number): Rank {
  if (score >= 95) return 'S';
  if (score >= 80) return 'A';
  if (score >= 65) return 'B';
  if (score >= 45) return 'C';
  return 'F';
}

/**
 * Deterministic scoring out of 100:
 *   contradictions 50 · fakes 25 · accusation quality 25 · minus 10 per false link (cap 30).
 */
export function scoreCaseV2(caseData: CaseV2, state: CaseProgressV2): DeductionResultV2 {
  const contradictionsTotal = caseData.contradictions.length;
  const contradictionsFound = state.foundContradictions.length;

  let correctLinks = 0;
  let falseLinks = 0;
  for (const link of state.links) {
    if (link.relation !== 'contradicts') continue;
    if (matchContradiction(caseData, link.fromRef, link.toRef)) correctLinks += 1;
    else falseLinks += 1;
  }

  const fakeEvidence = caseData.evidence.filter((e) => e.authenticity === 'fake');
  const fakesTotal = fakeEvidence.length;
  const accusedFakes = new Set(state.accusation?.fakeEvidenceIds ?? []);
  const fakesIdentified = fakeEvidence.filter((e) => accusedFakes.has(e.id)).length;

  const ending = resolveEnding(caseData, state);
  const accusationQuality: EndingQuality = ending.quality;

  const contradictionScore = contradictionsTotal ? (contradictionsFound / contradictionsTotal) * 50 : 50;
  const fakeScore = fakesTotal ? (fakesIdentified / fakesTotal) * 25 : 25;
  const qualityScore = accusationQuality === 'truth' ? 25 : accusationQuality === 'partial' ? 12 : 0;
  const penalty = Math.min(falseLinks * 10, 30);
  const score = Math.max(0, Math.round(contradictionScore + fakeScore + qualityScore - penalty));

  const flagsForCampaign = (ending.campaignEffects ?? [])
    .map((e) => e.setFlag)
    .filter((f): f is string => Boolean(f));

  return {
    rank: rankFor(score),
    contradictionsFound,
    contradictionsTotal,
    correctLinks,
    falseLinks,
    fakesIdentified,
    fakesTotal,
    accusationQuality,
    flagsForCampaign,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd /c/Projects/browser_game && npx vitest run tests/engine-endings.test.ts
```
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

Run:
```bash
cd /c/Projects/browser_game && git add src/games/shadow-trace/engine/endings.ts tests/engine-endings.test.ts && git commit -m "feat(shadow-trace): v2 ending resolver + scoring"
```

---

## Task 6: Content validator

**Files:**
- Create: `src/games/shadow-trace/engine/validator.ts`
- Test: `tests/engine-validator.test.ts`

The validator runs an optimistic forward-reachability fixpoint over the case graph: starting from `startNodeIds` with an empty obtainable set, it repeatedly opens nodes / grants evidence-flags-statements / finds contradictions until nothing changes, then checks every node, contradiction, and ending is reachable, that a `truth` ending exists, and that media/refs are structurally sound.

- [ ] **Step 1: Write the failing test**

Create `tests/engine-validator.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { validateCase } from '@/games/shadow-trace/engine/validator';
import { sampleCase } from './fixtures/sample-case-v2';
import type { CaseV2 } from '@/games/shadow-trace/engine/types';

describe('validateCase', () => {
  it('passes the valid sample case', () => {
    const r = validateCase(sampleCase);
    expect(r.ok).toBe(true);
    expect(r.issues).toEqual([]);
  });

  it('flags an unreachable node', () => {
    const broken: CaseV2 = {
      ...sampleCase,
      nodes: [...sampleCase.nodes, { id: 'n_orphan', type: 'location', title: 'Сирота', body: [], requires: { hasFlag: 'never_set' } }],
    };
    const r = validateCase(broken);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'unreachable_node')).toBe(true);
  });

  it('flags an unreachable contradiction', () => {
    const broken: CaseV2 = {
      ...sampleCase,
      contradictions: [
        ...sampleCase.contradictions,
        {
          id: 'c_ghost',
          between: [{ type: 'statement', refId: 'st_eron_home' }, { type: 'evidence', refId: 'e_missing' }],
          rule: 'mutual_exclusive',
          weight: 1,
        },
      ],
    };
    const r = validateCase(broken);
    expect(r.ok).toBe(false);
    // e_missing does not exist -> bad_factref, and the contradiction is never findable
    expect(r.issues.some((i) => i.code === 'bad_factref')).toBe(true);
    expect(r.issues.some((i) => i.code === 'unreachable_contradiction')).toBe(true);
  });

  it('flags a hotspot out of bounds', () => {
    const broken: CaseV2 = {
      ...sampleCase,
      evidence: sampleCase.evidence.map((e) =>
        e.id === 'e_photo' && e.media
          ? { ...e, media: { ...e.media, hotspots: [{ id: 'bad', at: { x: 90, y: 90, w: 30, h: 30 }, label: '' }] } }
          : e,
      ),
    };
    const r = validateCase(broken);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'hotspot_oob')).toBe(true);
  });

  it('flags a case with no reachable truth ending', () => {
    const broken: CaseV2 = {
      ...sampleCase,
      endings: sampleCase.endings.map((e) => (e.quality === 'truth' ? { ...e, quality: 'partial' as const } : e)),
    };
    const r = validateCase(broken);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'no_truth_path')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd /c/Projects/browser_game && npx vitest run tests/engine-validator.test.ts
```
Expected: FAIL — cannot resolve `@/games/shadow-trace/engine/validator`.

- [ ] **Step 3: Write minimal implementation**

Create `src/games/shadow-trace/engine/validator.ts`:
```ts
import type { CaseV2, Condition, Effect, FactRef } from './types';
import type { Rect, MediaSpec } from './media-types';

export interface ValidationIssue {
  code: string;
  message: string;
}
export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

interface Obtainable {
  evidence: Set<string>;
  flags: Set<string>;
  statements: Set<string>;
  contradictions: Set<string>;
  nodes: Set<string>;
}

/** Could this condition EVER be satisfied given the optimistic obtainable set? */
function satisfiable(cond: Condition, o: Obtainable): boolean {
  if ('hasEvidence' in cond) return o.evidence.has(cond.hasEvidence);
  if ('hasFlag' in cond) return o.flags.has(cond.hasFlag);
  if ('foundContradiction' in cond) return o.contradictions.has(cond.foundContradiction);
  if ('accuse' in cond) return true; // the player may always accuse anyone
  if ('all' in cond) return cond.all.every((c) => satisfiable(c, o));
  if ('any' in cond) return cond.any.some((c) => satisfiable(c, o));
  if ('not' in cond) return true; // optimistically: simply don't obtain the negated atom
  return false;
}

function applyEffectsOptimistic(effects: Effect[] | undefined, o: Obtainable): boolean {
  let changed = false;
  for (const e of effects ?? []) {
    if (e.setFlag && !o.flags.has(e.setFlag)) (o.flags.add(e.setFlag), (changed = true));
    if (e.addNode && !o.nodes.has(e.addNode)) (o.nodes.add(e.addNode), (changed = true));
    if (e.addEvidence && !o.evidence.has(e.addEvidence)) (o.evidence.add(e.addEvidence), (changed = true));
    if (e.addStatement && !o.statements.has(e.addStatement)) (o.statements.add(e.addStatement), (changed = true));
  }
  return changed;
}

function refExists(caseData: CaseV2, ref: FactRef): boolean {
  if (ref.type === 'statement') return caseData.statements.some((s) => s.id === ref.refId);
  if (ref.type === 'metadata') return caseData.evidence.some((e) => e.id === ref.refId && !!e.metadata);
  return caseData.evidence.some((e) => e.id === ref.refId); // 'evidence'
}

const inBounds = (r: Rect): boolean =>
  r.x >= 0 && r.y >= 0 && r.w > 0 && r.h > 0 && r.x + r.w <= 100 && r.y + r.h <= 100;

function validateMedia(evidenceId: string, media: MediaSpec, issues: ValidationIssue[]): void {
  for (const h of media.hotspots) {
    if (!inBounds(h.at)) issues.push({ code: 'hotspot_oob', message: `${evidenceId}: хотспот ${h.id} вне сцены` });
  }
  if (media.frames) {
    for (let i = 1; i < media.frames.length; i += 1) {
      if (media.frames[i].t < media.frames[i - 1].t) {
        issues.push({ code: 'frames_unsorted', message: `${evidenceId}: кадры видео не отсортированы по t` });
        break;
      }
    }
  }
}

function obtainableRef(ref: FactRef, o: Obtainable): boolean {
  if (ref.type === 'statement') return o.statements.has(ref.refId);
  return o.evidence.has(ref.refId); // evidence | metadata both keyed by evidence id
}

export function validateCase(caseData: CaseV2): ValidationResult {
  const issues: ValidationIssue[] = [];
  const nodeIds = new Set(caseData.nodes.map((n) => n.id));

  // 1. structural: factrefs resolve
  for (const c of caseData.contradictions) {
    for (const ref of c.between) {
      if (!refExists(caseData, ref)) {
        issues.push({ code: 'bad_factref', message: `Противоречие ${c.id}: ссылка ${ref.type}:${ref.refId} не найдена` });
      }
    }
  }
  // 2. media structural
  for (const e of caseData.evidence) {
    if (e.media) validateMedia(e.id, e.media, issues);
  }
  // 3. start nodes exist
  for (const id of caseData.startNodeIds) {
    if (!nodeIds.has(id)) issues.push({ code: 'bad_start_node', message: `startNode ${id} не найден` });
  }

  // 4. optimistic reachability fixpoint
  const o: Obtainable = {
    evidence: new Set(),
    flags: new Set(),
    statements: new Set(),
    contradictions: new Set(),
    nodes: new Set(caseData.startNodeIds.filter((id) => nodeIds.has(id))),
  };
  let changed = true;
  let guard = 0;
  while (changed && guard < 10_000) {
    guard += 1;
    changed = false;
    for (const node of caseData.nodes) {
      if (!o.nodes.has(node.id)) continue;
      if (node.requires && !satisfiable(node.requires, o)) continue;
      if (applyEffectsOptimistic(node.grants, o)) changed = true;
      for (const ch of node.choices ?? []) {
        if (ch.requires && !satisfiable(ch.requires, o)) continue;
        if (applyEffectsOptimistic(ch.effects, o)) changed = true;
      }
    }
    for (const c of caseData.contradictions) {
      if (o.contradictions.has(c.id)) continue;
      if (c.between.every((ref) => obtainableRef(ref, o))) {
        o.contradictions.add(c.id);
        applyEffectsOptimistic(c.unlocks, o);
        changed = true;
      }
    }
  }

  // 5. coverage
  for (const node of caseData.nodes) {
    if (!o.nodes.has(node.id)) issues.push({ code: 'unreachable_node', message: `Узел ${node.id} недостижим` });
  }
  for (const c of caseData.contradictions) {
    if (!o.contradictions.has(c.id)) {
      issues.push({ code: 'unreachable_contradiction', message: `Противоречие ${c.id} нераскрываемо` });
    }
  }
  for (const e of caseData.endings) {
    if (!satisfiable(e.requires, o)) issues.push({ code: 'unreachable_ending', message: `Концовка ${e.id} недостижима` });
  }
  if (!caseData.endings.some((e) => e.quality === 'truth' && satisfiable(e.requires, o))) {
    issues.push({ code: 'no_truth_path', message: 'Нет достижимой truth-концовки' });
  }

  return { ok: issues.length === 0, issues };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd /c/Projects/browser_game && npx vitest run tests/engine-validator.test.ts
```
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

Run:
```bash
cd /c/Projects/browser_game && git add src/games/shadow-trace/engine/validator.ts tests/engine-validator.test.ts && git commit -m "feat(shadow-trace): v2 content validator"
```

---

## Task 7: Public barrel + full green run

**Files:**
- Create: `src/games/shadow-trace/engine/index.ts`

- [ ] **Step 1: Write the barrel**

Create `src/games/shadow-trace/engine/index.ts`:
```ts
export * from './types';
export * from './media-types';
export { evaluateCondition } from './conditions';
export { createCaseProgress, applyEffects, visitNode, chooseOption } from './state';
export { matchContradiction, discoverContradiction, addLink } from './contradictions';
export { resolveEnding, scoreCaseV2 } from './endings';
export { validateCase } from './validator';
export type { ValidationIssue, ValidationResult } from './validator';
```

- [ ] **Step 2: Verify the whole suite + types are green**

Run:
```bash
cd /c/Projects/browser_game && npm run typecheck && npm test
```
Expected: typecheck PASS (exit 0); vitest runs ALL tests (existing colony/save/scoring + the 5 new engine suites) and reports PASS with 0 failures.

- [ ] **Step 3: Commit**

Run:
```bash
cd /c/Projects/browser_game && git add src/games/shadow-trace/engine/index.ts && git commit -m "feat(shadow-trace): v2 engine public barrel"
```

---

## Done criteria for Этап 0

- `src/games/shadow-trace/engine/` exports a pure, deterministic v2 case engine.
- `validateCase(sampleCase).ok === true`; broken cases produce coded issues.
- `npm test` and `npm run typecheck` both green.
- v1 game still untouched and working.

**Next plan (Этап 1):** detective desk UI (Досье, Хранилище улик, Карта зацепок, Доска связей v2, Стол обвинения) + photo media inspector, wired to this engine and mounted as the Shadow Trace `GameModule`. Write that plan once this one is merged.
```
