# Shadow Trace v2 — Этап 1a: Engine→UI Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the read-only/derive layer the detective desk UI needs (node/choice/hotspot/artifact selectors, hotspot inspection, dossier-fact derivation) plus broaden the content validator (id-uniqueness, dangling-ref, suspect-ref checks) — all pure, deterministic, fully unit-tested, with no UI.

**Architecture:** Extends the Этап 0 engine (`src/games/shadow-trace/engine/`). A new `selectors.ts` module turns engine state into exactly what a thin React layer renders (so the UI never re-implements `evaluateCondition` gating). `CaseProgressV2` gains `inspectedHotspots`; a derived `Fact` type powers the dossier and feeds the board's `addLink`. The validator gains structural integrity checks so authored cases fail fast.

**Tech Stack:** TypeScript (strict), Vitest, `@/` alias → `src/`. No new dependencies.

**Scope note:** This is Этап 1a of `docs/superpowers/specs/2026-06-18-shadow-trace-v2-design.md` (Секции 1, 3, 4). It implements the "missing engine selectors / broadened validator" called out in the Этап 0→1 handoff notes. **Этап 1b** (the React desk components, photo inspector, an authored vertical-slice case JSON + loader, and `GameModule` wiring) is a **separate plan** — there is no React test environment configured (vitest runs in node, no jsdom/RTL), so the UI is verified by running the app, not unit tests. Keeping 1a pure-logic lets it be fully TDD'd here.

**Project state note:** Whole-project `npm run typecheck` is currently clean (0 errors). If a concurrent colony rework reintroduces colony-only errors, verify your work with `npm run typecheck 2>&1 | grep -E "error TS" | grep -vc colony` (must be `0`). Always `git add <explicit paths>` (never `-A`/`.`) — the repo often has unrelated concurrent work in the tree.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/games/shadow-trace/engine/types.ts` (modify) | add `Fact` interface; add `inspectedHotspots: string[]` to `CaseProgressV2` |
| `src/games/shadow-trace/engine/state.ts` (modify) | `createCaseProgress` seeds `inspectedHotspots`; `applyEffects` copies it |
| `tests/engine-conditions.test.ts` (modify) | add `inspectedHotspots: []` to the hand-built state literal |
| `src/games/shadow-trace/engine/selectors.ts` (create) | `getOpenNodes`, `getAvailableChoices`, `getVisibleHotspots`, `getDetectedArtifacts`, `inspectHotspot`, `buildDossier` |
| `tests/engine-selectors.test.ts` (create) | tests for every selector |
| `src/games/shadow-trace/engine/validator.ts` (modify) | `duplicate_id`, `bad_effect_target`, `bad_suspect_ref` checks |
| `tests/engine-validator.test.ts` (modify) | tests for the three new checks |
| `src/games/shadow-trace/engine/index.ts` (modify) | re-export selectors + `OpenNode` |

The shared fixture `tests/fixtures/sample-case-v2.ts` is **not** modified; selector/validator tests build `{ ...sampleCase, ... }` variants inline (matching the existing validator-test style).

---

## Task 1: Extend state with `inspectedHotspots` and add the `Fact` type

**Files:**
- Modify: `src/games/shadow-trace/engine/types.ts`
- Modify: `src/games/shadow-trace/engine/state.ts`
- Modify: `tests/engine-conditions.test.ts`
- Test: `tests/engine-state.test.ts`

- [ ] **Step 1: Write the failing test**

In `tests/engine-state.test.ts`, add this test as the LAST `it` inside the existing `describe('createCaseProgress', ...)` block:

```ts
  it('seeds an empty inspectedHotspots list', () => {
    expect(createCaseProgress(sampleCase).inspectedHotspots).toEqual([]);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine-state.test.ts`
Expected: FAIL — `createCaseProgress(...).inspectedHotspots` is `undefined`, so `toEqual([])` fails.

- [ ] **Step 3: Implement the type + state changes**

(a) In `src/games/shadow-trace/engine/types.ts`, find the `CaseProgressV2` interface and add `inspectedHotspots` right after `visitedNodes`:

```ts
export interface CaseProgressV2 {
  caseId: string;
  openNodes: string[];
  visitedNodes: string[];
  inspectedHotspots: string[];
  discoveredEvidence: string[];
  discoveredStatements: string[];
  flags: Record<string, boolean | number | string>;
  foundContradictions: string[];
  links: PlayerLink[];
  notes: string[];
  choicesMade: Record<string, string>;
  accusation?: Accusation;
}
```

(b) In the same file, add the `Fact` interface immediately AFTER the `DeductionResultV2` interface (it reuses the existing `TimeSpan` type):

```ts
/** A derived dossier card: one atomic fact the player has learned. Its `source`
 *  doubles as a FactRef the board's addLink consumes. */
export interface Fact {
  id: string;
  source: { type: 'evidence' | 'statement' | 'hotspot' | 'metadata'; refId: string };
  text: string;
  subjectIds: string[];
  time?: TimeSpan;
  place?: string;
}
```

(c) In `src/games/shadow-trace/engine/state.ts`, find `createCaseProgress` and add `inspectedHotspots: []` after `visitedNodes: []`:

```ts
export function createCaseProgress(caseData: CaseV2): CaseProgressV2 {
  return {
    caseId: caseData.id,
    openNodes: [...caseData.startNodeIds],
    visitedNodes: [],
    inspectedHotspots: [],
    discoveredEvidence: [],
    discoveredStatements: [],
    flags: {},
    foundContradictions: [],
    links: [],
    notes: [],
    choicesMade: {},
  };
}
```

(d) In `applyEffects` (same file), add `inspectedHotspots` to the immutable copy so the full-immutability contract holds. Find the `next` initializer and add the line:

```ts
  const next: CaseProgressV2 = {
    ...state,
    openNodes: [...state.openNodes],
    inspectedHotspots: [...state.inspectedHotspots],
    discoveredEvidence: [...state.discoveredEvidence],
    discoveredStatements: [...state.discoveredStatements],
    foundContradictions: [...state.foundContradictions],
    links: [...state.links],
    notes: [...state.notes],
    flags: { ...state.flags },
  };
```

(e) In `tests/engine-conditions.test.ts`, the hand-built `const state: CaseProgressV2 = { ... }` literal now misses a required field. Add `inspectedHotspots: []` right after the `visitedNodes: [],` line:

```ts
  visitedNodes: [],
  inspectedHotspots: [],
```

- [ ] **Step 4: Run tests + typecheck to verify they pass**

Run: `npx vitest run tests/engine-state.test.ts tests/engine-conditions.test.ts`
Expected: PASS (state suite now 8 tests, conditions suite unchanged).
Run: `npm run typecheck 2>&1 | grep -E "error TS" | grep -vc colony`
Expected: prints `0` (no non-colony type errors — confirms the conditions literal fix is complete).

- [ ] **Step 5: Commit**

```bash
git add src/games/shadow-trace/engine/types.ts src/games/shadow-trace/engine/state.ts tests/engine-state.test.ts tests/engine-conditions.test.ts
git commit -m "feat(shadow-trace): add inspectedHotspots state + Fact type"
```

---

## Task 2: Selectors — `getOpenNodes` and `getAvailableChoices`

**Files:**
- Create: `src/games/shadow-trace/engine/selectors.ts`
- Test: `tests/engine-selectors.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/engine-selectors.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getOpenNodes, getAvailableChoices } from '@/games/shadow-trace/engine/selectors';
import { createCaseProgress } from '@/games/shadow-trace/engine/state';
import { sampleCase } from './fixtures/sample-case-v2';
import type { CaseProgressV2, LeadNode } from '@/games/shadow-trace/engine/types';

describe('getOpenNodes', () => {
  it('returns the open nodes flagged enterable', () => {
    const open = getOpenNodes(sampleCase, createCaseProgress(sampleCase));
    expect(open.map((o) => o.node.id)).toEqual(['n_scene', 'n_interview']);
    expect(open.every((o) => o.enterable)).toBe(true);
  });

  it('marks an open node whose requires is unmet as not enterable', () => {
    const state: CaseProgressV2 = { ...createCaseProgress(sampleCase), openNodes: ['n_lab'] };
    const open = getOpenNodes(sampleCase, state);
    expect(open).toHaveLength(1);
    expect(open[0].node.id).toBe('n_lab');
    expect(open[0].enterable).toBe(false); // requires foundContradiction c_time, not found
  });
});

describe('getAvailableChoices', () => {
  const node: LeadNode = {
    id: 'n_x',
    type: 'interrogation',
    title: 'X',
    body: [],
    choices: [
      { id: 'open', label: 'Open', effects: [] },
      { id: 'gated', label: 'Gated', requires: { hasFlag: 'never' }, effects: [] },
    ],
  };

  it('returns only choices whose requires passes', () => {
    const choices = getAvailableChoices(node, createCaseProgress(sampleCase));
    expect(choices.map((c) => c.id)).toEqual(['open']);
  });

  it('returns [] for a node with no choices', () => {
    expect(getAvailableChoices({ ...node, choices: undefined }, createCaseProgress(sampleCase))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine-selectors.test.ts`
Expected: FAIL — cannot resolve `@/games/shadow-trace/engine/selectors`.

- [ ] **Step 3: Write minimal implementation**

Create `src/games/shadow-trace/engine/selectors.ts`:

```ts
import type { CaseV2, CaseProgressV2, LeadNode, Choice } from './types';
import { evaluateCondition } from './conditions';

export interface OpenNode {
  node: LeadNode;
  enterable: boolean;
}

/** Nodes currently in the open set, each flagged by whether its entry condition is met. */
export function getOpenNodes(caseData: CaseV2, state: CaseProgressV2): OpenNode[] {
  return state.openNodes
    .map((id) => caseData.nodes.find((n) => n.id === id))
    .filter((n): n is LeadNode => Boolean(n))
    .map((node) => ({ node, enterable: !node.requires || evaluateCondition(node.requires, state) }));
}

/** Choices on a node whose `requires` currently passes. */
export function getAvailableChoices(node: LeadNode, state: CaseProgressV2): Choice[] {
  return (node.choices ?? []).filter((c) => !c.requires || evaluateCondition(c.requires, state));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine-selectors.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/games/shadow-trace/engine/selectors.ts tests/engine-selectors.test.ts
git commit -m "feat(shadow-trace): node + choice selectors"
```

---

## Task 3: Selectors — `getVisibleHotspots` and `getDetectedArtifacts`

**Files:**
- Modify: `src/games/shadow-trace/engine/selectors.ts`
- Test: `tests/engine-selectors.test.ts`

- [ ] **Step 1: Write the failing test**

In `tests/engine-selectors.test.ts`, add these imports to the existing import lines (extend, don't duplicate):

```ts
import {
  getOpenNodes,
  getAvailableChoices,
  getVisibleHotspots,
  getDetectedArtifacts,
} from '@/games/shadow-trace/engine/selectors';
```

Then append these describe blocks at the end of the file:

```ts
describe('getVisibleHotspots', () => {
  const photo = sampleCase.evidence.find((e) => e.id === 'e_photo')!;

  it('returns hotspots with no reveal condition', () => {
    const hs = getVisibleHotspots(photo, createCaseProgress(sampleCase));
    expect(hs.map((h) => h.id)).toEqual(['h_clock']);
  });

  it('hides a hotspot whose revealRequires is unmet', () => {
    const gated = {
      ...photo,
      media: { ...photo.media!, hotspots: [{ ...photo.media!.hotspots[0], revealRequires: { hasFlag: 'never' } }] },
    };
    expect(getVisibleHotspots(gated, createCaseProgress(sampleCase))).toEqual([]);
  });

  it('returns [] for evidence with no media', () => {
    const log = sampleCase.evidence.find((e) => e.id === 'e_log')!;
    expect(getVisibleHotspots(log, createCaseProgress(sampleCase))).toEqual([]);
  });
});

describe('getDetectedArtifacts', () => {
  const photo = sampleCase.evidence.find((e) => e.id === 'e_photo')!;

  it('returns artifacts with no detect condition', () => {
    const arts = getDetectedArtifacts(photo, createCaseProgress(sampleCase));
    expect(arts.map((a) => a.id)).toEqual(['a_clock']);
  });

  it('hides an artifact whose detectRequires is unmet', () => {
    const gated = {
      ...photo,
      media: { ...photo.media!, artifacts: [{ ...photo.media!.artifacts![0], detectRequires: { hasFlag: 'never' } }] },
    };
    expect(getDetectedArtifacts(gated, createCaseProgress(sampleCase))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine-selectors.test.ts`
Expected: FAIL — `getVisibleHotspots`/`getDetectedArtifacts` are not exported.

- [ ] **Step 3: Write minimal implementation**

In `src/games/shadow-trace/engine/selectors.ts`, extend the imports and add the two functions:

```ts
import type { CaseV2, CaseProgressV2, LeadNode, Choice, Evidence } from './types';
import type { Hotspot, Artifact } from './media-types';
import { evaluateCondition } from './conditions';
```

(keep the existing `getOpenNodes`/`getAvailableChoices`, then add:)

```ts
/** Hotspots on the evidence's media whose reveal condition currently passes. */
export function getVisibleHotspots(evidence: Evidence, state: CaseProgressV2): Hotspot[] {
  return (evidence.media?.hotspots ?? []).filter(
    (h) => !h.revealRequires || evaluateCondition(h.revealRequires, state),
  );
}

/** Forgery artifacts on the evidence's media the player can currently detect. */
export function getDetectedArtifacts(evidence: Evidence, state: CaseProgressV2): Artifact[] {
  return (evidence.media?.artifacts ?? []).filter(
    (a) => !a.detectRequires || evaluateCondition(a.detectRequires, state),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine-selectors.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/games/shadow-trace/engine/selectors.ts tests/engine-selectors.test.ts
git commit -m "feat(shadow-trace): hotspot + artifact visibility selectors"
```

---

## Task 4: Selector — `inspectHotspot`

**Files:**
- Modify: `src/games/shadow-trace/engine/selectors.ts`
- Test: `tests/engine-selectors.test.ts`

- [ ] **Step 1: Write the failing test**

In `tests/engine-selectors.test.ts`, add `inspectHotspot` to the import list, and add this describe block at the end. It builds a case whose hotspot grants a flag:

```ts
import {
  getOpenNodes,
  getAvailableChoices,
  getVisibleHotspots,
  getDetectedArtifacts,
  inspectHotspot,
} from '@/games/shadow-trace/engine/selectors';
import type { CaseV2 } from '@/games/shadow-trace/engine/types';

function caseWithHotspotGrant(): CaseV2 {
  const photo = sampleCase.evidence.find((e) => e.id === 'e_photo')!;
  return {
    ...sampleCase,
    evidence: sampleCase.evidence.map((e) =>
      e.id === 'e_photo'
        ? { ...e, media: { ...photo.media!, hotspots: [{ ...photo.media!.hotspots[0], grants: [{ setFlag: 'saw_clock' }] }] } }
        : e,
    ),
  };
}

describe('inspectHotspot', () => {
  it('applies the hotspot grants and records it inspected', () => {
    const cd = caseWithHotspotGrant();
    const next = inspectHotspot(cd, createCaseProgress(cd), 'h_clock');
    expect(next.inspectedHotspots).toContain('h_clock');
    expect(next.flags.saw_clock).toBe(true);
  });

  it('is a no-op when already inspected', () => {
    const cd = caseWithHotspotGrant();
    const once = inspectHotspot(cd, createCaseProgress(cd), 'h_clock');
    const twice = inspectHotspot(cd, once, 'h_clock');
    expect(twice).toBe(once);
  });

  it('is a no-op for an unknown or hidden hotspot', () => {
    const cd = caseWithHotspotGrant();
    const p = createCaseProgress(cd);
    expect(inspectHotspot(cd, p, 'nope')).toBe(p);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine-selectors.test.ts`
Expected: FAIL — `inspectHotspot` is not exported.

- [ ] **Step 3: Write minimal implementation**

In `src/games/shadow-trace/engine/selectors.ts`, add an import for `applyEffects` and the function:

```ts
import { applyEffects } from './state';
```

```ts
/** Inspect a (visible) hotspot: mark it inspected and route its grants through applyEffects. */
export function inspectHotspot(caseData: CaseV2, state: CaseProgressV2, hotspotId: string): CaseProgressV2 {
  if (state.inspectedHotspots.includes(hotspotId)) return state;
  let hotspot: Hotspot | undefined;
  for (const e of caseData.evidence) {
    const found = e.media?.hotspots.find((h) => h.id === hotspotId);
    if (found) {
      hotspot = found;
      break;
    }
  }
  if (!hotspot) return state;
  if (hotspot.revealRequires && !evaluateCondition(hotspot.revealRequires, state)) return state;
  const granted = applyEffects(state, hotspot.grants);
  return { ...granted, inspectedHotspots: [...granted.inspectedHotspots, hotspotId] };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine-selectors.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add src/games/shadow-trace/engine/selectors.ts tests/engine-selectors.test.ts
git commit -m "feat(shadow-trace): hotspot inspection routes grants through engine"
```

---

## Task 5: Selector — `buildDossier`

**Files:**
- Modify: `src/games/shadow-trace/engine/selectors.ts`
- Test: `tests/engine-selectors.test.ts`

- [ ] **Step 1: Write the failing test**

In `tests/engine-selectors.test.ts`, add `buildDossier` to the import list and add this describe block at the end. It uses the real engine functions to advance state:

```ts
import {
  getOpenNodes,
  getAvailableChoices,
  getVisibleHotspots,
  getDetectedArtifacts,
  inspectHotspot,
  buildDossier,
} from '@/games/shadow-trace/engine/selectors';
import { visitNode } from '@/games/shadow-trace/engine/state';

describe('buildDossier', () => {
  it('is empty for a fresh case', () => {
    expect(buildDossier(sampleCase, createCaseProgress(sampleCase))).toEqual([]);
  });

  it('derives evidence, metadata, statement and inspected-hotspot facts', () => {
    let p = createCaseProgress(sampleCase);
    p = visitNode(sampleCase, p, 'n_scene'); // grants e_photo (has metadata)
    p = visitNode(sampleCase, p, 'n_interview'); // grants st_eron_home
    p = inspectHotspot(sampleCase, p, 'h_clock');

    const facts = buildDossier(sampleCase, p);
    const sources = facts.map((f) => `${f.source.type}:${f.source.refId}`);
    expect(sources).toContain('evidence:e_photo');
    expect(sources).toContain('metadata:e_photo'); // e_photo has metadata.time
    expect(sources).toContain('statement:st_eron_home');
    expect(sources).toContain('hotspot:h_clock');

    // The statement fact carries the alibi time span (used by the board to spot contradictions).
    const stFact = facts.find((f) => f.source.refId === 'st_eron_home')!;
    expect(stFact.time).toEqual({ start: '22:00', end: '23:00' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine-selectors.test.ts`
Expected: FAIL — `buildDossier` is not exported.

- [ ] **Step 3: Write minimal implementation**

In `src/games/shadow-trace/engine/selectors.ts`, add `Fact` to the type import and add the function plus its two private helpers:

```ts
import type { CaseV2, CaseProgressV2, LeadNode, Choice, Evidence, Fact } from './types';
```

```ts
function metadataText(e: Evidence): string {
  const m = e.metadata ?? {};
  const parts: string[] = [];
  if (m.time) parts.push(`время ${m.time}`);
  if (m.geo) parts.push(`место ${m.geo}`);
  if (m.device) parts.push(m.device);
  return `Метаданные «${e.title}»: ${parts.join(', ')}`;
}

function speakerName(caseData: CaseV2, speakerId: string): string {
  return caseData.suspects.find((s) => s.id === speakerId)?.name ?? speakerId;
}

/** Derive the dossier: a Fact card per discovered evidence, its metadata, each
 *  discovered statement, and each inspected hotspot. Each fact's `source` is the
 *  FactRef the board's addLink consumes. */
export function buildDossier(caseData: CaseV2, state: CaseProgressV2): Fact[] {
  const facts: Fact[] = [];

  for (const e of caseData.evidence) {
    if (!state.discoveredEvidence.includes(e.id)) continue;
    facts.push({
      id: `f_ev_${e.id}`,
      source: { type: 'evidence', refId: e.id },
      text: e.summary,
      subjectIds: e.relatedSuspectIds,
    });
    if (e.metadata && (e.metadata.time || e.metadata.geo || e.metadata.device)) {
      facts.push({
        id: `f_meta_${e.id}`,
        source: { type: 'metadata', refId: e.id },
        text: metadataText(e),
        subjectIds: e.relatedSuspectIds,
        time: e.metadata.time ? { start: e.metadata.time } : undefined,
        place: e.metadata.geo,
      });
    }
  }

  for (const st of caseData.statements) {
    if (!state.discoveredStatements.includes(st.id)) continue;
    facts.push({
      id: `f_st_${st.id}`,
      source: { type: 'statement', refId: st.id },
      text: `${speakerName(caseData, st.speakerId)}: «${st.claim}»`,
      subjectIds: [st.asserts.subjectId],
      time: st.asserts.timeStart ? { start: st.asserts.timeStart, end: st.asserts.timeEnd } : undefined,
      place: st.asserts.place,
    });
  }

  for (const e of caseData.evidence) {
    for (const h of e.media?.hotspots ?? []) {
      if (!state.inspectedHotspots.includes(h.id)) continue;
      facts.push({
        id: `f_hs_${h.id}`,
        source: { type: 'hotspot', refId: h.id },
        text: h.label,
        subjectIds: e.relatedSuspectIds,
      });
    }
  }

  return facts;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine-selectors.test.ts`
Expected: PASS (14 tests).

- [ ] **Step 5: Commit**

```bash
git add src/games/shadow-trace/engine/selectors.ts tests/engine-selectors.test.ts
git commit -m "feat(shadow-trace): derive dossier facts from engine state"
```

---

## Task 6: Validator — id-uniqueness, dangling-ref, and suspect-ref checks

**Files:**
- Modify: `src/games/shadow-trace/engine/validator.ts`
- Test: `tests/engine-validator.test.ts`

- [ ] **Step 1: Write the failing test**

In `tests/engine-validator.test.ts`, add these tests as new `it` blocks at the end of the existing `describe('validateCase', ...)` block:

```ts
  it('flags duplicate ids across collections', () => {
    const broken: CaseV2 = { ...sampleCase, evidence: [...sampleCase.evidence, { ...sampleCase.evidence[0] }] };
    const r = validateCase(broken);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'duplicate_id')).toBe(true);
  });

  it('flags an effect pointing at a missing target', () => {
    const broken: CaseV2 = {
      ...sampleCase,
      nodes: sampleCase.nodes.map((n) => (n.id === 'n_scene' ? { ...n, grants: [{ addEvidence: 'e_ghost' }] } : n)),
    };
    const r = validateCase(broken);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'bad_effect_target')).toBe(true);
  });

  it('flags an unknown suspect referenced by an accuse ending', () => {
    const broken: CaseV2 = {
      ...sampleCase,
      endings: sampleCase.endings.map((e) => (e.id === 'end_partial' ? { ...e, requires: { accuse: 's_ghost' } } : e)),
    };
    const r = validateCase(broken);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'bad_suspect_ref')).toBe(true);
  });

  it('flags a statement whose speaker is not a suspect', () => {
    const broken: CaseV2 = {
      ...sampleCase,
      statements: sampleCase.statements.map((s) => ({ ...s, speakerId: 's_ghost' })),
    };
    const r = validateCase(broken);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'bad_suspect_ref')).toBe(true);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine-validator.test.ts`
Expected: FAIL — the new codes (`duplicate_id`, `bad_effect_target`, `bad_suspect_ref`) are never emitted, so the `.some(...)` assertions are false.

- [ ] **Step 3: Write minimal implementation**

In `src/games/shadow-trace/engine/validator.ts`, add a private helper near the other helpers (after `obtainableRef`):

```ts
/** Collect every suspect id referenced inside an `accuse` condition anywhere in a tree. */
function collectAccuseTargets(cond: Condition, out: Set<string>): void {
  if ('accuse' in cond) out.add(cond.accuse);
  else if ('all' in cond) cond.all.forEach((c) => collectAccuseTargets(c, out));
  else if ('any' in cond) cond.any.forEach((c) => collectAccuseTargets(c, out));
  else if ('not' in cond) collectAccuseTargets(cond.not, out);
}
```

Then, inside `validateCase`, insert the following block immediately BEFORE the final `return { ok: issues.length === 0, issues };` line:

```ts
  // 6. duplicate ids across all keyed collections
  const allIds = [
    ...caseData.nodes.map((n) => n.id),
    ...caseData.evidence.map((e) => e.id),
    ...caseData.statements.map((s) => s.id),
    ...caseData.contradictions.map((c) => c.id),
    ...caseData.endings.map((e) => e.id),
    ...caseData.suspects.map((s) => s.id),
  ];
  const seenIds = new Set<string>();
  for (const id of allIds) {
    if (seenIds.has(id)) issues.push({ code: 'duplicate_id', message: `Дублирующийся id: ${id}` });
    seenIds.add(id);
  }

  // 7. effect targets resolve (setFlag is free-form and intentionally NOT checked —
  //    flags, incl. campaign flags, may be created on the fly)
  const evidenceIds = new Set(caseData.evidence.map((e) => e.id));
  const statementIds = new Set(caseData.statements.map((s) => s.id));
  const effects: Effect[] = [];
  for (const n of caseData.nodes) {
    effects.push(...(n.grants ?? []));
    for (const ch of n.choices ?? []) effects.push(...ch.effects);
  }
  for (const c of caseData.contradictions) effects.push(...(c.unlocks ?? []));
  for (const e of caseData.endings) effects.push(...(e.campaignEffects ?? []));
  for (const e of caseData.evidence) {
    for (const h of e.media?.hotspots ?? []) effects.push(...(h.grants ?? []));
    for (const a of e.media?.artifacts ?? []) effects.push(...(a.grants ?? []));
  }
  for (const e of effects) {
    if (e.addNode && !nodeIds.has(e.addNode)) {
      issues.push({ code: 'bad_effect_target', message: `addNode → неизвестный узел ${e.addNode}` });
    }
    if (e.lockNode && !nodeIds.has(e.lockNode)) {
      issues.push({ code: 'bad_effect_target', message: `lockNode → неизвестный узел ${e.lockNode}` });
    }
    if (e.addEvidence && !evidenceIds.has(e.addEvidence)) {
      issues.push({ code: 'bad_effect_target', message: `addEvidence → неизвестная улика ${e.addEvidence}` });
    }
    if (e.addStatement && !statementIds.has(e.addStatement)) {
      issues.push({ code: 'bad_effect_target', message: `addStatement → неизвестное показание ${e.addStatement}` });
    }
  }

  // 8. suspect refs resolve
  const suspectIds = new Set(caseData.suspects.map((s) => s.id));
  for (const e of caseData.evidence) {
    for (const sid of e.relatedSuspectIds) {
      if (!suspectIds.has(sid)) {
        issues.push({ code: 'bad_suspect_ref', message: `Улика ${e.id}: неизвестный подозреваемый ${sid}` });
      }
    }
  }
  for (const st of caseData.statements) {
    if (!suspectIds.has(st.speakerId)) {
      issues.push({ code: 'bad_suspect_ref', message: `Показание ${st.id}: неизвестный говорящий ${st.speakerId}` });
    }
  }
  const accuseTargets = new Set<string>();
  for (const end of caseData.endings) collectAccuseTargets(end.requires, accuseTargets);
  for (const t of accuseTargets) {
    if (!suspectIds.has(t)) {
      issues.push({ code: 'bad_suspect_ref', message: `Концовка ссылается на неизвестного подозреваемого: ${t}` });
    }
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine-validator.test.ts`
Expected: PASS (10 tests). The existing `passes the valid sample case` test must still be green — the sample case has no duplicate ids, all effect targets resolve, and all suspect refs are valid.

- [ ] **Step 5: Commit**

```bash
git add src/games/shadow-trace/engine/validator.ts tests/engine-validator.test.ts
git commit -m "feat(shadow-trace): validator id-uniqueness + dangling-ref + suspect-ref checks"
```

---

## Task 7: Barrel export + full green run

**Files:**
- Modify: `src/games/shadow-trace/engine/index.ts`

- [ ] **Step 1: Extend the barrel**

In `src/games/shadow-trace/engine/index.ts`, add the selector exports after the `validateCase` lines (keep all existing exports). `Fact` is already re-exported via `export * from './types';`:

```ts
export {
  getOpenNodes,
  getAvailableChoices,
  getVisibleHotspots,
  getDetectedArtifacts,
  inspectHotspot,
  buildDossier,
} from './selectors';
export type { OpenNode } from './selectors';
```

- [ ] **Step 2: Verify the whole engine is green**

Run: `npm test`
Expected: ALL tests pass (the engine suites: conditions, state, contradictions, endings, validator, selectors — plus unrelated colony/save/scoring). Report the total count.
Run: `npm run typecheck 2>&1 | grep -E "error TS" | grep -vc colony`
Expected: prints `0` (the barrel and all new code introduce zero non-colony type errors).

- [ ] **Step 3: Commit**

```bash
git add src/games/shadow-trace/engine/index.ts
git commit -m "feat(shadow-trace): export Этап 1a selectors from engine barrel"
```

---

## Done criteria for Этап 1a

- `selectors.ts` exposes `getOpenNodes`, `getAvailableChoices`, `getVisibleHotspots`, `getDetectedArtifacts`, `inspectHotspot`, `buildDossier` — all pure and tested.
- `CaseProgressV2` carries `inspectedHotspots`; `Fact` is defined and produced by `buildDossier` with board-ready `source` FactRefs.
- The validator additionally rejects duplicate ids, dangling effect targets, and unknown suspect refs.
- `npm test` green; `npm run typecheck` introduces zero non-colony errors.
- No v1 / colony / UI files touched.

**1b punch-list (from the final Этап 1a review — do these in 1b before the listed content is authored):**
1. **Validator: handle `type:'hotspot'` FactRefs.** This stage widened `FactRef` to include `'hotspot'` and `buildDossier` now emits hotspot facts, but the validator's `refExists` and `obtainableRef` still fall through to "treat refId as an evidence id". A `Contradiction` authored between a hotspot and another fact would get a false `bad_factref` + false `unreachable_contradiction`. Fix both helpers (and pass `caseData` into `obtainableRef`) before authoring any hotspot-based contradiction. Latent today (no such content), not a bug in shipped behaviour.
2. **UI read-join selectors the desk will need** (not gating — straight joins, so they live with the UI or a thin selector pass): `getDiscoveredEvidence`, `getDiscoveredStatements`, `getDiscoveredContradictions`, a `resolveLinkFacts` (PlayerLink refs → Fact/Evidence/Statement), and accusation-draft helpers for "Стол обвинения".
3. **Symmetry/polish:** consider gating `inspectHotspot` on parent-evidence-discovered (mirrors `buildDossier`); decide whether engine-owned RU display strings in `metadataText` belong in the UI layer instead; note `Evidence.revealsStatementIds` is currently dead (statements reveal only via `addStatement`).

**Intentionally deferred to 1b:** `getDetectedArtifacts` surfaces which forgery artifacts
are currently detectable, but routing an artifact's `grants` (a `detectArtifact` action
+ a parallel `detectedArtifacts` state field) is left for 1b — it has no consumer until
the photo inspector's fake-detection interaction is built, and the vertical slice already
lets the player flag fakes via `Accusation.fakeEvidenceIds` at the accusation desk. Adding
that state now would be building ahead of its consumer (YAGNI).

**Next plan (Этап 1b):** author a vertical-slice case JSON (`public/data/cases-v2/<id>.json`) + a `CaseManagerV2` loader (mirroring `CaseManager`) + a build-time `validateCase` gate, then the React detective desk (Досье/Хранилище улик/Карта зацепок/Доска связей v2/Показания/Стол обвинения) and the photo inspector, wired to these selectors and mounted via the Shadow Trace `GameModule` (route to v2 when the launch `case` param names a v2 case). Verified by running the app (`npm run dev`), since there is no React unit-test harness.
```
