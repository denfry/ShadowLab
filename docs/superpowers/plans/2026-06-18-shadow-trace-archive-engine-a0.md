# Shadow Trace — Archive Engine (Этап A0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure-logic "archive investigation" engine for Shadow Trace — a content model (records / entities / sealed files / contradictions / endings), an emergent navigation state machine, and a reachability validator — fully unit-tested, with no UI.

**Architecture:** A new self-contained module `src/games/shadow-trace/archive/` of pure, immutable, deterministic functions (mirrors the existing `engine/` style). State expands by *reading records*: opening a record discovers the entities it mentions, which makes records mentioning those entities reachable. Some records are sealed and unlock when a key is obtained. Catching-the-lie lives in the data (authored `Contradiction`s); the player asserts the decisive lie + culprit at accusation time. The contradiction/ending/scoring/validator *spine* is ported (not imported) from the old engine and retuned to the archive model.

**Tech Stack:** TypeScript (strict), Vitest. No React in this stage.

## Global Constraints

- New code lives ONLY in `src/games/shadow-trace/archive/`. Do NOT modify the old `src/games/shadow-trace/engine/` (it is parked, deleted in a later stage).
- Pure / immutable / deterministic: every state function returns a new object and never mutates its input. No `Date.now()`, no randomness.
- The record content type is named **`ArchiveRecord`** (NOT `Record` — that collides with the TS built-in utility type).
- User-facing strings and validator messages are in **Russian** (match existing engine).
- Tests live in `tests/`, named `archive-*.test.ts`; import source via the `@/` alias (`@/games/shadow-trace/archive/...`). The shared fixture is `tests/fixtures/sample-archive-case.ts`.
- Test runner: `npx vitest run <file>` for one file; `npm run test` for all. Type gate: `npm run typecheck` (`tsc --noEmit`).
- `npm run typecheck` may surface **colony-only** errors from a parallel rework. The archive work is "green" when: the task's vitest file passes AND `npm run typecheck` shows no error whose path contains `shadow-trace/archive` or `tests/archive`. Never `git add -A`; stage only the exact files listed per task.

---

## File Structure

- `src/games/shadow-trace/archive/media-types.ts` — procedural photo media types (self-contained; photo-only, video deferred to A2).
- `src/games/shadow-trace/archive/types.ts` — case content + runtime state types.
- `src/games/shadow-trace/archive/state.ts` — navigation state machine (create / openRecord / grantKey / accuse) + reachability helpers.
- `src/games/shadow-trace/archive/casefile.ts` — case-file mutations (pin / suspicion / note).
- `src/games/shadow-trace/archive/contradictions.ts` — FactRef equality + `matchContradiction`.
- `src/games/shadow-trace/archive/conditions.ts` — `evaluateArchiveCondition` + `isContradictionNoticed`.
- `src/games/shadow-trace/archive/endings.ts` — `resolveEnding` + `scoreCaseArchive` + `checkAccusation`.
- `src/games/shadow-trace/archive/selectors.ts` — read-only views for the future UI.
- `src/games/shadow-trace/archive/validator.ts` — reachability fixpoint + structural validation.
- `src/games/shadow-trace/archive/index.ts` — public barrel.
- `tests/fixtures/sample-archive-case.ts` — the solvable Эрон/Мара sample case.
- `tests/archive-*.test.ts` — one suite per module + one integration suite.

---

### Task 1: Types, media types, and the sample fixture

**Files:**
- Create: `src/games/shadow-trace/archive/media-types.ts`
- Create: `src/games/shadow-trace/archive/types.ts`
- Create: `tests/fixtures/sample-archive-case.ts`

**Interfaces:**
- Produces: all the content/state types consumed by every later task — `CaseArchive`, `ArchiveRecord`, `Entity`, `RecordSpan`, `FactRef`, `Contradiction`, `ArchiveCondition`, `Ending`, `KeyDef`, `MediaAsset`, `ArchiveProgress`, `ArchiveAccusation`, `Suspicion`, `Rank`, `DeductionResultArchive`, and media types `Rect`/`SceneLayer`/`Hotspot`/`Artifact`/`MediaSpec`. Plus the exported `sampleArchiveCase` fixture.

- [ ] **Step 1: Write `media-types.ts`**

```ts
// src/games/shadow-trace/archive/media-types.ts
// Self-contained procedural photo media (no Condition/Grant coupling). Photo-only for A0;
// video frames are deferred to Этап A2.
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
  /** Inspecting this hotspot in the UI grants these keys (A1 wires this to grantKey). */
  grantsKeys?: string[];
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
}

export interface MediaSpec {
  kind: 'photo';
  aspect: '4:3' | '16:9' | '1:1';
  style: 'cctv' | 'phone' | 'polaroid' | 'doc-scan' | 'thermal';
  layers: SceneLayer[];
  hotspots: Hotspot[];
  overlay?: { timestamp?: string; channel?: string; battery?: number; geostamp?: string };
  artifacts?: Artifact[];
}
```

- [ ] **Step 2: Write `types.ts`**

```ts
// src/games/shadow-trace/archive/types.ts
import type { MediaSpec } from './media-types';

// ---- references into the archive ----
export type FactRef =
  | { kind: 'record'; recordId: string }
  | { kind: 'recordClaim'; recordId: string; claimId?: string }
  | { kind: 'metadata'; recordId: string; field: string }
  | { kind: 'entity'; entityId: string };

// ---- authored case content ----
export type RecordSpan = { text: string } | { entityId: string; text: string };

export type RecordKind =
  | 'transcript'
  | 'chat'
  | 'letter'
  | 'report'
  | 'log'
  | 'note'
  | 'photo'
  | 'object';

export interface ArchiveRecord {
  id: string;
  kind: RecordKind;
  title: string;
  source?: string;
  timestamp?: string;
  body: RecordSpan[];
  mediaId?: string;
  metadata?: { time?: string; geo?: string; device?: string; exif?: Record<string, string> };
  /** Entity ids this record references (kept explicit for the validator/index). */
  mentions: string[];
  /** Reading this record (or inspecting its media hotspot) grants these keys. */
  grantsKeys?: string[];
  /** When present, the record is unreadable until `seal.keyId` is in the player's keys. */
  seal?: { keyId: string; hint: string };
}

export type EntityType = 'person' | 'place' | 'time' | 'object' | 'event' | 'org';

export interface Entity {
  id: string;
  type: EntityType;
  label: string;
  aliases?: string[];
  summary?: string;
  isSuspect?: boolean;
}

export interface KeyDef {
  id: string;
  label: string;
}

export interface Contradiction {
  id: string;
  between: [FactRef, FactRef];
  rule: 'time_overlap' | 'place_conflict' | 'mutual_exclusive' | 'authenticity';
  weight: number;
  revealHint?: string;
}

export type ArchiveCondition =
  | { accuse: string }
  | { decisiveLie: string }
  | { noticedContradiction: string }
  | { hasKey: string }
  | { all: ArchiveCondition[] }
  | { any: ArchiveCondition[] }
  | { not: ArchiveCondition };

export type EndingQuality = 'truth' | 'partial' | 'miscarriage' | 'cold_case';

export interface Ending {
  id: string;
  title: string;
  requires: ArchiveCondition;
  quality: EndingQuality;
  epilogue: string[];
  /** Persisted to the campaign layer (consumed in Этап A2). */
  campaignFlags?: string[];
}

export interface MediaAsset {
  id: string;
  media: MediaSpec;
}

export interface CaseArchive {
  id: string;
  title: string;
  difficulty: 'normal' | 'hard' | 'nightmare';
  synopsis: string;
  episodeOf?: string;
  seedRecordIds: string[];
  records: ArchiveRecord[];
  entities: Entity[];
  contradictions: Contradiction[];
  endings: Ending[];
  keysSchema: KeyDef[];
  media?: MediaAsset[];
}

// ---- runtime state ----
export interface ArchiveAccusation {
  culpritEntityId: string;
  decisiveLie?: [FactRef, FactRef];
}

export interface Suspicion {
  recordId: string;
  note?: string;
}

export interface ArchiveProgress {
  caseId: string;
  openRecords: string[];
  seenRecords: string[];
  discoveredEntities: string[];
  keys: string[];
  pinnedRecords: string[];
  pinnedEntities: string[];
  suspicions: Suspicion[];
  notes: string[];
  accusation?: ArchiveAccusation;
}

export type Rank = 'F' | 'C' | 'B' | 'A' | 'S';

export interface DeductionResultArchive {
  rank: Rank;
  score: number;
  decisiveLieCorrect: boolean;
  contradictionsNoticed: number;
  contradictionsTotal: number;
  sealsOpened: number;
  sealsTotal: number;
  emptySuspicions: number;
  accusationQuality: EndingQuality;
  flagsForCampaign: string[];
}
```

- [ ] **Step 3: Write the sample fixture `tests/fixtures/sample-archive-case.ts`**

```ts
// tests/fixtures/sample-archive-case.ts
import type { CaseArchive } from '@/games/shadow-trace/archive/types';

/**
 * Solvable Эрон/Мара case in the archive model.
 * Thread: report+interrogation (seeds) → CCTV photo (reveals the admin) →
 * admin chat (grants the archive key) → unsealed access log. The decisive lie:
 * Эрон says "home at 22:00" but his card opened the office door at 21:28.
 */
export const sampleArchiveCase: CaseArchive = {
  id: 'sample-archive',
  title: 'Образец: архив дела',
  difficulty: 'hard',
  synopsis: 'Тестовое дело для архивного движка.',
  seedRecordIds: ['r_report', 'r_eron'],
  keysSchema: [{ id: 'k_archive', label: 'Доступ к закрытому архиву' }],
  entities: [
    { id: 's_eron', type: 'person', label: 'Эрон', isSuspect: true, summary: 'Ассистент лаборатории.' },
    { id: 's_mara', type: 'person', label: 'Мара', isSuspect: true, summary: 'Куратор проекта.' },
    { id: 's_admin', type: 'person', label: 'Кат (администратор)', summary: 'Администратор СКУД.' },
    { id: 'p_office', type: 'place', label: 'офис' },
    { id: 't_2200', type: 'time', label: '22:00' },
    { id: 't_2130', type: 'time', label: '21:30' },
    { id: 't_2128', type: 'time', label: '21:28' },
    { id: 'o_card', type: 'object', label: 'пропуск-карта' },
    { id: 'ev_cctv', type: 'event', label: 'съёмка CCTV' },
  ],
  media: [
    {
      id: 'm_cctv',
      media: {
        kind: 'photo',
        aspect: '4:3',
        style: 'cctv',
        layers: [{ id: 'bg', z: 0, shape: 'rect', at: { x: 0, y: 0, w: 100, h: 100 } }],
        hotspots: [{ id: 'h_clock', at: { x: 10, y: 10, w: 20, h: 20 }, label: 'Часы на стене: 21:30' }],
        overlay: { timestamp: '21:30', channel: 'CCTV-3' },
        artifacts: [{ id: 'a_clock', type: 'clock_conflict', tell: 'Время на часах не бьётся с показанием.' }],
      },
    },
  ],
  records: [
    {
      id: 'r_report',
      kind: 'report',
      title: 'Рапорт о происшествии',
      source: 'Дежурный, 12.06',
      body: [
        { text: 'В ' },
        { entityId: 't_2200', text: '22:00' },
        { text: ' сработала тревога в ' },
        { entityId: 'p_office', text: 'офисе' },
        { text: '. Фигуранты: ' },
        { entityId: 's_eron', text: 'Эрон' },
        { text: ' и ' },
        { entityId: 's_mara', text: 'Мара' },
        { text: '. Есть ' },
        { entityId: 'ev_cctv', text: 'запись CCTV' },
        { text: '.' },
      ],
      mentions: ['t_2200', 'p_office', 's_eron', 's_mara', 'ev_cctv'],
    },
    {
      id: 'r_eron',
      kind: 'transcript',
      title: 'Допрос Эрона',
      source: 'Каб. 4, 12.06',
      body: [
        { entityId: 's_eron', text: 'Эрон' },
        { text: ': «Я был дома в ' },
        { entityId: 't_2200', text: '22:00' },
        { text: ', в ' },
        { entityId: 'p_office', text: 'офис' },
        { text: ' не заходил».' },
      ],
      mentions: ['s_eron', 't_2200', 'p_office'],
    },
    {
      id: 'r_cctv_photo',
      kind: 'photo',
      title: 'Кадр CCTV у входа',
      source: 'Канал CCTV-3',
      mediaId: 'm_cctv',
      metadata: { time: '21:30', geo: 'office', device: 'CCTV-3' },
      body: [
        { text: 'Кадр ' },
        { entityId: 'ev_cctv', text: 'CCTV' },
        { text: ' у ' },
        { entityId: 'p_office', text: 'офиса' },
        { text: ' в ' },
        { entityId: 't_2130', text: '21:30' },
        { text: '. Выгрузку подтвердила ' },
        { entityId: 's_admin', text: 'Кат' },
        { text: '.' },
      ],
      mentions: ['ev_cctv', 'p_office', 't_2130', 's_admin'],
    },
    {
      id: 'r_chat_admin',
      kind: 'chat',
      title: 'Переписка с администратором',
      source: 'Мессенджер',
      grantsKeys: ['k_archive'],
      body: [
        { entityId: 's_admin', text: 'Кат' },
        { text: ': «Журнал по ' },
        { entityId: 'o_card', text: 'карте' },
        { text: ' в закрытом архиве, держи доступ».' },
      ],
      mentions: ['s_admin', 'o_card'],
    },
    {
      id: 'r_access_log',
      kind: 'log',
      title: 'Журнал доступа СКУД',
      source: 'Контроллер двери',
      metadata: { time: '21:28', device: 'door-reader' },
      seal: { keyId: 'k_archive', hint: 'Закрытый архив — нужен доступ от администратора.' },
      body: [
        { text: 'В ' },
        { entityId: 't_2128', text: '21:28' },
        { text: ' ' },
        { entityId: 'o_card', text: 'карта Эрона' },
        { text: ' открыла дверь ' },
        { entityId: 'p_office', text: 'офиса' },
        { text: '.' },
      ],
      mentions: ['t_2128', 'o_card', 'p_office', 's_eron'],
    },
  ],
  contradictions: [
    {
      id: 'c_time',
      between: [
        { kind: 'recordClaim', recordId: 'r_eron', claimId: 'home' },
        { kind: 'metadata', recordId: 'r_access_log', field: 'time' },
      ],
      rule: 'time_overlap',
      weight: 3,
      revealHint: 'Дома в 22:00 — но карта открыла офис в 21:28.',
    },
    {
      id: 'c_photo',
      between: [
        { kind: 'recordClaim', recordId: 'r_eron', claimId: 'home' },
        { kind: 'metadata', recordId: 'r_cctv_photo', field: 'time' },
      ],
      rule: 'time_overlap',
      weight: 1,
    },
  ],
  endings: [
    {
      id: 'end_truth',
      title: 'Истина установлена',
      requires: { all: [{ accuse: 's_eron' }, { decisiveLie: 'c_time' }] },
      quality: 'truth',
      epilogue: ['Эрон сломался под тяжестью журнала доступа.'],
      campaignFlags: ['eron_jailed'],
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

- [ ] **Step 4: Verify types compile**

Run: `npm run typecheck`
Expected: no error whose path contains `shadow-trace/archive` or `tests/fixtures/sample-archive-case` (colony-only errors, if any, are ignored per Global Constraints).

- [ ] **Step 5: Commit**

```bash
git add src/games/shadow-trace/archive/media-types.ts src/games/shadow-trace/archive/types.ts tests/fixtures/sample-archive-case.ts
git commit -m "feat(shadow-trace): archive engine A0 — content/state types + sample fixture"
```

---

### Task 2: Navigation — createArchiveProgress + reachability

**Files:**
- Create: `src/games/shadow-trace/archive/state.ts`
- Test: `tests/archive-state.test.ts`

**Interfaces:**
- Consumes: `CaseArchive`, `ArchiveProgress` (Task 1).
- Produces: `createArchiveProgress(caseData: CaseArchive): ArchiveProgress`. Internal (not exported) helpers `isReachable` and `recomputeOpen` are added here and reused by Task 3.

- [ ] **Step 1: Write the failing test**

```ts
// tests/archive-state.test.ts
import { describe, expect, it } from 'vitest';
import { createArchiveProgress } from '@/games/shadow-trace/archive/state';
import { sampleArchiveCase } from './fixtures/sample-archive-case';

describe('createArchiveProgress', () => {
  it('discovers seed entities, grants no keys, and opens reachable unsealed records', () => {
    const p = createArchiveProgress(sampleArchiveCase);
    expect(p.caseId).toBe('sample-archive');
    // seed mentions discovered
    expect(p.discoveredEntities).toEqual(
      expect.arrayContaining(['t_2200', 'p_office', 's_eron', 's_mara', 'ev_cctv']),
    );
    // seeds are open; the CCTV photo is reachable via the discovered ev_cctv entity
    expect(p.openRecords).toEqual(expect.arrayContaining(['r_report', 'r_eron', 'r_cctv_photo']));
    // the access log is sealed -> NOT open; the admin chat needs s_admin (not yet discovered)
    expect(p.openRecords).not.toContain('r_access_log');
    expect(p.openRecords).not.toContain('r_chat_admin');
    expect(p.keys).toEqual([]);
    expect(p.seenRecords).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/archive-state.test.ts`
Expected: FAIL — cannot import `createArchiveProgress` (module not found).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/games/shadow-trace/archive/state.ts
import type { CaseArchive, ArchiveProgress } from './types';

const addUnique = (arr: string[], v: string): string[] => (arr.includes(v) ? arr : [...arr, v]);
const addAllUnique = (arr: string[], vs: string[] | undefined): string[] => {
  let out = arr;
  for (const v of vs ?? []) out = addUnique(out, v);
  return out;
};

/** A record is reachable if it is a seed or it mentions an already-discovered entity. */
function isReachable(caseData: CaseArchive, state: ArchiveProgress, recordId: string): boolean {
  if (caseData.seedRecordIds.includes(recordId)) return true;
  const rec = caseData.records.find((r) => r.id === recordId);
  if (!rec) return false;
  return rec.mentions.some((m) => state.discoveredEntities.includes(m));
}

/** Records readable right now: reachable AND (unsealed OR their key is held). */
function recomputeOpen(caseData: CaseArchive, state: ArchiveProgress): string[] {
  return caseData.records
    .filter((r) => isReachable(caseData, state, r.id))
    .filter((r) => !r.seal || state.keys.includes(r.seal.keyId))
    .map((r) => r.id);
}

export function createArchiveProgress(caseData: CaseArchive): ArchiveProgress {
  const seedRecords = caseData.records.filter((r) => caseData.seedRecordIds.includes(r.id));
  let discoveredEntities: string[] = [];
  let keys: string[] = [];
  for (const r of seedRecords) {
    discoveredEntities = addAllUnique(discoveredEntities, r.mentions);
    keys = addAllUnique(keys, r.grantsKeys);
  }
  const base: ArchiveProgress = {
    caseId: caseData.id,
    openRecords: [],
    seenRecords: [],
    discoveredEntities,
    keys,
    pinnedRecords: [],
    pinnedEntities: [],
    suspicions: [],
    notes: [],
  };
  return { ...base, openRecords: recomputeOpen(caseData, base) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/archive-state.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/games/shadow-trace/archive/state.ts tests/archive-state.test.ts
git commit -m "feat(shadow-trace): archive A0 — createArchiveProgress + reachability"
```

---

### Task 3: Navigation — openRecord, grantKey, accuse

**Files:**
- Modify: `src/games/shadow-trace/archive/state.ts`
- Test: `tests/archive-state.test.ts` (add suites)

**Interfaces:**
- Consumes: the `isReachable`/`recomputeOpen` helpers and `createArchiveProgress` (Task 2).
- Produces:
  - `openRecord(caseData: CaseArchive, state: ArchiveProgress, recordId: string): ArchiveProgress`
  - `grantKey(caseData: CaseArchive, state: ArchiveProgress, keyId: string): ArchiveProgress`
  - `accuse(state: ArchiveProgress, accusation: ArchiveAccusation): ArchiveProgress`

- [ ] **Step 1: Write the failing tests** (append to `tests/archive-state.test.ts`)

```ts
import { openRecord, grantKey, accuse } from '@/games/shadow-trace/archive/state';

describe('openRecord', () => {
  it('reading the CCTV photo discovers the admin, making the admin chat reachable', () => {
    const p0 = createArchiveProgress(sampleArchiveCase);
    const p1 = openRecord(sampleArchiveCase, p0, 'r_cctv_photo');
    expect(p1).not.toBe(p0); // immutable
    expect(p1.seenRecords).toContain('r_cctv_photo');
    expect(p1.discoveredEntities).toContain('s_admin');
    expect(p1.openRecords).toContain('r_chat_admin');
  });

  it('reading the admin chat grants the archive key and unseals the access log', () => {
    let p = createArchiveProgress(sampleArchiveCase);
    p = openRecord(sampleArchiveCase, p, 'r_cctv_photo');
    p = openRecord(sampleArchiveCase, p, 'r_chat_admin');
    expect(p.keys).toContain('k_archive');
    expect(p.openRecords).toContain('r_access_log');
  });

  it('refuses to open a sealed record while its key is missing', () => {
    const p0 = createArchiveProgress(sampleArchiveCase);
    // r_access_log mentions s_eron (discovered) so it is reachable, but it is sealed
    const p1 = openRecord(sampleArchiveCase, p0, 'r_access_log');
    expect(p1).toBe(p0);
  });

  it('refuses to open an unreachable record', () => {
    const p0 = createArchiveProgress(sampleArchiveCase);
    const p1 = openRecord(sampleArchiveCase, p0, 'r_chat_admin'); // s_admin not yet discovered
    expect(p1).toBe(p0);
  });
});

describe('grantKey', () => {
  it('granting the key directly unseals the access log (idempotent)', () => {
    const p0 = createArchiveProgress(sampleArchiveCase);
    const p1 = grantKey(sampleArchiveCase, p0, 'k_archive');
    expect(p1.keys).toContain('k_archive');
    expect(p1.openRecords).toContain('r_access_log');
    const p2 = grantKey(sampleArchiveCase, p1, 'k_archive');
    expect(p2).toBe(p1); // already held -> no-op
  });
});

describe('accuse', () => {
  it('stores the accusation immutably', () => {
    const p0 = createArchiveProgress(sampleArchiveCase);
    const p1 = accuse(p0, { culpritEntityId: 's_eron' });
    expect(p1.accusation).toEqual({ culpritEntityId: 's_eron' });
    expect(p0.accusation).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/archive-state.test.ts`
Expected: FAIL — `openRecord`, `grantKey`, `accuse` are not exported.

- [ ] **Step 3: Add the implementations** (append to `src/games/shadow-trace/archive/state.ts`; also add the `ArchiveAccusation` import)

Change the import line at the top of the file to:

```ts
import type { CaseArchive, ArchiveProgress, ArchiveAccusation } from './types';
```

Append:

```ts
/** Read a reachable, unsealed record: mark seen, discover its entities, grant its keys. */
export function openRecord(caseData: CaseArchive, state: ArchiveProgress, recordId: string): ArchiveProgress {
  const rec = caseData.records.find((r) => r.id === recordId);
  if (!rec) return state;
  if (!isReachable(caseData, state, recordId)) return state;
  if (rec.seal && !state.keys.includes(rec.seal.keyId)) return state;
  const next: ArchiveProgress = {
    ...state,
    seenRecords: addUnique(state.seenRecords, recordId),
    discoveredEntities: addAllUnique(state.discoveredEntities, rec.mentions),
    keys: addAllUnique(state.keys, rec.grantsKeys),
  };
  return { ...next, openRecords: recomputeOpen(caseData, next) };
}

/** Grant a key from any source (e.g. a media hotspot in the UI); unseals matching records. */
export function grantKey(caseData: CaseArchive, state: ArchiveProgress, keyId: string): ArchiveProgress {
  if (state.keys.includes(keyId)) return state;
  const next: ArchiveProgress = { ...state, keys: [...state.keys, keyId] };
  return { ...next, openRecords: recomputeOpen(caseData, next) };
}

/** Record the player's final accusation. */
export function accuse(state: ArchiveProgress, accusation: ArchiveAccusation): ArchiveProgress {
  return { ...state, accusation };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/archive-state.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/games/shadow-trace/archive/state.ts tests/archive-state.test.ts
git commit -m "feat(shadow-trace): archive A0 — openRecord, grantKey, accuse"
```

---

### Task 4: Case file — pin, suspicion, note

**Files:**
- Create: `src/games/shadow-trace/archive/casefile.ts`
- Test: `tests/archive-casefile.test.ts`

**Interfaces:**
- Consumes: `ArchiveProgress` (Task 1), `createArchiveProgress` (Task 2).
- Produces:
  - `pinRecord(state, recordId): ArchiveProgress` / `unpinRecord(state, recordId): ArchiveProgress`
  - `pinEntity(state, entityId): ArchiveProgress` / `unpinEntity(state, entityId): ArchiveProgress`
  - `markSuspicion(state, recordId, note?): ArchiveProgress` / `clearSuspicion(state, recordId): ArchiveProgress`
  - `addNote(state, text): ArchiveProgress`

- [ ] **Step 1: Write the failing test**

```ts
// tests/archive-casefile.test.ts
import { describe, expect, it } from 'vitest';
import { createArchiveProgress } from '@/games/shadow-trace/archive/state';
import {
  pinRecord,
  unpinRecord,
  pinEntity,
  unpinEntity,
  markSuspicion,
  clearSuspicion,
  addNote,
} from '@/games/shadow-trace/archive/casefile';
import { sampleArchiveCase } from './fixtures/sample-archive-case';

describe('case file', () => {
  it('pins and unpins records and entities (immutable, deduped)', () => {
    const p0 = createArchiveProgress(sampleArchiveCase);
    const p1 = pinRecord(pinRecord(p0, 'r_eron'), 'r_eron');
    expect(p1.pinnedRecords).toEqual(['r_eron']);
    expect(p0.pinnedRecords).toEqual([]);
    expect(unpinRecord(p1, 'r_eron').pinnedRecords).toEqual([]);

    const p2 = pinEntity(p0, 's_eron');
    expect(p2.pinnedEntities).toEqual(['s_eron']);
    expect(unpinEntity(p2, 's_eron').pinnedEntities).toEqual([]);
  });

  it('marks one suspicion per record and clears it', () => {
    const p0 = createArchiveProgress(sampleArchiveCase);
    const p1 = markSuspicion(p0, 'r_eron', 'врёт про 22:00');
    expect(p1.suspicions).toEqual([{ recordId: 'r_eron', note: 'врёт про 22:00' }]);
    const p2 = markSuspicion(p1, 'r_eron', 'дубль');
    expect(p2).toBe(p1); // one suspicion per record
    expect(clearSuspicion(p1, 'r_eron').suspicions).toEqual([]);
  });

  it('appends free notes', () => {
    const p0 = createArchiveProgress(sampleArchiveCase);
    expect(addNote(p0, 'проверить алиби').notes).toEqual(['проверить алиби']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/archive-casefile.test.ts`
Expected: FAIL — module `casefile` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/games/shadow-trace/archive/casefile.ts
import type { ArchiveProgress } from './types';

const addUnique = (arr: string[], v: string): string[] => (arr.includes(v) ? arr : [...arr, v]);

export function pinRecord(state: ArchiveProgress, recordId: string): ArchiveProgress {
  return { ...state, pinnedRecords: addUnique(state.pinnedRecords, recordId) };
}
export function unpinRecord(state: ArchiveProgress, recordId: string): ArchiveProgress {
  return { ...state, pinnedRecords: state.pinnedRecords.filter((id) => id !== recordId) };
}
export function pinEntity(state: ArchiveProgress, entityId: string): ArchiveProgress {
  return { ...state, pinnedEntities: addUnique(state.pinnedEntities, entityId) };
}
export function unpinEntity(state: ArchiveProgress, entityId: string): ArchiveProgress {
  return { ...state, pinnedEntities: state.pinnedEntities.filter((id) => id !== entityId) };
}
export function markSuspicion(state: ArchiveProgress, recordId: string, note?: string): ArchiveProgress {
  if (state.suspicions.some((s) => s.recordId === recordId)) return state;
  return { ...state, suspicions: [...state.suspicions, { recordId, ...(note ? { note } : {}) }] };
}
export function clearSuspicion(state: ArchiveProgress, recordId: string): ArchiveProgress {
  return { ...state, suspicions: state.suspicions.filter((s) => s.recordId !== recordId) };
}
export function addNote(state: ArchiveProgress, text: string): ArchiveProgress {
  return { ...state, notes: [...state.notes, text] };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/archive-casefile.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/games/shadow-trace/archive/casefile.ts tests/archive-casefile.test.ts
git commit -m "feat(shadow-trace): archive A0 — case-file pins, suspicions, notes"
```

---

### Task 5: Contradictions — FactRef equality + matchContradiction

**Files:**
- Create: `src/games/shadow-trace/archive/contradictions.ts`
- Test: `tests/archive-contradictions.test.ts`

**Interfaces:**
- Consumes: `CaseArchive`, `Contradiction`, `FactRef` (Task 1).
- Produces:
  - `sameRef(a: FactRef, b: FactRef): boolean`
  - `matchContradiction(caseData: CaseArchive, a: FactRef, b: FactRef): Contradiction | null`

- [ ] **Step 1: Write the failing test**

```ts
// tests/archive-contradictions.test.ts
import { describe, expect, it } from 'vitest';
import { sameRef, matchContradiction } from '@/games/shadow-trace/archive/contradictions';
import { sampleArchiveCase } from './fixtures/sample-archive-case';
import type { FactRef } from '@/games/shadow-trace/archive/types';

const eronClaim: FactRef = { kind: 'recordClaim', recordId: 'r_eron', claimId: 'home' };
const logMeta: FactRef = { kind: 'metadata', recordId: 'r_access_log', field: 'time' };

describe('sameRef', () => {
  it('compares by kind and ids', () => {
    expect(sameRef(eronClaim, { kind: 'recordClaim', recordId: 'r_eron', claimId: 'home' })).toBe(true);
    expect(sameRef(eronClaim, { kind: 'recordClaim', recordId: 'r_eron', claimId: 'away' })).toBe(false);
    expect(sameRef(eronClaim, logMeta)).toBe(false);
    expect(sameRef({ kind: 'entity', entityId: 's_eron' }, { kind: 'entity', entityId: 's_eron' })).toBe(true);
  });
});

describe('matchContradiction', () => {
  it('matches an authored pair order-independently', () => {
    expect(matchContradiction(sampleArchiveCase, eronClaim, logMeta)?.id).toBe('c_time');
    expect(matchContradiction(sampleArchiveCase, logMeta, eronClaim)?.id).toBe('c_time');
  });
  it('returns null for an unrelated pair or a self-pair', () => {
    expect(matchContradiction(sampleArchiveCase, eronClaim, eronClaim)).toBeNull();
    expect(
      matchContradiction(sampleArchiveCase, logMeta, { kind: 'metadata', recordId: 'r_cctv_photo', field: 'time' }),
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/archive-contradictions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/games/shadow-trace/archive/contradictions.ts
import type { CaseArchive, Contradiction, FactRef } from './types';

export function sameRef(a: FactRef, b: FactRef): boolean {
  if (a.kind === 'entity' && b.kind === 'entity') return a.entityId === b.entityId;
  if (a.kind === 'record' && b.kind === 'record') return a.recordId === b.recordId;
  if (a.kind === 'recordClaim' && b.kind === 'recordClaim')
    return a.recordId === b.recordId && a.claimId === b.claimId;
  if (a.kind === 'metadata' && b.kind === 'metadata')
    return a.recordId === b.recordId && a.field === b.field;
  return false;
}

const samePair = (pair: readonly [FactRef, FactRef], a: FactRef, b: FactRef): boolean =>
  (sameRef(pair[0], a) && sameRef(pair[1], b)) || (sameRef(pair[0], b) && sameRef(pair[1], a));

/** The authored contradiction this fact pair maps to, or null. Order-independent. */
export function matchContradiction(caseData: CaseArchive, a: FactRef, b: FactRef): Contradiction | null {
  if (sameRef(a, b)) return null;
  return caseData.contradictions.find((c) => samePair(c.between, a, b)) ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/archive-contradictions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/games/shadow-trace/archive/contradictions.ts tests/archive-contradictions.test.ts
git commit -m "feat(shadow-trace): archive A0 — FactRef equality + matchContradiction"
```

---

### Task 6: Conditions — evaluateArchiveCondition + isContradictionNoticed

**Files:**
- Create: `src/games/shadow-trace/archive/conditions.ts`
- Test: `tests/archive-conditions.test.ts`

**Interfaces:**
- Consumes: `CaseArchive`, `ArchiveProgress`, `ArchiveCondition`, `Contradiction`, `FactRef` (Task 1); `matchContradiction` (Task 5); `createArchiveProgress`/`accuse` (Tasks 2–3); `pinRecord`/`markSuspicion` (Task 4).
- Produces:
  - `isContradictionNoticed(c: Contradiction, state: ArchiveProgress): boolean`
  - `evaluateArchiveCondition(cond: ArchiveCondition, caseData: CaseArchive, state: ArchiveProgress): boolean`

- [ ] **Step 1: Write the failing test**

```ts
// tests/archive-conditions.test.ts
import { describe, expect, it } from 'vitest';
import { evaluateArchiveCondition, isContradictionNoticed } from '@/games/shadow-trace/archive/conditions';
import { createArchiveProgress, accuse } from '@/games/shadow-trace/archive/state';
import { pinRecord, markSuspicion } from '@/games/shadow-trace/archive/casefile';
import { sampleArchiveCase } from './fixtures/sample-archive-case';
import type { FactRef } from '@/games/shadow-trace/archive/types';

const cTime = sampleArchiveCase.contradictions.find((c) => c.id === 'c_time')!;
const lie: [FactRef, FactRef] = [
  { kind: 'recordClaim', recordId: 'r_eron', claimId: 'home' },
  { kind: 'metadata', recordId: 'r_access_log', field: 'time' },
];

describe('isContradictionNoticed', () => {
  it('is true once both referenced records are pinned or suspected', () => {
    let p = createArchiveProgress(sampleArchiveCase);
    expect(isContradictionNoticed(cTime, p)).toBe(false);
    p = pinRecord(p, 'r_eron');
    expect(isContradictionNoticed(cTime, p)).toBe(false); // only one side
    p = markSuspicion(p, 'r_access_log');
    expect(isContradictionNoticed(cTime, p)).toBe(true);
  });
});

describe('evaluateArchiveCondition', () => {
  it('evaluates accuse / decisiveLie / noticedContradiction / hasKey and combinators', () => {
    let p = createArchiveProgress(sampleArchiveCase);
    p = pinRecord(pinRecord(p, 'r_eron'), 'r_access_log');
    p = accuse(p, { culpritEntityId: 's_eron', decisiveLie: lie });

    expect(evaluateArchiveCondition({ accuse: 's_eron' }, sampleArchiveCase, p)).toBe(true);
    expect(evaluateArchiveCondition({ accuse: 's_mara' }, sampleArchiveCase, p)).toBe(false);
    expect(evaluateArchiveCondition({ decisiveLie: 'c_time' }, sampleArchiveCase, p)).toBe(true);
    expect(evaluateArchiveCondition({ decisiveLie: 'c_photo' }, sampleArchiveCase, p)).toBe(false);
    expect(evaluateArchiveCondition({ noticedContradiction: 'c_time' }, sampleArchiveCase, p)).toBe(true);
    expect(evaluateArchiveCondition({ hasKey: 'k_archive' }, sampleArchiveCase, p)).toBe(false);
    expect(
      evaluateArchiveCondition({ all: [{ accuse: 's_eron' }, { decisiveLie: 'c_time' }] }, sampleArchiveCase, p),
    ).toBe(true);
    expect(evaluateArchiveCondition({ not: { accuse: 's_mara' } }, sampleArchiveCase, p)).toBe(true);
    expect(evaluateArchiveCondition({ all: [] }, sampleArchiveCase, p)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/archive-conditions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/games/shadow-trace/archive/conditions.ts
import type { CaseArchive, ArchiveProgress, ArchiveCondition, Contradiction, FactRef } from './types';
import { matchContradiction } from './contradictions';

function refRecordId(ref: FactRef): string | null {
  if (ref.kind === 'record' || ref.kind === 'recordClaim' || ref.kind === 'metadata') return ref.recordId;
  return null;
}

/** Has the player "marked" this fact — pinned/suspected its record, or pinned its entity? */
function isRefMarked(ref: FactRef, state: ArchiveProgress): boolean {
  const rid = refRecordId(ref);
  if (rid) return state.pinnedRecords.includes(rid) || state.suspicions.some((s) => s.recordId === rid);
  if (ref.kind === 'entity') return state.pinnedEntities.includes(ref.entityId);
  return false;
}

/** A contradiction is "noticed" when both of its facts are marked in the case file. */
export function isContradictionNoticed(c: Contradiction, state: ArchiveProgress): boolean {
  return c.between.every((ref) => isRefMarked(ref, state));
}

export function evaluateArchiveCondition(
  cond: ArchiveCondition,
  caseData: CaseArchive,
  state: ArchiveProgress,
): boolean {
  if ('accuse' in cond) return state.accusation?.culpritEntityId === cond.accuse;
  if ('decisiveLie' in cond) {
    const lie = state.accusation?.decisiveLie;
    if (!lie) return false;
    return matchContradiction(caseData, lie[0], lie[1])?.id === cond.decisiveLie;
  }
  if ('noticedContradiction' in cond) {
    const c = caseData.contradictions.find((x) => x.id === cond.noticedContradiction);
    return c ? isContradictionNoticed(c, state) : false;
  }
  if ('hasKey' in cond) return state.keys.includes(cond.hasKey);
  if ('all' in cond) return cond.all.every((c) => evaluateArchiveCondition(c, caseData, state));
  if ('any' in cond) return cond.any.some((c) => evaluateArchiveCondition(c, caseData, state));
  if ('not' in cond) return !evaluateArchiveCondition(cond.not, caseData, state);
  return false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/archive-conditions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/games/shadow-trace/archive/conditions.ts tests/archive-conditions.test.ts
git commit -m "feat(shadow-trace): archive A0 — condition evaluation + noticed-contradiction"
```

---

### Task 7: Endings — resolveEnding, scoring, checkAccusation

**Files:**
- Create: `src/games/shadow-trace/archive/endings.ts`
- Test: `tests/archive-endings.test.ts`

**Interfaces:**
- Consumes: `CaseArchive`, `ArchiveProgress`, `Ending`, `DeductionResultArchive`, `Rank`, `EndingQuality`, `Contradiction`, `FactRef` (Task 1); `evaluateArchiveCondition`/`isContradictionNoticed` (Task 6); `matchContradiction` (Task 5); `createArchiveProgress`/`openRecord`/`accuse` (Tasks 2–3); `pinRecord`/`markSuspicion` (Task 4).
- Produces:
  - `resolveEnding(caseData, state): Ending`
  - `decisiveContradiction(caseData): Contradiction | null`
  - `scoreCaseArchive(caseData, state): DeductionResultArchive`
  - `checkAccusation(caseData, state): { ending: Ending; result: DeductionResultArchive }` plus exported type `AccusationOutcome`

- [ ] **Step 1: Write the failing test**

```ts
// tests/archive-endings.test.ts
import { describe, expect, it } from 'vitest';
import { resolveEnding, scoreCaseArchive, decisiveContradiction, checkAccusation } from '@/games/shadow-trace/archive/endings';
import { createArchiveProgress, openRecord, grantKey, accuse } from '@/games/shadow-trace/archive/state';
import { pinRecord, markSuspicion } from '@/games/shadow-trace/archive/casefile';
import { sampleArchiveCase } from './fixtures/sample-archive-case';
import type { ArchiveProgress, FactRef } from '@/games/shadow-trace/archive/types';

const lie: [FactRef, FactRef] = [
  { kind: 'recordClaim', recordId: 'r_eron', claimId: 'home' },
  { kind: 'metadata', recordId: 'r_access_log', field: 'time' },
];

/** Walk the full solve: open the thread, unseal the log, pin the contradicting records. */
function solvedState(): ArchiveProgress {
  let p = createArchiveProgress(sampleArchiveCase);
  p = openRecord(sampleArchiveCase, p, 'r_cctv_photo');
  p = openRecord(sampleArchiveCase, p, 'r_chat_admin');
  p = openRecord(sampleArchiveCase, p, 'r_access_log');
  p = pinRecord(p, 'r_eron');
  p = pinRecord(p, 'r_access_log');
  p = pinRecord(p, 'r_cctv_photo'); // makes c_photo noticed too
  return accuse(p, { culpritEntityId: 's_eron', decisiveLie: lie });
}

describe('decisiveContradiction', () => {
  it('is the highest-weight authored contradiction', () => {
    expect(decisiveContradiction(sampleArchiveCase)?.id).toBe('c_time');
  });
});

describe('resolveEnding', () => {
  it('returns truth for a correct, well-supported accusation', () => {
    expect(resolveEnding(sampleArchiveCase, solvedState()).id).toBe('end_truth');
  });
  it('returns miscarriage when the wrong suspect is accused', () => {
    const p = accuse(createArchiveProgress(sampleArchiveCase), { culpritEntityId: 's_mara' });
    expect(resolveEnding(sampleArchiveCase, p).id).toBe('end_miscarriage');
  });
  it('returns cold_case when there is no accusation', () => {
    expect(resolveEnding(sampleArchiveCase, createArchiveProgress(sampleArchiveCase)).id).toBe('end_cold');
  });
});

describe('scoreCaseArchive', () => {
  it('awards a perfect S for the full solve', () => {
    const r = scoreCaseArchive(sampleArchiveCase, solvedState());
    expect(r.decisiveLieCorrect).toBe(true);
    expect(r.contradictionsNoticed).toBe(2);
    expect(r.contradictionsTotal).toBe(2);
    expect(r.sealsOpened).toBe(1);
    expect(r.sealsTotal).toBe(1);
    expect(r.accusationQuality).toBe('truth');
    expect(r.score).toBe(100);
    expect(r.rank).toBe('S');
    expect(r.flagsForCampaign).toEqual(['eron_jailed']);
  });

  it('penalises an empty suspicion that belongs to no contradiction', () => {
    let p = solvedState();
    p = markSuspicion(p, 'r_report'); // r_report is in no contradiction
    const r = scoreCaseArchive(sampleArchiveCase, p);
    expect(r.emptySuspicions).toBe(1);
    expect(r.score).toBe(95); // 100 - 5
  });

  it('scores a wrong accusation low (miscarriage, no decisive lie)', () => {
    const p = accuse(createArchiveProgress(sampleArchiveCase), { culpritEntityId: 's_mara' });
    const r = scoreCaseArchive(sampleArchiveCase, p);
    expect(r.accusationQuality).toBe('miscarriage');
    expect(r.decisiveLieCorrect).toBe(false);
    expect(r.rank).toBe('F');
  });
});

describe('checkAccusation', () => {
  it('bundles the resolved ending and the score', () => {
    const out = checkAccusation(sampleArchiveCase, solvedState());
    expect(out.ending.id).toBe('end_truth');
    expect(out.result.rank).toBe('S');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/archive-endings.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/games/shadow-trace/archive/endings.ts
import type {
  CaseArchive,
  ArchiveProgress,
  Ending,
  DeductionResultArchive,
  Rank,
  EndingQuality,
  Contradiction,
} from './types';
import { evaluateArchiveCondition, isContradictionNoticed } from './conditions';
import { matchContradiction } from './contradictions';

const COLD_CASE_FALLBACK: Ending = {
  id: 'cold_case_default',
  title: 'Дело закрыто без ответа',
  requires: { all: [] },
  quality: 'cold_case',
  epilogue: ['Улик не хватило. Дело отправлено в архив.'],
};

/** First ending whose `requires` holds, top-down. Synthetic cold_case if none match. */
export function resolveEnding(caseData: CaseArchive, state: ArchiveProgress): Ending {
  return caseData.endings.find((e) => evaluateArchiveCondition(e.requires, caseData, state)) ?? COLD_CASE_FALLBACK;
}

/** The decisive (highest-weight) authored contradiction; ties resolved by array order. */
export function decisiveContradiction(caseData: CaseArchive): Contradiction | null {
  if (caseData.contradictions.length === 0) return null;
  return caseData.contradictions.reduce((best, c) => (c.weight > best.weight ? c : best));
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
 *   noticed contradictions 40 · decisive lie 30 · seals opened 15 · accusation quality 15
 *   minus 5 per empty suspicion (one in no contradiction), capped at 20.
 */
export function scoreCaseArchive(caseData: CaseArchive, state: ArchiveProgress): DeductionResultArchive {
  const contradictionsTotal = caseData.contradictions.length;
  const contradictionsNoticed = caseData.contradictions.filter((c) => isContradictionNoticed(c, state)).length;

  const decisive = decisiveContradiction(caseData);
  const lie = state.accusation?.decisiveLie;
  const decisiveLieCorrect = Boolean(
    decisive && lie && matchContradiction(caseData, lie[0], lie[1])?.id === decisive.id,
  );

  const sealed = caseData.records.filter((r) => r.seal);
  const sealsTotal = sealed.length;
  const sealsOpened = sealed.filter((r) => state.openRecords.includes(r.id)).length;

  const contradictionRecordIds = new Set<string>();
  for (const c of caseData.contradictions) {
    for (const ref of c.between) {
      if (ref.kind !== 'entity') contradictionRecordIds.add(ref.recordId);
    }
  }
  const emptySuspicions = state.suspicions.filter((s) => !contradictionRecordIds.has(s.recordId)).length;

  const ending = resolveEnding(caseData, state);
  const accusationQuality: EndingQuality = ending.quality;

  const noticedScore = contradictionsTotal ? (contradictionsNoticed / contradictionsTotal) * 40 : 40;
  const decisiveScore = decisiveLieCorrect ? 30 : 0;
  const sealScore = sealsTotal ? (sealsOpened / sealsTotal) * 15 : 15;
  const qualityScore = accusationQuality === 'truth' ? 15 : accusationQuality === 'partial' ? 7 : 0;
  const penalty = Math.min(emptySuspicions * 5, 20);
  const score = Math.max(0, Math.round(noticedScore + decisiveScore + sealScore + qualityScore - penalty));

  return {
    rank: rankFor(score),
    score,
    decisiveLieCorrect,
    contradictionsNoticed,
    contradictionsTotal,
    sealsOpened,
    sealsTotal,
    emptySuspicions,
    accusationQuality,
    flagsForCampaign: ending.campaignFlags ?? [],
  };
}

export interface AccusationOutcome {
  ending: Ending;
  result: DeductionResultArchive;
}

/** Resolve the ending and compute the score together. */
export function checkAccusation(caseData: CaseArchive, state: ArchiveProgress): AccusationOutcome {
  return { ending: resolveEnding(caseData, state), result: scoreCaseArchive(caseData, state) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/archive-endings.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/games/shadow-trace/archive/endings.ts tests/archive-endings.test.ts
git commit -m "feat(shadow-trace): archive A0 — resolveEnding + scoring + checkAccusation"
```

---

### Task 8: Selectors — record view, entity page, index, case file, suspects

**Files:**
- Create: `src/games/shadow-trace/archive/selectors.ts`
- Test: `tests/archive-selectors.test.ts`

**Interfaces:**
- Consumes: `CaseArchive`, `ArchiveProgress`, `ArchiveRecord`, `Entity`, `EntityType` (Task 1); `MediaSpec` (media-types, Task 1); `createArchiveProgress`/`openRecord` (Tasks 2–3); `pinRecord`/`markSuspicion`/`addNote` (Task 4).
- Produces (and their exported view types):
  - `getRecordView(caseData, state, recordId): RecordView | null` — type `RecordView`, `ResolvedSpan`
  - `getEntityPage(caseData, state, entityId): EntityPage | null` — type `EntityPage`, `EntityRecordRef`
  - `getDiscoveredIndex(caseData, state): IndexGroup[]` — type `IndexGroup`
  - `getCaseFile(caseData, state): CaseFileView` — type `CaseFileView`
  - `getAccusableSuspects(caseData, state): Entity[]`

- [ ] **Step 1: Write the failing test**

```ts
// tests/archive-selectors.test.ts
import { describe, expect, it } from 'vitest';
import {
  getRecordView,
  getEntityPage,
  getDiscoveredIndex,
  getCaseFile,
  getAccusableSuspects,
} from '@/games/shadow-trace/archive/selectors';
import { createArchiveProgress, openRecord } from '@/games/shadow-trace/archive/state';
import { pinRecord, markSuspicion, addNote } from '@/games/shadow-trace/archive/casefile';
import { sampleArchiveCase } from './fixtures/sample-archive-case';

describe('getRecordView', () => {
  it('resolves entity spans to clickable links and attaches media', () => {
    const p = createArchiveProgress(sampleArchiveCase);
    const view = getRecordView(sampleArchiveCase, p, 'r_cctv_photo')!;
    expect(view.sealed).toBe(false);
    expect(view.media?.style).toBe('cctv');
    const linked = view.spans.filter((s) => s.entity);
    expect(linked.map((s) => s.entity!.id)).toEqual(expect.arrayContaining(['ev_cctv', 'p_office', 't_2130', 's_admin']));
  });

  it('hides the body and media of a sealed record but exposes the hint', () => {
    const p = createArchiveProgress(sampleArchiveCase);
    const view = getRecordView(sampleArchiveCase, p, 'r_access_log')!;
    expect(view.sealed).toBe(true);
    expect(view.spans).toEqual([]);
    expect(view.media).toBeUndefined();
    expect(view.sealHint).toContain('архив');
  });
});

describe('getEntityPage', () => {
  it('lists records mentioning the entity with their sealed flag', () => {
    let p = createArchiveProgress(sampleArchiveCase);
    p = openRecord(sampleArchiveCase, p, 'r_cctv_photo'); // discover s_admin
    const page = getEntityPage(sampleArchiveCase, p, 'p_office')!;
    expect(page.entity.id).toBe('p_office');
    const ids = page.records.map((r) => r.record.id);
    expect(ids).toEqual(expect.arrayContaining(['r_report', 'r_eron', 'r_cctv_photo', 'r_access_log']));
    const log = page.records.find((r) => r.record.id === 'r_access_log')!;
    expect(log.sealed).toBe(true);
  });

  it('returns null for an undiscovered entity', () => {
    const p = createArchiveProgress(sampleArchiveCase);
    expect(getEntityPage(sampleArchiveCase, p, 's_admin')).toBeNull();
  });
});

describe('getDiscoveredIndex', () => {
  it('groups discovered entities by type with reachable-record counts', () => {
    const p = createArchiveProgress(sampleArchiveCase);
    const groups = getDiscoveredIndex(sampleArchiveCase, p);
    const persons = groups.find((g) => g.type === 'person')!;
    expect(persons.entities.map((e) => e.entity.id)).toEqual(expect.arrayContaining(['s_eron', 's_mara']));
    const place = groups.find((g) => g.type === 'place')!.entities.find((e) => e.entity.id === 'p_office')!;
    expect(place.recordCount).toBeGreaterThanOrEqual(3);
    // s_admin is not discovered yet -> absent
    expect(persons.entities.map((e) => e.entity.id)).not.toContain('s_admin');
  });
});

describe('getCaseFile', () => {
  it('resolves pinned records, suspicions, and notes', () => {
    let p = createArchiveProgress(sampleArchiveCase);
    p = pinRecord(p, 'r_eron');
    p = markSuspicion(p, 'r_eron', 'врёт');
    p = addNote(p, 'сверить время');
    const cf = getCaseFile(sampleArchiveCase, p);
    expect(cf.pinnedRecords.map((r) => r.id)).toEqual(['r_eron']);
    expect(cf.suspicions[0].record.id).toBe('r_eron');
    expect(cf.suspicions[0].note).toBe('врёт');
    expect(cf.notes).toEqual(['сверить время']);
  });
});

describe('getAccusableSuspects', () => {
  it('returns discovered person entities flagged as suspects', () => {
    const p = createArchiveProgress(sampleArchiveCase);
    expect(getAccusableSuspects(sampleArchiveCase, p).map((e) => e.id)).toEqual(
      expect.arrayContaining(['s_eron', 's_mara']),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/archive-selectors.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/games/shadow-trace/archive/selectors.ts
import type { CaseArchive, ArchiveProgress, ArchiveRecord, Entity, EntityType } from './types';
import type { MediaSpec } from './media-types';

export interface ResolvedSpan {
  text: string;
  /** Present → render as a clickable entity link. */
  entity?: Entity;
}
export interface RecordView {
  record: ArchiveRecord;
  spans: ResolvedSpan[];
  media?: MediaSpec;
  sealed: boolean;
  sealHint?: string;
}
export interface EntityRecordRef {
  record: ArchiveRecord;
  sealed: boolean;
}
export interface EntityPage {
  entity: Entity;
  records: EntityRecordRef[];
  relatedEntities: Entity[];
}
export interface IndexGroup {
  type: EntityType;
  entities: { entity: Entity; recordCount: number }[];
}
export interface CaseFileView {
  pinnedRecords: ArchiveRecord[];
  pinnedEntities: Entity[];
  suspicions: { record: ArchiveRecord; note?: string }[];
  notes: string[];
}

const findRecord = (caseData: CaseArchive, id: string): ArchiveRecord | undefined =>
  caseData.records.find((r) => r.id === id);
const findEntity = (caseData: CaseArchive, id: string): Entity | undefined =>
  caseData.entities.find((e) => e.id === id);
const isSealedFor = (state: ArchiveProgress, record: ArchiveRecord): boolean =>
  Boolean(record.seal) && !state.keys.includes(record.seal!.keyId);
const mediaById = (caseData: CaseArchive, mediaId: string): MediaSpec | undefined =>
  (caseData.media ?? []).find((m) => m.id === mediaId)?.media;

const ENTITY_TYPE_ORDER: EntityType[] = ['person', 'place', 'time', 'object', 'event', 'org'];

export function getRecordView(
  caseData: CaseArchive,
  state: ArchiveProgress,
  recordId: string,
): RecordView | null {
  const record = findRecord(caseData, recordId);
  if (!record) return null;
  const sealed = isSealedFor(state, record);
  if (sealed) {
    return { record, spans: [], media: undefined, sealed: true, sealHint: record.seal?.hint };
  }
  const spans: ResolvedSpan[] = record.body.map((s) =>
    'entityId' in s ? { text: s.text, entity: findEntity(caseData, s.entityId) } : { text: s.text },
  );
  const media = record.mediaId ? mediaById(caseData, record.mediaId) : undefined;
  return { record, spans, media, sealed: false };
}

export function getEntityPage(
  caseData: CaseArchive,
  state: ArchiveProgress,
  entityId: string,
): EntityPage | null {
  const entity = findEntity(caseData, entityId);
  if (!entity) return null;
  if (!state.discoveredEntities.includes(entityId)) return null;

  const records: EntityRecordRef[] = caseData.records
    .filter((r) => r.mentions.includes(entityId))
    .map((record) => ({ record, sealed: isSealedFor(state, record) }));

  const related = new Set<string>();
  for (const ref of records) {
    for (const m of ref.record.mentions) {
      if (m !== entityId && state.discoveredEntities.includes(m)) related.add(m);
    }
  }
  const relatedEntities = [...related]
    .map((id) => findEntity(caseData, id))
    .filter((e): e is Entity => Boolean(e));

  return { entity, records, relatedEntities };
}

export function getDiscoveredIndex(caseData: CaseArchive, state: ArchiveProgress): IndexGroup[] {
  const recordCount = (entityId: string): number =>
    caseData.records.filter((r) => r.mentions.includes(entityId)).length;

  return ENTITY_TYPE_ORDER.map((type) => ({
    type,
    entities: caseData.entities
      .filter((e) => e.type === type && state.discoveredEntities.includes(e.id))
      .map((entity) => ({ entity, recordCount: recordCount(entity.id) })),
  })).filter((g) => g.entities.length > 0);
}

export function getCaseFile(caseData: CaseArchive, state: ArchiveProgress): CaseFileView {
  return {
    pinnedRecords: state.pinnedRecords
      .map((id) => findRecord(caseData, id))
      .filter((r): r is ArchiveRecord => Boolean(r)),
    pinnedEntities: state.pinnedEntities
      .map((id) => findEntity(caseData, id))
      .filter((e): e is Entity => Boolean(e)),
    suspicions: state.suspicions
      .map((s) => {
        const record = findRecord(caseData, s.recordId);
        return record ? { record, note: s.note } : null;
      })
      .filter((x): x is { record: ArchiveRecord; note?: string } => Boolean(x)),
    notes: [...state.notes],
  };
}

export function getAccusableSuspects(caseData: CaseArchive, state: ArchiveProgress): Entity[] {
  return caseData.entities.filter(
    (e) => e.type === 'person' && e.isSuspect && state.discoveredEntities.includes(e.id),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/archive-selectors.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/games/shadow-trace/archive/selectors.ts tests/archive-selectors.test.ts
git commit -m "feat(shadow-trace): archive A0 — UI selectors (record/entity/index/casefile)"
```

---

### Task 9: Validator — reachability fixpoint + structural checks

**Files:**
- Create: `src/games/shadow-trace/archive/validator.ts`
- Test: `tests/archive-validator.test.ts`

**Interfaces:**
- Consumes: `CaseArchive`, `ArchiveCondition`, `FactRef` (Task 1); `Rect` (media-types, Task 1).
- Produces:
  - `validateArchiveCase(caseData: CaseArchive): ValidationResult` plus exported types `ValidationIssue`, `ValidationResult`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/archive-validator.test.ts
import { describe, expect, it } from 'vitest';
import { validateArchiveCase } from '@/games/shadow-trace/archive/validator';
import { sampleArchiveCase } from './fixtures/sample-archive-case';
import type { CaseArchive } from '@/games/shadow-trace/archive/types';

const clone = (c: CaseArchive): CaseArchive => JSON.parse(JSON.stringify(c));

describe('validateArchiveCase', () => {
  it('accepts the valid sample case', () => {
    const res = validateArchiveCase(sampleArchiveCase);
    expect(res.ok).toBe(true);
    expect(res.issues).toEqual([]);
  });

  it('flags an unreachable record (no path of entity mentions reaches it)', () => {
    const c = clone(sampleArchiveCase);
    c.records.push({ id: 'r_orphan', kind: 'note', title: 'Сирота', body: [{ text: 'нет связей' }], mentions: [] });
    const res = validateArchiveCase(c);
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.code === 'unreachable_record')).toBe(true);
  });

  it('flags a sealed record whose key can never be obtained', () => {
    const c = clone(sampleArchiveCase);
    c.keysSchema.push({ id: 'k_ghost', label: 'Призрак' });
    c.records.find((r) => r.id === 'r_access_log')!.seal = { keyId: 'k_ghost', hint: 'нет ключа' };
    const res = validateArchiveCase(c);
    expect(res.issues.some((i) => i.code === 'unobtainable_key' || i.code === 'unopenable_seal')).toBe(true);
  });

  it('flags a dangling mention, a bad media ref, and a bad factref', () => {
    const c = clone(sampleArchiveCase);
    c.records[0].mentions.push('e_ghost');
    c.records[0].mediaId = 'm_ghost';
    c.contradictions[0].between[1] = { kind: 'metadata', recordId: 'r_ghost', field: 'time' };
    const res = validateArchiveCase(c);
    const codes = res.issues.map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(['bad_mention', 'bad_media_ref', 'bad_factref']));
  });

  it('flags a duplicate id and a missing truth path', () => {
    const c = clone(sampleArchiveCase);
    c.entities.push({ id: 's_eron', type: 'person', label: 'Дубль' });
    c.endings = c.endings.filter((e) => e.quality !== 'truth');
    const res = validateArchiveCase(c);
    const codes = res.issues.map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(['duplicate_id', 'no_truth_path']));
  });

  it('flags a hotspot out of scene bounds', () => {
    const c = clone(sampleArchiveCase);
    c.media![0].media.hotspots[0].at = { x: 90, y: 90, w: 50, h: 50 };
    const res = validateArchiveCase(c);
    expect(res.issues.some((i) => i.code === 'hotspot_oob')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/archive-validator.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/games/shadow-trace/archive/validator.ts
import type { CaseArchive, ArchiveCondition, FactRef } from './types';
import type { Rect } from './media-types';

export interface ValidationIssue {
  code: string;
  message: string;
}
export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

interface Obtainable {
  records: Set<string>; // reachable (sealed or not)
  readable: Set<string>; // reachable AND unsealed
  entities: Set<string>;
  keys: Set<string>;
}

const inBounds = (r: Rect): boolean =>
  r.x >= 0 && r.y >= 0 && r.w > 0 && r.h > 0 && r.x + r.w <= 100 && r.y + r.h <= 100;

function factRefExists(caseData: CaseArchive, ref: FactRef): boolean {
  if (ref.kind === 'entity') return caseData.entities.some((e) => e.id === ref.entityId);
  return caseData.records.some((r) => r.id === ref.recordId);
}

function factRefObtainable(ref: FactRef, o: Obtainable): boolean {
  if (ref.kind === 'entity') return o.entities.has(ref.entityId);
  return o.readable.has(ref.recordId);
}

/** Could this ending condition EVER hold given the optimistic obtainable set? */
function satisfiable(cond: ArchiveCondition, o: Obtainable, caseData: CaseArchive): boolean {
  if ('accuse' in cond) return true; // the player may always accuse anyone
  if ('hasKey' in cond) return o.keys.has(cond.hasKey);
  if ('decisiveLie' in cond || 'noticedContradiction' in cond) {
    const id = 'decisiveLie' in cond ? cond.decisiveLie : cond.noticedContradiction;
    const c = caseData.contradictions.find((x) => x.id === id);
    return Boolean(c) && c!.between.every((ref) => factRefObtainable(ref, o));
  }
  if ('all' in cond) return cond.all.every((c) => satisfiable(c, o, caseData));
  if ('any' in cond) return cond.any.some((c) => satisfiable(c, o, caseData));
  if ('not' in cond) return true; // optimistic: assume the negated atom is simply never obtained
  return false;
}

function collectAccuseTargets(cond: ArchiveCondition, out: Set<string>): void {
  if ('accuse' in cond) out.add(cond.accuse);
  else if ('all' in cond) cond.all.forEach((c) => collectAccuseTargets(c, out));
  else if ('any' in cond) cond.any.forEach((c) => collectAccuseTargets(c, out));
  else if ('not' in cond) collectAccuseTargets(cond.not, out);
}

export function validateArchiveCase(caseData: CaseArchive): ValidationResult {
  const issues: ValidationIssue[] = [];
  const recordIds = new Set(caseData.records.map((r) => r.id));
  const entityIds = new Set(caseData.entities.map((e) => e.id));
  const keyIds = new Set(caseData.keysSchema.map((k) => k.id));
  const mediaIds = new Set((caseData.media ?? []).map((m) => m.id));

  // 1. seeds exist
  for (const id of caseData.seedRecordIds) {
    if (!recordIds.has(id)) issues.push({ code: 'bad_seed', message: `seed-запись ${id} не найдена` });
  }

  // 2. per-record references resolve
  for (const r of caseData.records) {
    for (const m of r.mentions) {
      if (!entityIds.has(m)) issues.push({ code: 'bad_mention', message: `Запись ${r.id}: упоминание неизвестной сущности ${m}` });
    }
    if (r.mediaId && !mediaIds.has(r.mediaId)) {
      issues.push({ code: 'bad_media_ref', message: `Запись ${r.id}: неизвестное медиа ${r.mediaId}` });
    }
    if (r.seal && !keyIds.has(r.seal.keyId)) {
      issues.push({ code: 'bad_key_ref', message: `Запись ${r.id}: печать требует неизвестный ключ ${r.seal.keyId}` });
    }
    for (const g of r.grantsKeys ?? []) {
      if (!keyIds.has(g)) issues.push({ code: 'bad_key_ref', message: `Запись ${r.id}: выдаёт неизвестный ключ ${g}` });
    }
    for (const s of r.body) {
      if ('entityId' in s && !entityIds.has(s.entityId)) {
        issues.push({ code: 'bad_span', message: `Запись ${r.id}: спан ссылается на неизвестную сущность ${s.entityId}` });
      }
    }
  }

  // 3. media bounds + hotspot key refs
  for (const asset of caseData.media ?? []) {
    for (const h of asset.media.hotspots) {
      if (!inBounds(h.at)) issues.push({ code: 'hotspot_oob', message: `${asset.id}: хотспот ${h.id} вне сцены` });
      for (const g of h.grantsKeys ?? []) {
        if (!keyIds.has(g)) issues.push({ code: 'bad_key_ref', message: `${asset.id}: хотспот ${h.id} выдаёт неизвестный ключ ${g}` });
      }
    }
  }

  // 4. contradiction factrefs exist
  for (const c of caseData.contradictions) {
    for (const ref of c.between) {
      if (!factRefExists(caseData, ref)) {
        issues.push({ code: 'bad_factref', message: `Противоречие ${c.id}: ссылка не разрешается` });
      }
    }
  }

  // 5. reachability fixpoint
  const o: Obtainable = { records: new Set(), readable: new Set(), entities: new Set(), keys: new Set() };
  for (const r of caseData.records) {
    if (!caseData.seedRecordIds.includes(r.id)) continue;
    r.mentions.forEach((m) => o.entities.add(m));
    (r.grantsKeys ?? []).forEach((k) => o.keys.add(k));
  }
  let changed = true;
  let guard = 0;
  while (changed && guard < 10_000) {
    guard += 1;
    changed = false;
    for (const r of caseData.records) {
      const reachable = caseData.seedRecordIds.includes(r.id) || r.mentions.some((m) => o.entities.has(m));
      if (!reachable) continue;
      if (!o.records.has(r.id)) {
        o.records.add(r.id);
        changed = true;
      }
      const unsealed = !r.seal || o.keys.has(r.seal.keyId);
      if (!unsealed) continue;
      if (!o.readable.has(r.id)) {
        o.readable.add(r.id);
        changed = true;
      }
      for (const m of r.mentions) {
        if (!o.entities.has(m)) {
          o.entities.add(m);
          changed = true;
        }
      }
      for (const k of r.grantsKeys ?? []) {
        if (!o.keys.has(k)) {
          o.keys.add(k);
          changed = true;
        }
      }
    }
  }
  if (guard >= 10_000) {
    issues.push({ code: 'fixpoint_guard_exceeded', message: 'Достигнут предел итераций анализа достижимости' });
  }

  // 6. coverage: every record reachable; every sealed record eventually readable
  for (const r of caseData.records) {
    if (!o.records.has(r.id)) {
      issues.push({ code: 'unreachable_record', message: `Запись ${r.id} недостижима` });
    } else if (r.seal && !o.readable.has(r.id)) {
      issues.push({ code: 'unopenable_seal', message: `Запись ${r.id} запечатана, и ключ недобываем` });
    }
  }

  // 7. every declared key obtainable
  for (const k of caseData.keysSchema) {
    if (!o.keys.has(k.id)) issues.push({ code: 'unobtainable_key', message: `Ключ ${k.id} нельзя добыть` });
  }

  // 8. contradiction factrefs reachable
  for (const c of caseData.contradictions) {
    for (const ref of c.between) {
      if (factRefExists(caseData, ref) && !factRefObtainable(ref, o)) {
        issues.push({ code: 'unreachable_factref', message: `Противоречие ${c.id}: факт недостижим` });
      }
    }
  }

  // 9. endings satisfiable + at least one reachable truth ending
  for (const e of caseData.endings) {
    if (!satisfiable(e.requires, o, caseData)) {
      issues.push({ code: 'unreachable_ending', message: `Концовка ${e.id} недостижима` });
    }
  }
  if (!caseData.endings.some((e) => e.quality === 'truth' && satisfiable(e.requires, o, caseData))) {
    issues.push({ code: 'no_truth_path', message: 'Нет достижимой truth-концовки' });
  }

  // 10. ending `accuse` targets are suspect entities
  const suspectIds = new Set(caseData.entities.filter((e) => e.isSuspect).map((e) => e.id));
  const accuseTargets = new Set<string>();
  for (const e of caseData.endings) collectAccuseTargets(e.requires, accuseTargets);
  for (const t of accuseTargets) {
    if (!suspectIds.has(t)) issues.push({ code: 'bad_suspect_ref', message: `Концовка ссылается на не-подозреваемого ${t}` });
  }

  // 11. duplicate ids across keyed collections
  const allIds = [
    ...caseData.records.map((r) => r.id),
    ...caseData.entities.map((e) => e.id),
    ...caseData.contradictions.map((c) => c.id),
    ...caseData.endings.map((e) => e.id),
    ...caseData.keysSchema.map((k) => k.id),
    ...(caseData.media ?? []).map((m) => m.id),
  ];
  const seen = new Set<string>();
  for (const id of allIds) {
    if (seen.has(id)) issues.push({ code: 'duplicate_id', message: `Дублирующийся id: ${id}` });
    seen.add(id);
  }

  return { ok: issues.length === 0, issues };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/archive-validator.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/games/shadow-trace/archive/validator.ts tests/archive-validator.test.ts
git commit -m "feat(shadow-trace): archive A0 — reachability validator"
```

---

### Task 10: Barrel + full-solve integration test

**Files:**
- Create: `src/games/shadow-trace/archive/index.ts`
- Test: `tests/archive-integration.test.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: the public barrel re-exporting all types and functions. No new runtime logic.

- [ ] **Step 1: Write the barrel**

```ts
// src/games/shadow-trace/archive/index.ts
export * from './types';
export * from './media-types';
export { createArchiveProgress, openRecord, grantKey, accuse } from './state';
export {
  pinRecord,
  unpinRecord,
  pinEntity,
  unpinEntity,
  markSuspicion,
  clearSuspicion,
  addNote,
} from './casefile';
export { sameRef, matchContradiction } from './contradictions';
export { evaluateArchiveCondition, isContradictionNoticed } from './conditions';
export { resolveEnding, decisiveContradiction, scoreCaseArchive, checkAccusation } from './endings';
export type { AccusationOutcome } from './endings';
export {
  getRecordView,
  getEntityPage,
  getDiscoveredIndex,
  getCaseFile,
  getAccusableSuspects,
} from './selectors';
export type {
  ResolvedSpan,
  RecordView,
  EntityRecordRef,
  EntityPage,
  IndexGroup,
  CaseFileView,
} from './selectors';
export { validateArchiveCase } from './validator';
export type { ValidationIssue, ValidationResult } from './validator';
```

- [ ] **Step 2: Write the failing integration test**

```ts
// tests/archive-integration.test.ts
import { describe, expect, it } from 'vitest';
import {
  createArchiveProgress,
  openRecord,
  accuse,
  pinRecord,
  markSuspicion,
  checkAccusation,
  validateArchiveCase,
  getDiscoveredIndex,
} from '@/games/shadow-trace/archive';
import { sampleArchiveCase } from './fixtures/sample-archive-case';
import type { FactRef } from '@/games/shadow-trace/archive';

const lie: [FactRef, FactRef] = [
  { kind: 'recordClaim', recordId: 'r_eron', claimId: 'home' },
  { kind: 'metadata', recordId: 'r_access_log', field: 'time' },
];

describe('archive engine — public barrel', () => {
  it('re-exports the validator, which accepts the sample case', () => {
    expect(validateArchiveCase(sampleArchiveCase).ok).toBe(true);
  });
});

describe('full solve via the public API', () => {
  it('follows the thread, unseals the log, accuses correctly, and earns rank S', () => {
    let p = createArchiveProgress(sampleArchiveCase);

    // follow the thread: CCTV photo reveals the admin -> admin chat grants the key -> log unseals
    p = openRecord(sampleArchiveCase, p, 'r_cctv_photo');
    p = openRecord(sampleArchiveCase, p, 'r_chat_admin');
    expect(p.keys).toContain('k_archive');
    p = openRecord(sampleArchiveCase, p, 'r_access_log');
    expect(p.seenRecords).toContain('r_access_log');

    // the admin now shows up in the index
    const persons = getDiscoveredIndex(sampleArchiveCase, p).find((g) => g.type === 'person')!;
    expect(persons.entities.map((e) => e.entity.id)).toContain('s_admin');

    // pin both contradicting records (and the photo so the secondary contradiction is noticed)
    p = pinRecord(p, 'r_eron');
    p = pinRecord(p, 'r_access_log');
    p = pinRecord(p, 'r_cctv_photo');

    p = accuse(p, { culpritEntityId: 's_eron', decisiveLie: lie });
    const out = checkAccusation(sampleArchiveCase, p);
    expect(out.ending.id).toBe('end_truth');
    expect(out.result.rank).toBe('S');
    expect(out.result.score).toBe(100);
  });

  it('a wrong accusation yields a miscarriage ending', () => {
    let p = createArchiveProgress(sampleArchiveCase);
    p = accuse(p, { culpritEntityId: 's_mara' });
    expect(checkAccusation(sampleArchiveCase, p).ending.id).toBe('end_miscarriage');
  });

  it('an empty suspicion (record in no contradiction) costs points', () => {
    let p = createArchiveProgress(sampleArchiveCase);
    p = markSuspicion(p, 'r_report');
    expect(checkAccusation(sampleArchiveCase, p).result.emptySuspicions).toBe(1);
  });
});
```

- [ ] **Step 3: Run test to verify it fails, then passes**

Run: `npx vitest run tests/archive-integration.test.ts`
Expected: FAIL first if the barrel is missing an export; once the barrel (Step 1) is in place, it should PASS. Fix any missing re-export until green.

- [ ] **Step 4: Run the whole suite + typecheck**

Run: `npm run test`
Expected: all archive suites pass (existing engine/colony suites unaffected).

Run: `npm run typecheck`
Expected: no error whose path contains `shadow-trace/archive` or `tests/archive` (colony-only errors, if any, are ignored per Global Constraints).

- [ ] **Step 5: Commit**

```bash
git add src/games/shadow-trace/archive/index.ts tests/archive-integration.test.ts
git commit -m "feat(shadow-trace): archive A0 — public barrel + full-solve integration test"
```

---

## Self-Review

**Spec coverage** (against `2026-06-18-shadow-trace-archive-redesign-design.md`):
- §4 data model (`CaseArchive`/`ArchiveRecord`/`Entity`/`RecordSpan`/`FactRef`/`Contradiction`/seals/keys) → Task 1.
- §5 state + transitions (`createArchiveProgress`/`openRecord`/`grantKey`/`accuse`, reachability rule) → Tasks 2–3; case-file mutations (`pin`/`markSuspicion`/`addNote`) → Task 4.
- §6 selectors (`getRecordView`/`getEntityPage`/`getDiscoveredIndex`/`getCaseFile`/`getAccusableSuspects`) → Task 8; `checkAccusation` → Task 7.
- §7 endings + scoring + the derived "noticed contradiction" metric → Tasks 6–7.
- §8 validator (reachability fixpoint, dangling refs, dup ids, media bounds, truth-path, key obtainability) → Task 9.
- §9 sample case → Task 1 fixture. §12 tests (unit per module + full-solve / wrong-culprit / empty-suspicion integration) → Tasks 2–10.
- §10 scope is A0 only; A1 (UI + JSON case loader + GameModule) is intentionally a SEPARATE plan. §11 (retire old `engine/`) is deferred to after A1, so this plan does not touch `engine/`.

**Placeholder scan:** none — every code and test step is complete.

**Type consistency check:** function names and signatures are identical between each task's "Produces" block, its implementation, and its call sites in later tasks — `createArchiveProgress`, `openRecord`, `grantKey`, `accuse`, `pinRecord`/`unpinRecord`/`pinEntity`/`unpinEntity`/`markSuspicion`/`clearSuspicion`/`addNote`, `sameRef`/`matchContradiction`, `evaluateArchiveCondition`/`isContradictionNoticed`, `resolveEnding`/`decisiveContradiction`/`scoreCaseArchive`/`checkAccusation`, the five selectors, `validateArchiveCase`. The record type is `ArchiveRecord` throughout. `ArchiveProgress` field names are used identically across state/casefile/conditions/endings/selectors. The scoring math (40+30+15+15, −5/empty cap 20) yields the asserted 100→S and 95 results in Task 7's tests.
