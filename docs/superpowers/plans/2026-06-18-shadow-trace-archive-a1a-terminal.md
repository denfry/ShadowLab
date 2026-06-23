# Shadow Trace — Archive Terminal Core (Этап A1a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the archive-investigation playthrough playable end-to-end in the portal: a 3-pane Archive Terminal (index / reader / case-file) driven by the A0 engine, with entity-link navigation, seal unlocking, an accusation flow, and an ending screen — on one authored case. Attached media shows as a placeholder (the full renderer is Этап A1b).

**Architecture:** A new React UI under `src/games/shadow-trace/archive-ui/` mounts through the existing `GameModule` contract (pure-React: `mount()` is a no-op, everything in `Hud`). A pure `archiveReducer` maps UI actions to A0 engine transitions; `useArchiveGame` wraps it in `useReducer` + autosave. Read-only A0 selectors feed presentational components. One new pure selector, `getSelectableFacts`, powers the accusation fact-picker. The old v1 playthrough is replaced.

**Tech Stack:** React 18, TypeScript (strict), Zustand-free local state (`useReducer`/`useState`), Tailwind + CSS-var tokens, framer-motion, Vitest.

## Global Constraints

- New UI code lives under `src/games/shadow-trace/archive-ui/`. The A0 engine `src/games/shadow-trace/archive/` is reused as-is; the ONLY engine change is adding `getSelectableFacts` to `archive/selectors.ts` + its barrel export.
- Pure logic is TDD'd with Vitest. React components have no jsdom/RTL env — they are verified by `npm run typecheck` + `npm run build` per task, and by a manual app run-through in the final task (project convention).
- User-facing strings in **Russian**. Theme is activated with `usePageTheme('shadow')` (crimson/violet noir); reuse existing classes `.panel`, `.panel-inset`, `.chip`, `.label-mono`, `.scanlines`, `.neon-text`, the `Button` primitive (`@/ui/primitives/Button`), `Modal` (`@/ui/primitives/Modal`), and `cx` (`@/core/utils`).
- The record content type is `ArchiveRecord`. Navigation view state is ephemeral UI state, NOT part of `ArchiveProgress`.
- Save payload is the `ArchiveProgress` object directly (it already carries `caseId`); `payloadVersion` is bumped to `2`. Restore only when `mode === 'load'` and `saved.caseId === caseId`.
- Never `git add -A` (this is a shared-contended repo worked in an isolated worktree); stage only each task's exact files. Commands run from the worktree root `C:/Projects/browser_game-archive`.
- Gate every task: the focused vitest (for logic tasks) passes, and `npm run typecheck` is clean (this worktree is fully typecheck-clean — no pre-existing errors).

---

## File Structure

- `src/games/shadow-trace/archive/selectors.ts` — ADD `getSelectableFacts` + `SelectableFact` type (barrel updated).
- `public/data/archive-cases/eron-mara.json` — authored `CaseArchive` (text + metadata; media asset with overlay + hotspot; record/metadata-granularity contradictions).
- `src/games/shadow-trace/archive-ui/ArchiveCaseManager.ts` — fetch + validate + cache case loader.
- `src/games/shadow-trace/archive-ui/archiveReducer.ts` — `ArchiveAction` union + pure `archiveReducer`.
- `src/games/shadow-trace/archive-ui/useArchiveGame.ts` — `useReducer` + autosave hook.
- `src/games/shadow-trace/archive-ui/components/EntityLink.tsx`
- `src/games/shadow-trace/archive-ui/components/IndexPane.tsx`
- `src/games/shadow-trace/archive-ui/components/RecordView.tsx`
- `src/games/shadow-trace/archive-ui/components/EntityCard.tsx`
- `src/games/shadow-trace/archive-ui/components/ReaderPane.tsx`
- `src/games/shadow-trace/archive-ui/media/MediaPlaceholder.tsx`
- `src/games/shadow-trace/archive-ui/components/CaseFilePane.tsx`
- `src/games/shadow-trace/archive-ui/components/AccusationModal.tsx`
- `src/games/shadow-trace/archive-ui/components/EndingScreen.tsx`
- `src/games/shadow-trace/archive-ui/components/ArchiveTerminal.tsx`
- `src/games/shadow-trace/archive-ui/ArchiveGame.tsx`
- `src/games/shadow-trace/ShadowTraceGameModule.tsx` — rewrite to render `ArchiveGame`.
- `src/games/shadow-trace/definition.ts` — refresh copy for the archive concept.
- Final task deletes the retired v1 files.

---

### Task 1: `getSelectableFacts` selector

**Files:**
- Modify: `src/games/shadow-trace/archive/selectors.ts`
- Modify: `src/games/shadow-trace/archive/index.ts` (barrel)
- Test: `tests/archive-selectable-facts.test.ts`

**Interfaces:**
- Consumes: `CaseArchive`, `ArchiveRecord`, `FactRef` (A0 types).
- Produces: `interface SelectableFact { ref: FactRef; label: string }` and `getSelectableFacts(caseData: CaseArchive, record: ArchiveRecord): SelectableFact[]`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/archive-selectable-facts.test.ts
import { describe, expect, it } from 'vitest';
import { getSelectableFacts } from '@/games/shadow-trace/archive/selectors';
import { sampleArchiveCase } from './fixtures/sample-archive-case';

describe('getSelectableFacts', () => {
  it('offers the record itself plus one fact per present metadata field', () => {
    const log = sampleArchiveCase.records.find((r) => r.id === 'r_access_log')!;
    const facts = getSelectableFacts(sampleArchiveCase, log);
    // the whole-record fact
    expect(facts.some((f) => f.ref.kind === 'record' && f.ref.recordId === 'r_access_log')).toBe(true);
    // a metadata fact for the present 'time' field
    const meta = facts.find((f) => f.ref.kind === 'metadata' && f.ref.recordId === 'r_access_log');
    expect(meta?.ref).toEqual({ kind: 'metadata', recordId: 'r_access_log', field: 'time' });
    expect(meta?.label).toContain('21:28'); // metadata.time value surfaced in the label
  });

  it('returns only the record fact when there is no metadata', () => {
    const report = sampleArchiveCase.records.find((r) => r.id === 'r_report')!;
    const facts = getSelectableFacts(sampleArchiveCase, report);
    expect(facts).toHaveLength(1);
    expect(facts[0].ref).toEqual({ kind: 'record', recordId: 'r_report' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/archive-selectable-facts.test.ts`
Expected: FAIL — `getSelectableFacts` is not exported.

- [ ] **Step 3: Implement** (append to `src/games/shadow-trace/archive/selectors.ts`)

```ts
export interface SelectableFact {
  ref: FactRef;
  label: string;
}

const META_FIELD_LABEL: Record<string, string> = { time: 'время', geo: 'место', device: 'устройство' };

/** Facts a player can cite in an accusation: the whole record + each present metadata field. */
export function getSelectableFacts(caseData: CaseArchive, record: ArchiveRecord): SelectableFact[] {
  const facts: SelectableFact[] = [{ ref: { kind: 'record', recordId: record.id }, label: `Запись: ${record.title}` }];
  const m = record.metadata ?? {};
  for (const field of ['time', 'geo', 'device'] as const) {
    const value = m[field];
    if (value) {
      facts.push({
        ref: { kind: 'metadata', recordId: record.id, field },
        label: `${record.title} · ${META_FIELD_LABEL[field]}: ${value}`,
      });
    }
  }
  return facts;
}
```

Add `FactRef` to the existing type import at the top of `selectors.ts` (it currently imports `CaseArchive, ArchiveProgress, ArchiveRecord, Entity, EntityType`):

```ts
import type { CaseArchive, ArchiveProgress, ArchiveRecord, Entity, EntityType, FactRef } from './types';
```

- [ ] **Step 4: Export from the barrel** (`src/games/shadow-trace/archive/index.ts`) — extend the existing selectors export lines:

```ts
export {
  getRecordView,
  getEntityPage,
  getDiscoveredIndex,
  getCaseFile,
  getAccusableSuspects,
  getSelectableFacts,
} from './selectors';
export type {
  ResolvedSpan,
  RecordView,
  EntityRecordRef,
  EntityPage,
  IndexGroup,
  CaseFileView,
  SelectableFact,
} from './selectors';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/archive-selectable-facts.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/games/shadow-trace/archive/selectors.ts src/games/shadow-trace/archive/index.ts tests/archive-selectable-facts.test.ts
git commit -m "feat(shadow-trace): archive A1a — getSelectableFacts selector"
```

---

### Task 2: Authored case JSON + ArchiveCaseManager

**Files:**
- Create: `public/data/archive-cases/eron-mara.json`
- Create: `src/games/shadow-trace/archive-ui/ArchiveCaseManager.ts`
- Test: `tests/archive-case-eron-mara.test.ts`

**Interfaces:**
- Consumes: `CaseArchive`, `validateArchiveCase` (A0).
- Produces: `ArchiveCaseManager` (singleton with `load(caseId: string): Promise<CaseArchive>`) and `DEFAULT_ARCHIVE_CASE_ID = 'eron-mara'`.

- [ ] **Step 1: Author the case JSON** — `public/data/archive-cases/eron-mara.json`

```json
{
  "id": "eron-mara",
  "title": "Дело: ночь в офисе",
  "difficulty": "hard",
  "synopsis": "Ночью в офисе сработала тревога. Эрон уверяет, что был дома. Журнал доступа говорит иначе.",
  "seedRecordIds": ["r_report", "r_eron"],
  "keysSchema": [{ "id": "k_archive", "label": "Доступ к закрытому архиву" }],
  "entities": [
    { "id": "s_eron", "type": "person", "label": "Эрон", "isSuspect": true, "summary": "Ассистент лаборатории." },
    { "id": "s_mara", "type": "person", "label": "Мара", "isSuspect": true, "summary": "Куратор проекта." },
    { "id": "s_admin", "type": "person", "label": "Кат (администратор)", "summary": "Администратор СКУД." },
    { "id": "p_office", "type": "place", "label": "офис" },
    { "id": "t_2200", "type": "time", "label": "22:00" },
    { "id": "t_2130", "type": "time", "label": "21:30" },
    { "id": "t_2128", "type": "time", "label": "21:28" },
    { "id": "o_card", "type": "object", "label": "пропуск-карта" },
    { "id": "ev_cctv", "type": "event", "label": "съёмка CCTV" }
  ],
  "media": [
    {
      "id": "m_cctv",
      "media": {
        "kind": "photo",
        "aspect": "4:3",
        "style": "cctv",
        "layers": [{ "id": "bg", "z": 0, "shape": "rect", "at": { "x": 0, "y": 0, "w": 100, "h": 100 } }],
        "hotspots": [{ "id": "h_clock", "at": { "x": 10, "y": 10, "w": 20, "h": 20 }, "label": "Часы на стене: 21:30" }],
        "overlay": { "timestamp": "21:30", "channel": "CCTV-3" },
        "artifacts": [{ "id": "a_clock", "type": "clock_conflict", "tell": "Время на часах не бьётся с показанием." }]
      }
    }
  ],
  "records": [
    {
      "id": "r_report",
      "kind": "report",
      "title": "Рапорт о происшествии",
      "source": "Дежурный, 12.06",
      "body": [
        { "text": "В " }, { "entityId": "t_2200", "text": "22:00" },
        { "text": " сработала тревога в " }, { "entityId": "p_office", "text": "офисе" },
        { "text": ". Фигуранты: " }, { "entityId": "s_eron", "text": "Эрон" },
        { "text": " и " }, { "entityId": "s_mara", "text": "Мара" },
        { "text": ". Есть " }, { "entityId": "ev_cctv", "text": "запись CCTV" }, { "text": "." }
      ],
      "mentions": ["t_2200", "p_office", "s_eron", "s_mara", "ev_cctv"]
    },
    {
      "id": "r_eron",
      "kind": "transcript",
      "title": "Допрос Эрона",
      "source": "Каб. 4, 12.06",
      "body": [
        { "entityId": "s_eron", "text": "Эрон" },
        { "text": ": «Я был дома в " }, { "entityId": "t_2200", "text": "22:00" },
        { "text": ", в " }, { "entityId": "p_office", "text": "офис" },
        { "text": " не заходил»." }
      ],
      "mentions": ["s_eron", "t_2200", "p_office"]
    },
    {
      "id": "r_cctv_photo",
      "kind": "photo",
      "title": "Кадр CCTV у входа",
      "source": "Канал CCTV-3",
      "mediaId": "m_cctv",
      "metadata": { "time": "21:30", "geo": "office", "device": "CCTV-3" },
      "body": [
        { "text": "Кадр " }, { "entityId": "ev_cctv", "text": "CCTV" },
        { "text": " у " }, { "entityId": "p_office", "text": "офиса" },
        { "text": " в " }, { "entityId": "t_2130", "text": "21:30" },
        { "text": ". Выгрузку подтвердила " }, { "entityId": "s_admin", "text": "Кат" }, { "text": "." }
      ],
      "mentions": ["ev_cctv", "p_office", "t_2130", "s_admin"]
    },
    {
      "id": "r_chat_admin",
      "kind": "chat",
      "title": "Переписка с администратором",
      "source": "Мессенджер",
      "grantsKeys": ["k_archive"],
      "body": [
        { "entityId": "s_admin", "text": "Кат" },
        { "text": ": «Журнал по " }, { "entityId": "o_card", "text": "карте" },
        { "text": " в закрытом архиве, держи доступ»." }
      ],
      "mentions": ["s_admin", "o_card"]
    },
    {
      "id": "r_access_log",
      "kind": "log",
      "title": "Журнал доступа СКУД",
      "source": "Контроллер двери",
      "metadata": { "time": "21:28", "device": "door-reader" },
      "seal": { "keyId": "k_archive", "hint": "Закрытый архив — нужен доступ от администратора." },
      "body": [
        { "text": "В " }, { "entityId": "t_2128", "text": "21:28" },
        { "text": " " }, { "entityId": "o_card", "text": "карта Эрона" },
        { "text": " открыла дверь " }, { "entityId": "p_office", "text": "офиса" }, { "text": "." }
      ],
      "mentions": ["t_2128", "o_card", "p_office", "s_eron"]
    }
  ],
  "contradictions": [
    {
      "id": "c_time",
      "between": [
        { "kind": "record", "recordId": "r_eron" },
        { "kind": "metadata", "recordId": "r_access_log", "field": "time" }
      ],
      "rule": "time_overlap",
      "weight": 3,
      "revealHint": "Дома в 22:00 — но карта открыла офис в 21:28."
    },
    {
      "id": "c_photo",
      "between": [
        { "kind": "record", "recordId": "r_eron" },
        { "kind": "metadata", "recordId": "r_cctv_photo", "field": "time" }
      ],
      "rule": "time_overlap",
      "weight": 1
    }
  ],
  "endings": [
    {
      "id": "end_truth",
      "title": "Истина установлена",
      "requires": { "all": [{ "accuse": "s_eron" }, { "decisiveLie": "c_time" }] },
      "quality": "truth",
      "epilogue": ["Эрон сломался под тяжестью журнала доступа."],
      "campaignFlags": ["eron_jailed"]
    },
    {
      "id": "end_partial",
      "title": "Верно, но шатко",
      "requires": { "accuse": "s_eron" },
      "quality": "partial",
      "epilogue": ["Эрон задержан, но защита найдёт бреши."]
    },
    {
      "id": "end_miscarriage",
      "title": "Осуждён невиновный",
      "requires": { "accuse": "s_mara" },
      "quality": "miscarriage",
      "epilogue": ["Мара осуждена. Настоящий виновный на свободе."]
    },
    {
      "id": "end_cold",
      "title": "Глухарь",
      "requires": { "all": [] },
      "quality": "cold_case",
      "epilogue": ["Улик не хватило."]
    }
  ]
}
```

- [ ] **Step 2: Write the failing test** (validates the authored JSON against the A0 validator)

```ts
// tests/archive-case-eron-mara.test.ts
import { describe, expect, it } from 'vitest';
import { validateArchiveCase } from '@/games/shadow-trace/archive/validator';
import type { CaseArchive } from '@/games/shadow-trace/archive/types';
import caseJson from '../public/data/archive-cases/eron-mara.json';

describe('authored case: eron-mara', () => {
  it('passes the archive validator', () => {
    const res = validateArchiveCase(caseJson as CaseArchive);
    expect(res.issues).toEqual([]);
    expect(res.ok).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails or passes**

Run: `npx vitest run tests/archive-case-eron-mara.test.ts`
Expected: PASS if the JSON is valid (it is authored to be). If it FAILS, read the printed `issues` and fix the JSON — do not weaken the validator.

(Note: importing `.json` requires `resolveJsonModule`, already enabled in this project's tsconfig since the old game imports JSON-shaped data; if vitest complains, add `"resolveJsonModule": true` under `compilerOptions` in `tsconfig.json` and re-run.)

- [ ] **Step 4: Implement the loader** — `src/games/shadow-trace/archive-ui/ArchiveCaseManager.ts`

```ts
import type { CaseArchive } from '../archive';
import { validateArchiveCase } from '../archive';

export const DEFAULT_ARCHIVE_CASE_ID = 'eron-mara';

/** Loads + validates archive cases from public/data/archive-cases, with an in-memory cache. */
class ArchiveCaseManagerImpl {
  private cache = new Map<string, CaseArchive>();

  async load(caseId: string): Promise<CaseArchive> {
    const cached = this.cache.get(caseId);
    if (cached) return cached;
    const res = await fetch(`/data/archive-cases/${caseId}.json`);
    if (!res.ok) throw new Error(`Не удалось загрузить дело: ${caseId}`);
    const data = (await res.json()) as CaseArchive;
    const validation = validateArchiveCase(data);
    if (!validation.ok) {
      console.error(`Дело ${caseId} не прошло валидацию:`, validation.issues);
      if (import.meta.env.DEV) {
        throw new Error(`Дело ${caseId} невалидно: ${validation.issues.map((i) => i.code).join(', ')}`);
      }
    }
    this.cache.set(caseId, data);
    return data;
  }
}

export const ArchiveCaseManager = new ArchiveCaseManagerImpl();
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: clean (no errors).

- [ ] **Step 6: Commit**

```bash
git add public/data/archive-cases/eron-mara.json src/games/shadow-trace/archive-ui/ArchiveCaseManager.ts tests/archive-case-eron-mara.test.ts
git commit -m "feat(shadow-trace): archive A1a — authored case JSON + validating loader"
```

---

### Task 3: `archiveReducer` + action union

**Files:**
- Create: `src/games/shadow-trace/archive-ui/archiveReducer.ts`
- Test: `tests/archive-reducer.test.ts`

**Interfaces:**
- Consumes: A0 `state.ts` (`openRecord`, `grantKey`, `accuse`) and `casefile.ts` (`pinRecord`, `unpinRecord`, `pinEntity`, `unpinEntity`, `markSuspicion`, `clearSuspicion`, `addNote`).
- Produces:
  - `type ArchiveAction` (union, see below).
  - `archiveReducer(caseData: CaseArchive, state: ArchiveProgress, action: ArchiveAction): ArchiveProgress`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/archive-reducer.test.ts
import { describe, expect, it } from 'vitest';
import { archiveReducer } from '@/games/shadow-trace/archive-ui/archiveReducer';
import { createArchiveProgress } from '@/games/shadow-trace/archive';
import { sampleArchiveCase } from './fixtures/sample-archive-case';

describe('archiveReducer', () => {
  it('routes open/pin/markSuspicion/accuse/reset to the engine', () => {
    const c = sampleArchiveCase;
    let s = createArchiveProgress(c);
    s = archiveReducer(c, s, { type: 'open', recordId: 'r_cctv_photo' });
    expect(s.seenRecords).toContain('r_cctv_photo');
    s = archiveReducer(c, s, { type: 'pinRecord', recordId: 'r_eron' });
    expect(s.pinnedRecords).toContain('r_eron');
    s = archiveReducer(c, s, { type: 'markSuspicion', recordId: 'r_eron', note: 'врёт' });
    expect(s.suspicions[0]).toEqual({ recordId: 'r_eron', note: 'врёт' });
    s = archiveReducer(c, s, { type: 'accuse', accusation: { culpritEntityId: 's_eron' } });
    expect(s.accusation?.culpritEntityId).toBe('s_eron');
    const fresh = createArchiveProgress(c);
    expect(archiveReducer(c, s, { type: 'reset', progress: fresh })).toBe(fresh);
  });

  it('grantKey unseals the access log', () => {
    const c = sampleArchiveCase;
    const s = archiveReducer(c, createArchiveProgress(c), { type: 'grantKey', keyId: 'k_archive' });
    expect(s.openRecords).toContain('r_access_log');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/archive-reducer.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `src/games/shadow-trace/archive-ui/archiveReducer.ts`

```ts
import type { CaseArchive, ArchiveProgress, ArchiveAccusation } from '../archive';
import {
  openRecord,
  grantKey,
  accuse,
  pinRecord,
  unpinRecord,
  pinEntity,
  unpinEntity,
  markSuspicion,
  clearSuspicion,
  addNote,
} from '../archive';

export type ArchiveAction =
  | { type: 'open'; recordId: string }
  | { type: 'grantKey'; keyId: string }
  | { type: 'pinRecord'; recordId: string }
  | { type: 'unpinRecord'; recordId: string }
  | { type: 'pinEntity'; entityId: string }
  | { type: 'unpinEntity'; entityId: string }
  | { type: 'markSuspicion'; recordId: string; note?: string }
  | { type: 'clearSuspicion'; recordId: string }
  | { type: 'addNote'; text: string }
  | { type: 'accuse'; accusation: ArchiveAccusation }
  | { type: 'reset'; progress: ArchiveProgress };

/** Pure: maps a UI action to the matching A0 engine transition. */
export function archiveReducer(
  caseData: CaseArchive,
  state: ArchiveProgress,
  action: ArchiveAction,
): ArchiveProgress {
  switch (action.type) {
    case 'open':
      return openRecord(caseData, state, action.recordId);
    case 'grantKey':
      return grantKey(caseData, state, action.keyId);
    case 'pinRecord':
      return pinRecord(state, action.recordId);
    case 'unpinRecord':
      return unpinRecord(state, action.recordId);
    case 'pinEntity':
      return pinEntity(state, action.entityId);
    case 'unpinEntity':
      return unpinEntity(state, action.entityId);
    case 'markSuspicion':
      return markSuspicion(state, action.recordId, action.note);
    case 'clearSuspicion':
      return clearSuspicion(state, action.recordId);
    case 'addNote':
      return addNote(state, action.text);
    case 'accuse':
      return accuse(state, action.accusation);
    case 'reset':
      return action.progress;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/archive-reducer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/games/shadow-trace/archive-ui/archiveReducer.ts tests/archive-reducer.test.ts
git commit -m "feat(shadow-trace): archive A1a — UI action reducer over the engine"
```

---

### Task 4: `useArchiveGame` hook

**Files:**
- Create: `src/games/shadow-trace/archive-ui/useArchiveGame.ts`

**Interfaces:**
- Consumes: `archiveReducer`, `ArchiveAction` (Task 3); `GameContext` (`@/types/game-module`); `CaseArchive`, `ArchiveProgress` (A0).
- Produces: `useArchiveGame(caseData, initial, ctx): { state: ArchiveProgress; dispatch: (a: ArchiveAction) => void }`.

- [ ] **Step 1: Implement** (no unit test — it is a thin React hook; verified by typecheck + the run-through in Task 10)

```ts
// src/games/shadow-trace/archive-ui/useArchiveGame.ts
import { useEffect, useReducer, useRef } from 'react';
import type { GameContext } from '@/types/game-module';
import type { CaseArchive, ArchiveProgress } from '../archive';
import { archiveReducer, type ArchiveAction } from './archiveReducer';

/** Holds ArchiveProgress in a reducer and autosaves on every change (after the initial state). */
export function useArchiveGame(caseData: CaseArchive, initial: ArchiveProgress, ctx: GameContext) {
  const [state, dispatch] = useReducer(
    (s: ArchiveProgress, a: ArchiveAction) => archiveReducer(caseData, s, a),
    initial,
  );

  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const label = `${caseData.title} · ${state.accusation ? 'заключение' : 'расследование'}`;
    ctx.save.autosave(state, label);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return { state, dispatch };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/games/shadow-trace/archive-ui/useArchiveGame.ts
git commit -m "feat(shadow-trace): archive A1a — useArchiveGame state+autosave hook"
```

---

### Task 5: `EntityLink` + `IndexPane`

**Files:**
- Create: `src/games/shadow-trace/archive-ui/components/EntityLink.tsx`
- Create: `src/games/shadow-trace/archive-ui/components/IndexPane.tsx`

**Interfaces:**
- Consumes: `Entity` (A0), `getDiscoveredIndex` (A0), `cx` (`@/core/utils`).
- Produces:
  - `EntityLink({ entity, onClick }: { entity: Entity; onClick: () => void })`
  - `IndexPane({ caseData, state, onOpenRecord, onOpenEntity }: { caseData: CaseArchive; state: ArchiveProgress; onOpenRecord: (id: string) => void; onOpenEntity: (id: string) => void })`

- [ ] **Step 1: Implement `EntityLink`**

```tsx
// src/games/shadow-trace/archive-ui/components/EntityLink.tsx
import type { Entity } from '../../archive';

const TYPE_GLYPH: Record<Entity['type'], string> = {
  person: '🧑', place: '📍', time: '🕘', object: '📦', event: '🎞️', org: '🏢',
};

/** Inline clickable entity reference rendered inside record text. */
export function EntityLink({ entity, onClick }: { entity: Entity; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mx-0.5 inline rounded border border-accent/30 bg-accent/10 px-1 text-accent transition-colors hover:bg-accent/20"
      title={`${TYPE_GLYPH[entity.type]} ${entity.label}`}
    >
      {entity.label}
    </button>
  );
}

export { TYPE_GLYPH };
```

- [ ] **Step 2: Implement `IndexPane`**

```tsx
// src/games/shadow-trace/archive-ui/components/IndexPane.tsx
import type { CaseArchive, ArchiveProgress } from '../../archive';
import { getDiscoveredIndex } from '../../archive';
import { cx } from '@/core/utils';
import { TYPE_GLYPH } from './EntityLink';

const TYPE_LABEL: Record<string, string> = {
  person: 'Лица', place: 'Места', time: 'Время', object: 'Объекты', event: 'События', org: 'Организации',
};

export function IndexPane({
  caseData,
  state,
  onOpenRecord,
  onOpenEntity,
}: {
  caseData: CaseArchive;
  state: ArchiveProgress;
  onOpenRecord: (id: string) => void;
  onOpenEntity: (id: string) => void;
}) {
  const groups = getDiscoveredIndex(caseData, state);
  const openRecords = caseData.records.filter((r) => state.openRecords.includes(r.id));

  return (
    <aside className="panel-inset flex h-full flex-col gap-4 overflow-y-auto p-3">
      <div>
        <p className="label-mono mb-2">Индекс</p>
        {groups.map((g) => (
          <div key={g.type} className="mb-3">
            <p className="mb-1 font-mono text-[0.65rem] uppercase tracking-wider text-muted">
              {TYPE_LABEL[g.type] ?? g.type}
            </p>
            <div className="flex flex-col gap-0.5">
              {g.entities.map(({ entity, recordCount }) => (
                <button
                  key={entity.id}
                  onClick={() => onOpenEntity(entity.id)}
                  className="flex items-center gap-1.5 rounded px-1.5 py-1 text-left text-sm text-ink/85 hover:bg-accent/10 hover:text-accent"
                >
                  <span className="text-xs">{TYPE_GLYPH[entity.type]}</span>
                  <span className="min-w-0 flex-1 truncate">{entity.label}</span>
                  <span className="font-mono text-[0.6rem] text-muted">{recordCount}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto">
        <p className="label-mono mb-2">Записи ({openRecords.length})</p>
        <div className="flex flex-col gap-0.5">
          {openRecords.map((r) => (
            <button
              key={r.id}
              onClick={() => onOpenRecord(r.id)}
              className={cx(
                'flex items-center gap-1.5 rounded px-1.5 py-1 text-left text-sm hover:bg-accent/10 hover:text-accent',
                state.seenRecords.includes(r.id) ? 'text-muted' : 'text-ink',
              )}
            >
              <span className="min-w-0 flex-1 truncate">{r.title}</span>
              {state.seenRecords.includes(r.id) && <span className="text-[0.6rem] text-accent/70">✓</span>}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/games/shadow-trace/archive-ui/components/EntityLink.tsx src/games/shadow-trace/archive-ui/components/IndexPane.tsx
git commit -m "feat(shadow-trace): archive A1a — EntityLink + IndexPane"
```

---

### Task 6: `MediaPlaceholder` + `RecordView` + `EntityCard` + `ReaderPane`

**Files:**
- Create: `src/games/shadow-trace/archive-ui/media/MediaPlaceholder.tsx`
- Create: `src/games/shadow-trace/archive-ui/components/RecordView.tsx`
- Create: `src/games/shadow-trace/archive-ui/components/EntityCard.tsx`
- Create: `src/games/shadow-trace/archive-ui/components/ReaderPane.tsx`

**Interfaces:**
- Consumes: `getRecordView`, `getEntityPage` (A0); `MediaSpec` (A0); `ArchiveAction` (Task 3); `EntityLink` (Task 5); `Button` (`@/ui/primitives/Button`); `cx`.
- Produces:
  - `MediaPlaceholder({ media }: { media: MediaSpec })`
  - `RecordView({ caseData, state, recordId, onOpenEntity, dispatch })`
  - `EntityCard({ caseData, state, entityId, onOpenRecord, onOpenEntity, dispatch })`
  - `ArchiveView` type `{ kind: 'record'; id: string } | { kind: 'entity'; id: string }`
  - `ReaderPane({ caseData, state, view, canBack, onBack, onOpenRecord, onOpenEntity, dispatch })`

- [ ] **Step 1: Implement `MediaPlaceholder`** (A1b replaces this with the real renderer)

```tsx
// src/games/shadow-trace/archive-ui/media/MediaPlaceholder.tsx
import type { MediaSpec } from '../../archive';

/** A1a stand-in for the procedural renderer: frame + overlay metadata + hotspot labels. */
export function MediaPlaceholder({ media }: { media: MediaSpec }) {
  const o = media.overlay ?? {};
  return (
    <div className="panel-inset overflow-hidden">
      <div className="scanlines grid aspect-[4/3] place-items-center bg-bg-2 text-muted">
        <span className="font-mono text-xs uppercase tracking-widest">[{media.style}] кадр</span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-edge/60 p-2 font-mono text-[0.65rem] text-muted">
        {o.timestamp && <span>⏱ {o.timestamp}</span>}
        {o.channel && <span>📡 {o.channel}</span>}
        {o.geostamp && <span>📍 {o.geostamp}</span>}
      </div>
      {media.hotspots.length > 0 && (
        <ul className="border-t border-edge/60 p-2 text-xs text-ink/80">
          {media.hotspots.map((h) => (
            <li key={h.id} className="flex gap-1.5">
              <span className="text-accent">⌖</span>
              {h.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Implement `RecordView`**

```tsx
// src/games/shadow-trace/archive-ui/components/RecordView.tsx
import type { CaseArchive, ArchiveProgress } from '../../archive';
import { getRecordView } from '../../archive';
import type { ArchiveAction } from '../archiveReducer';
import { EntityLink } from './EntityLink';
import { MediaPlaceholder } from '../media/MediaPlaceholder';
import { cx } from '@/core/utils';

export function RecordView({
  caseData,
  state,
  recordId,
  onOpenEntity,
  dispatch,
}: {
  caseData: CaseArchive;
  state: ArchiveProgress;
  recordId: string;
  onOpenEntity: (id: string) => void;
  dispatch: (a: ArchiveAction) => void;
}) {
  const view = getRecordView(caseData, state, recordId);
  if (!view) return null;
  const { record, spans, media, sealed, sealHint } = view;

  if (sealed) {
    return (
      <div className="panel p-6">
        <div className="mb-2 flex items-center gap-2">
          <span className="chip">🔒 запечатано</span>
          <h2 className="font-display text-lg text-ink">{record.title}</h2>
        </div>
        <p className="font-mono text-sm text-warn">{sealHint}</p>
      </div>
    );
  }

  const pinned = state.pinnedRecords.includes(record.id);
  const suspected = state.suspicions.some((s) => s.recordId === record.id);

  return (
    <div className="panel p-6">
      <div className="mb-1 flex items-center gap-2">
        <span className="chip">{record.kind}</span>
        <h2 className="font-display text-lg text-ink">{record.title}</h2>
      </div>
      {(record.source || record.timestamp) && (
        <p className="mb-3 font-mono text-[0.65rem] text-muted">
          {[record.source, record.timestamp].filter(Boolean).join(' · ')}
        </p>
      )}

      <p className="leading-relaxed text-ink/90">
        {spans.map((s, i) =>
          s.entity ? (
            <EntityLink key={i} entity={s.entity} onClick={() => onOpenEntity(s.entity!.id)} />
          ) : (
            <span key={i}>{s.text}</span>
          ),
        )}
      </p>

      {media && (
        <div className="mt-4 max-w-sm">
          <MediaPlaceholder media={media} />
        </div>
      )}

      {record.metadata && (
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 rounded-lg border border-edge/50 bg-bg-2/50 p-2 font-mono text-[0.65rem] text-muted">
          {record.metadata.time && <span>время: {record.metadata.time}</span>}
          {record.metadata.geo && <span>место: {record.metadata.geo}</span>}
          {record.metadata.device && <span>устройство: {record.metadata.device}</span>}
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          onClick={() => dispatch(pinned ? { type: 'unpinRecord', recordId: record.id } : { type: 'pinRecord', recordId: record.id })}
          className={cx(
            'rounded-lg border px-3 py-1.5 text-xs transition-colors',
            pinned ? 'border-accent/60 bg-accent/10 text-accent' : 'border-edge/60 text-muted hover:text-ink',
          )}
        >
          {pinned ? '📌 закреплено' : '📌 закрепить'}
        </button>
        <button
          onClick={() => dispatch(suspected ? { type: 'clearSuspicion', recordId: record.id } : { type: 'markSuspicion', recordId: record.id })}
          className={cx(
            'rounded-lg border px-3 py-1.5 text-xs transition-colors',
            suspected ? 'border-bad/60 bg-bad/10 text-bad' : 'border-edge/60 text-muted hover:text-ink',
          )}
        >
          {suspected ? '⚑ подозрительно' : '⚑ пометить'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Implement `EntityCard`**

```tsx
// src/games/shadow-trace/archive-ui/components/EntityCard.tsx
import type { CaseArchive, ArchiveProgress } from '../../archive';
import { getEntityPage } from '../../archive';
import type { ArchiveAction } from '../archiveReducer';
import { EntityLink, TYPE_GLYPH } from './EntityLink';
import { cx } from '@/core/utils';

export function EntityCard({
  caseData,
  state,
  entityId,
  onOpenRecord,
  onOpenEntity,
  dispatch,
}: {
  caseData: CaseArchive;
  state: ArchiveProgress;
  entityId: string;
  onOpenRecord: (id: string) => void;
  onOpenEntity: (id: string) => void;
  dispatch: (a: ArchiveAction) => void;
}) {
  const page = getEntityPage(caseData, state, entityId);
  if (!page) return null;
  const { entity, records, relatedEntities } = page;
  const pinned = state.pinnedEntities.includes(entity.id);

  return (
    <div className="panel p-6">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-lg">{TYPE_GLYPH[entity.type]}</span>
        <h2 className="font-display text-lg text-ink">{entity.label}</h2>
        <button
          onClick={() => dispatch(pinned ? { type: 'unpinEntity', entityId: entity.id } : { type: 'pinEntity', entityId: entity.id })}
          className={cx(
            'ml-auto rounded-lg border px-3 py-1 text-xs',
            pinned ? 'border-accent/60 bg-accent/10 text-accent' : 'border-edge/60 text-muted hover:text-ink',
          )}
        >
          {pinned ? '📌' : '📌 закрепить'}
        </button>
      </div>
      {entity.summary && <p className="mb-4 text-sm text-muted">{entity.summary}</p>}

      <p className="label-mono mb-2">Записи ({records.length})</p>
      <div className="flex flex-col gap-1.5">
        {records.map(({ record, sealed }) => (
          <button
            key={record.id}
            onClick={() => onOpenRecord(record.id)}
            className="flex items-center gap-2 rounded-lg border border-edge/60 px-3 py-2 text-left text-sm hover:border-accent/40"
          >
            <span>{sealed ? '🔒' : '📄'}</span>
            <span className="min-w-0 flex-1 truncate text-ink/85">{record.title}</span>
          </button>
        ))}
      </div>

      {relatedEntities.length > 0 && (
        <div className="mt-4">
          <p className="label-mono mb-2">Связанные</p>
          <div className="flex flex-wrap gap-1.5">
            {relatedEntities.map((e) => (
              <EntityLink key={e.id} entity={e} onClick={() => onOpenEntity(e.id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Implement `ReaderPane`**

```tsx
// src/games/shadow-trace/archive-ui/components/ReaderPane.tsx
import type { CaseArchive, ArchiveProgress } from '../../archive';
import type { ArchiveAction } from '../archiveReducer';
import { RecordView } from './RecordView';
import { EntityCard } from './EntityCard';

export type ArchiveView = { kind: 'record'; id: string } | { kind: 'entity'; id: string };

export function ReaderPane({
  caseData,
  state,
  view,
  canBack,
  onBack,
  onOpenRecord,
  onOpenEntity,
  dispatch,
}: {
  caseData: CaseArchive;
  state: ArchiveProgress;
  view: ArchiveView | null;
  canBack: boolean;
  onBack: () => void;
  onOpenRecord: (id: string) => void;
  onOpenEntity: (id: string) => void;
  dispatch: (a: ArchiveAction) => void;
}) {
  return (
    <section className="flex h-full flex-col overflow-y-auto">
      {canBack && (
        <button onClick={onBack} className="mb-3 self-start font-mono text-xs text-muted hover:text-accent">
          ← назад
        </button>
      )}
      {!view && (
        <div className="grid flex-1 place-items-center text-center text-muted">
          <p className="max-w-xs text-sm">
            Откройте запись слева. Кликайте по подсвеченным сущностям, чтобы идти по нитке дела.
          </p>
        </div>
      )}
      {view?.kind === 'record' && (
        <RecordView caseData={caseData} state={state} recordId={view.id} onOpenEntity={onOpenEntity} dispatch={dispatch} />
      )}
      {view?.kind === 'entity' && (
        <EntityCard
          caseData={caseData}
          state={state}
          entityId={view.id}
          onOpenRecord={onOpenRecord}
          onOpenEntity={onOpenEntity}
          dispatch={dispatch}
        />
      )}
    </section>
  );
}
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/games/shadow-trace/archive-ui/media/MediaPlaceholder.tsx src/games/shadow-trace/archive-ui/components/RecordView.tsx src/games/shadow-trace/archive-ui/components/EntityCard.tsx src/games/shadow-trace/archive-ui/components/ReaderPane.tsx
git commit -m "feat(shadow-trace): archive A1a — reader pane (record/entity views + media placeholder)"
```

---

### Task 7: `CaseFilePane`

**Files:**
- Create: `src/games/shadow-trace/archive-ui/components/CaseFilePane.tsx`

**Interfaces:**
- Consumes: `getCaseFile` (A0); `ArchiveAction` (Task 3); `Button`; `cx`.
- Produces: `CaseFilePane({ caseData, state, onOpenRecord, onOpenEntity, dispatch, onAccuse })`.

- [ ] **Step 1: Implement**

```tsx
// src/games/shadow-trace/archive-ui/components/CaseFilePane.tsx
import { useState } from 'react';
import type { CaseArchive, ArchiveProgress } from '../../archive';
import { getCaseFile } from '../../archive';
import type { ArchiveAction } from '../archiveReducer';
import { Button } from '@/ui/primitives/Button';

export function CaseFilePane({
  caseData,
  state,
  onOpenRecord,
  onOpenEntity,
  dispatch,
  onAccuse,
}: {
  caseData: CaseArchive;
  state: ArchiveProgress;
  onOpenRecord: (id: string) => void;
  onOpenEntity: (id: string) => void;
  dispatch: (a: ArchiveAction) => void;
  onAccuse: () => void;
}) {
  const cf = getCaseFile(caseData, state);
  const [note, setNote] = useState('');

  const submitNote = () => {
    const text = note.trim();
    if (!text) return;
    dispatch({ type: 'addNote', text });
    setNote('');
  };

  return (
    <aside className="panel-inset flex h-full flex-col gap-4 overflow-y-auto p-3">
      <p className="label-mono">Досье</p>

      <div>
        <p className="mb-1 font-mono text-[0.65rem] uppercase tracking-wider text-muted">📌 Записи</p>
        {cf.pinnedRecords.length === 0 && <p className="text-xs text-muted/60">— пусто</p>}
        {cf.pinnedRecords.map((r) => (
          <button key={r.id} onClick={() => onOpenRecord(r.id)} className="block w-full truncate rounded px-1.5 py-1 text-left text-sm text-ink/85 hover:bg-accent/10 hover:text-accent">
            {r.title}
          </button>
        ))}
      </div>

      <div>
        <p className="mb-1 font-mono text-[0.65rem] uppercase tracking-wider text-muted">📌 Сущности</p>
        {cf.pinnedEntities.length === 0 && <p className="text-xs text-muted/60">— пусто</p>}
        <div className="flex flex-wrap gap-1">
          {cf.pinnedEntities.map((e) => (
            <button key={e.id} onClick={() => onOpenEntity(e.id)} className="rounded border border-accent/30 bg-accent/10 px-1.5 text-xs text-accent">
              {e.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 font-mono text-[0.65rem] uppercase tracking-wider text-muted">⚑ Подозрения</p>
        {cf.suspicions.length === 0 && <p className="text-xs text-muted/60">— пусто</p>}
        {cf.suspicions.map((s) => (
          <button key={s.record.id} onClick={() => onOpenRecord(s.record.id)} className="block w-full rounded px-1.5 py-1 text-left text-sm text-bad/90 hover:bg-bad/10">
            <span className="truncate">{s.record.title}</span>
            {s.note && <span className="block truncate font-mono text-[0.6rem] text-muted">«{s.note}»</span>}
          </button>
        ))}
      </div>

      <div>
        <p className="mb-1 font-mono text-[0.65rem] uppercase tracking-wider text-muted">✎ Заметки</p>
        {cf.notes.map((n, i) => (
          <p key={i} className="mb-1 rounded bg-bg-2/60 px-1.5 py-1 text-xs text-ink/80">{n}</p>
        ))}
        <div className="mt-1 flex gap-1">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitNote()}
            placeholder="заметка…"
            className="min-w-0 flex-1 rounded border border-edge/60 bg-bg-2/60 px-2 py-1 font-mono text-xs text-ink outline-none focus:border-accent/50"
          />
          <button onClick={submitNote} className="rounded border border-edge/60 px-2 text-xs text-muted hover:text-accent">+</button>
        </div>
      </div>

      <Button className="mt-auto" variant="danger" onClick={onAccuse}>
        Заключение
      </Button>
    </aside>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/games/shadow-trace/archive-ui/components/CaseFilePane.tsx
git commit -m "feat(shadow-trace): archive A1a — case-file pane"
```

---

### Task 8: `AccusationModal` + `EndingScreen`

**Files:**
- Create: `src/games/shadow-trace/archive-ui/components/AccusationModal.tsx`
- Create: `src/games/shadow-trace/archive-ui/components/EndingScreen.tsx`

**Interfaces:**
- Consumes: `getAccusableSuspects`, `getCaseFile`, `getSelectableFacts`, `checkAccusation`, `sameRef` (A0); `ArchiveAccusation`, `FactRef`, `SelectableFact` (A0); `Modal`, `Button`; `GameContext`; `cx`.
- Produces:
  - `AccusationModal({ open, caseData, state, onClose, onSubmit }: { ...; onSubmit: (a: ArchiveAccusation) => void })`
  - `EndingScreen({ caseData, state, ctx, onReplay })`

- [ ] **Step 1: Implement `AccusationModal`**

```tsx
// src/games/shadow-trace/archive-ui/components/AccusationModal.tsx
import { useMemo, useState } from 'react';
import type { CaseArchive, ArchiveProgress, ArchiveAccusation, FactRef, SelectableFact } from '../../archive';
import { getAccusableSuspects, getCaseFile, getSelectableFacts, sameRef } from '../../archive';
import { Modal } from '@/ui/primitives/Modal';
import { Button } from '@/ui/primitives/Button';
import { cx } from '@/core/utils';

export function AccusationModal({
  open,
  caseData,
  state,
  onClose,
  onSubmit,
}: {
  open: boolean;
  caseData: CaseArchive;
  state: ArchiveProgress;
  onClose: () => void;
  onSubmit: (a: ArchiveAccusation) => void;
}) {
  const suspects = getAccusableSuspects(caseData, state);
  const facts = useMemo<SelectableFact[]>(
    () => getCaseFile(caseData, state).pinnedRecords.flatMap((r) => getSelectableFacts(caseData, r)),
    [caseData, state],
  );

  const [culprit, setCulprit] = useState('');
  const [picked, setPicked] = useState<FactRef[]>([]);

  const togglePick = (ref: FactRef) =>
    setPicked((prev) => {
      if (prev.some((r) => sameRef(r, ref))) return prev.filter((r) => !sameRef(r, ref));
      if (prev.length >= 2) return [prev[1], ref]; // keep last two
      return [...prev, ref];
    });

  const submit = () => {
    const accusation: ArchiveAccusation = { culpritEntityId: culprit };
    if (picked.length === 2) accusation.decisiveLie = [picked[0], picked[1]];
    onSubmit(accusation);
    setCulprit('');
    setPicked([]);
  };

  return (
    <Modal open={open} onClose={onClose} title="Заключение по делу">
      <p className="mb-2 label-mono">Виновный</p>
      <div className="mb-5 grid gap-2 sm:grid-cols-2">
        {suspects.map((s) => (
          <button
            key={s.id}
            onClick={() => setCulprit(s.id)}
            className={cx('rounded-xl border p-3 text-left', culprit === s.id ? 'border-bad/60 bg-bad/10' : 'border-edge/60 hover:border-bad/40')}
          >
            <p className="font-display text-sm text-ink">{s.label}</p>
            {s.summary && <p className="text-[0.7rem] text-muted">{s.summary}</p>}
          </button>
        ))}
      </div>

      <p className="mb-2 label-mono">Решающая ложь — выберите два факта ({picked.length}/2)</p>
      {facts.length === 0 && <p className="mb-3 text-xs text-muted">Закрепите записи в досье, чтобы выбрать факты.</p>}
      <div className="mb-5 flex max-h-48 flex-col gap-1.5 overflow-y-auto">
        {facts.map((f) => {
          const on = picked.some((r) => sameRef(r, f.ref));
          return (
            <button
              key={`${f.ref.kind}:${'recordId' in f.ref ? f.ref.recordId : f.ref.entityId}:${'field' in f.ref ? f.ref.field : ''}`}
              onClick={() => togglePick(f.ref)}
              className={cx('rounded-lg border px-3 py-1.5 text-left text-xs', on ? 'border-accent/60 bg-accent/10 text-accent' : 'border-edge/60 text-ink/80 hover:border-accent/40')}
            >
              {on ? '◉ ' : '○ '}{f.label}
            </button>
          );
        })}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Отмена</Button>
        <Button variant="danger" disabled={!culprit} onClick={submit}>Предъявить</Button>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: Implement `EndingScreen`**

```tsx
// src/games/shadow-trace/archive-ui/components/EndingScreen.tsx
import { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import type { CaseArchive, ArchiveProgress } from '../../archive';
import { checkAccusation } from '../../archive';
import type { GameContext } from '@/types/game-module';
import { Button } from '@/ui/primitives/Button';
import { cx } from '@/core/utils';

const RANK_TONE: Record<string, string> = { S: 'text-accent', A: 'text-good', B: 'text-good', C: 'text-warn', F: 'text-bad' };

export function EndingScreen({
  caseData,
  state,
  ctx,
  onReplay,
}: {
  caseData: CaseArchive;
  state: ArchiveProgress;
  ctx: GameContext;
  onReplay: () => void;
}) {
  const { ending, result } = useMemo(() => checkAccusation(caseData, state), [caseData, state]);

  // Persist results once on mount (side effects belong in an effect, not useMemo).
  useEffect(() => {
    ctx.records.set(`shadow.${caseData.id}.bestScore`, result.score, 'max');
    if (ending.quality === 'truth') ctx.records.set(`shadow.${caseData.id}.solved`, 1, 'max');
    ctx.achievements.unlock('shadow.archive_first');
    if (ending.quality === 'truth') ctx.achievements.unlock('shadow.archive_truth');
    if (result.rank === 'S') ctx.achievements.unlock('shadow.archive_rank_s');
    void ctx.save.save(ctx.slot, state, `${caseData.title} · ${ending.title} (${result.rank})`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="absolute inset-0 z-20 grid place-items-center overflow-y-auto bg-bg/85 p-6 backdrop-blur">
      <div className="w-full max-w-lg space-y-5">
        <motion.div className="scanlines panel p-8 text-center" initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <p className="label-mono">{ending.title}</p>
          <p className={cx('my-2 font-display text-7xl font-bold neon-text', RANK_TONE[result.rank])}>{result.rank}</p>
          <p className="font-mono text-sm text-muted">{result.score} / 100 очков</p>
          <div className="mx-auto mt-5 grid max-w-sm grid-cols-1 gap-1.5 text-left text-xs">
            <Metric ok={result.decisiveLieCorrect} label="Решающая ложь уличена" />
            <Metric ok={result.contradictionsNoticed === result.contradictionsTotal} label={`Противоречия ${result.contradictionsNoticed}/${result.contradictionsTotal}`} />
            <Metric ok={result.sealsOpened === result.sealsTotal} label={`Печати вскрыты ${result.sealsOpened}/${result.sealsTotal}`} />
          </div>
        </motion.div>

        <div className="panel p-6">
          {ending.epilogue.map((line, i) => (
            <p key={i} className="text-sm leading-relaxed text-ink/85">{line}</p>
          ))}
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          <Button variant="ghost" onClick={onReplay}>Пройти заново</Button>
          <Button onClick={() => ctx.exit()}>На портал</Button>
        </div>
      </div>
    </div>
  );
}

function Metric({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-edge/50 bg-bg-2/50 px-3 py-2">
      <span className={ok ? 'text-good' : 'text-bad'}>{ok ? '✓' : '✕'}</span>
      <span className="text-ink/80">{label}</span>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/games/shadow-trace/archive-ui/components/AccusationModal.tsx src/games/shadow-trace/archive-ui/components/EndingScreen.tsx
git commit -m "feat(shadow-trace): archive A1a — accusation modal + ending screen"
```

---

### Task 9: `ArchiveTerminal` + `ArchiveGame` + module wiring

**Files:**
- Create: `src/games/shadow-trace/archive-ui/components/ArchiveTerminal.tsx`
- Create: `src/games/shadow-trace/archive-ui/ArchiveGame.tsx`
- Modify: `src/games/shadow-trace/ShadowTraceGameModule.tsx`
- Modify: `src/games/shadow-trace/definition.ts`

**Interfaces:**
- Consumes: all components above; `useArchiveGame` (Task 4); `ArchiveCaseManager`, `DEFAULT_ARCHIVE_CASE_ID` (Task 2); `createArchiveProgress` (A0); `usePageTheme` (`@/ui/hooks/usePageTheme`); `GameContext`, `GameModule`, `GameInstance`.
- Produces: `ArchiveTerminal({ caseData, state, dispatch, onAccuse })`, `ArchiveGame({ ctx })`, updated `shadowTraceModule`.

- [ ] **Step 1: Implement `ArchiveTerminal`** (owns ephemeral nav state)

```tsx
// src/games/shadow-trace/archive-ui/components/ArchiveTerminal.tsx
import { useCallback, useState } from 'react';
import type { CaseArchive, ArchiveProgress } from '../../archive';
import type { ArchiveAction } from '../archiveReducer';
import { IndexPane } from './IndexPane';
import { ReaderPane, type ArchiveView } from './ReaderPane';
import { CaseFilePane } from './CaseFilePane';

export function ArchiveTerminal({
  caseData,
  state,
  dispatch,
  onAccuse,
}: {
  caseData: CaseArchive;
  state: ArchiveProgress;
  dispatch: (a: ArchiveAction) => void;
  onAccuse: () => void;
}) {
  const [history, setHistory] = useState<ArchiveView[]>([]);
  const view = history[history.length - 1] ?? null;

  const push = useCallback((v: ArchiveView) => setHistory((h) => [...h, v]), []);
  const openRecord = useCallback(
    (id: string) => {
      dispatch({ type: 'open', recordId: id });
      push({ kind: 'record', id });
    },
    [dispatch, push],
  );
  const openEntity = useCallback((id: string) => push({ kind: 'entity', id }), [push]);
  const back = useCallback(() => setHistory((h) => h.slice(0, -1)), []);

  return (
    <div className="absolute inset-0 z-10 flex flex-col px-4 pb-4 pt-[4.5rem] md:px-6">
      <header className="mb-3 flex items-center gap-3">
        <h1 className="font-display text-xl font-bold text-ink neon-text">{caseData.title}</h1>
        <span className="chip">архив дела</span>
      </header>
      <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-[230px_1fr_270px]">
        <IndexPane caseData={caseData} state={state} onOpenRecord={openRecord} onOpenEntity={openEntity} />
        <ReaderPane
          caseData={caseData}
          state={state}
          view={view}
          canBack={history.length > 1}
          onBack={back}
          onOpenRecord={openRecord}
          onOpenEntity={openEntity}
          dispatch={dispatch}
        />
        <CaseFilePane
          caseData={caseData}
          state={state}
          onOpenRecord={openRecord}
          onOpenEntity={openEntity}
          dispatch={dispatch}
          onAccuse={onAccuse}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement `ArchiveGame`**

```tsx
// src/games/shadow-trace/archive-ui/ArchiveGame.tsx
import { useEffect, useState } from 'react';
import type { GameContext } from '@/types/game-module';
import { usePageTheme } from '@/ui/hooks/usePageTheme';
import type { CaseArchive, ArchiveProgress } from '../archive';
import { createArchiveProgress } from '../archive';
import { ArchiveCaseManager, DEFAULT_ARCHIVE_CASE_ID } from './ArchiveCaseManager';
import { useArchiveGame } from './useArchiveGame';
import { ArchiveTerminal } from './components/ArchiveTerminal';
import { AccusationModal } from './components/AccusationModal';
import { EndingScreen } from './components/EndingScreen';

export function ArchiveGame({ ctx }: { ctx: GameContext }) {
  usePageTheme('shadow');
  const caseId = ctx.params.case || DEFAULT_ARCHIVE_CASE_ID;
  const [caseData, setCaseData] = useState<CaseArchive | null>(null);
  const [initial, setInitial] = useState<ArchiveProgress | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const data = await ArchiveCaseManager.load(caseId);
      let progress = createArchiveProgress(data);
      if (ctx.mode === 'load') {
        const saved = (await ctx.save.load(ctx.slot)) as ArchiveProgress | null;
        if (saved && saved.caseId === data.id) progress = saved;
      }
      if (!alive) return;
      setCaseData(data);
      setInitial(progress);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  if (!caseData || !initial) return null; // LoadingScreen shown by GameCanvasWrapper

  return <ArchiveGameInner ctx={ctx} caseData={caseData} initial={initial} />;
}

function ArchiveGameInner({
  ctx,
  caseData,
  initial,
}: {
  ctx: GameContext;
  caseData: CaseArchive;
  initial: ArchiveProgress;
}) {
  const { state, dispatch } = useArchiveGame(caseData, initial, ctx);
  const [accuseOpen, setAccuseOpen] = useState(false);
  const [ended, setEnded] = useState(Boolean(initial.accusation));

  if (ended) {
    return (
      <EndingScreen
        caseData={caseData}
        state={state}
        ctx={ctx}
        onReplay={() => {
          dispatch({ type: 'reset', progress: createArchiveProgress(caseData) });
          setEnded(false);
        }}
      />
    );
  }

  return (
    <>
      <ArchiveTerminal caseData={caseData} state={state} dispatch={dispatch} onAccuse={() => setAccuseOpen(true)} />
      <AccusationModal
        open={accuseOpen}
        caseData={caseData}
        state={state}
        onClose={() => setAccuseOpen(false)}
        onSubmit={(accusation) => {
          dispatch({ type: 'accuse', accusation });
          setAccuseOpen(false);
          setEnded(true);
        }}
      />
    </>
  );
}
```

- [ ] **Step 3: Rewrite `ShadowTraceGameModule.tsx`**

```tsx
// src/games/shadow-trace/ShadowTraceGameModule.tsx
import type { GameContext, GameInstance, GameModule } from '@/types/game-module';
import { SHADOW_TRACE_DEFINITION } from './definition';
import { ArchiveGame } from './archive-ui/ArchiveGame';

/**
 * Shadow Trace is a pure-React archive-investigation game: no Phaser canvas,
 * so mount() is a no-op and the whole experience lives in the HUD overlay.
 */
export const shadowTraceModule: GameModule = {
  definition: SHADOW_TRACE_DEFINITION,
  payloadVersion: 2,

  async mount(_container: HTMLElement, _ctx: GameContext): Promise<GameInstance> {
    return { pause() {}, resume() {}, destroy() {} };
  },

  Hud: ({ ctx }) => <ArchiveGame ctx={ctx} />,
};
```

- [ ] **Step 4: Refresh `definition.ts`** copy (keep `id`/`theme`)

```ts
// src/games/shadow-trace/definition.ts
import type { GameDefinition } from '@/types/game-module';

export const SHADOW_TRACE_DEFINITION: GameDefinition = {
  id: 'shadow-trace',
  title: 'Shadow Trace',
  tagline: 'Ройся в архиве. Иди по нитке. Уличи во лжи.',
  description:
    'Архив-расследование: открывай записи дела, иди по кликабельным сущностям, ' +
    'вскрывай запечатанные файлы и лови подозреваемых на нестыковках. ' +
    'В финале назови виновного и предъяви решающую ложь. Все данные вымышлены.',
  theme: 'shadow',
  status: 'available',
  tags: ['detective', 'archive', 'investigation'],
  bootHint: 'Открываем материалы дела…',
};
```

- [ ] **Step 5: Typecheck + build**

Run: `npm run typecheck`
Expected: clean.

Run: `npm run build`
Expected: build succeeds (Vite bundles the new module via the existing lazy import in `src/games/index.ts` — no registry change needed; `shadow-trace` already points at `ShadowTraceGameModule`).

- [ ] **Step 6: Commit**

```bash
git add src/games/shadow-trace/archive-ui/components/ArchiveTerminal.tsx src/games/shadow-trace/archive-ui/ArchiveGame.tsx src/games/shadow-trace/ShadowTraceGameModule.tsx src/games/shadow-trace/definition.ts
git commit -m "feat(shadow-trace): archive A1a — terminal shell, orchestrator, module wiring"
```

---

### Task 10: App run-through + retire v1

**Files:**
- Delete: `src/games/shadow-trace/ui/` (ShadowTraceGame.tsx, ConnectionBoard.tsx, FakeTerminal.tsx), `src/games/shadow-trace/systems/CaseManager.ts`, `src/games/shadow-trace/systems/ScoringSystem.ts`, `src/games/shadow-trace/domain/`, `public/data/cases/`.

**Interfaces:** none (verification + cleanup).

- [ ] **Step 1: Run the app and walk the case**

Run: `npm run dev` (note the localhost URL).
Navigate to the portal, launch **Shadow Trace** (`/play/shadow-trace?new=1`). Verify the full solve:
1. The Archive Terminal shows: Index (Лица/Места/Время/События with Эрон, Мара, офис…), an empty Reader with the hint, and an empty Досье.
2. Open **Допрос Эрона** (records list) → its text renders with clickable entities; pin it (📌).
3. Open **Кадр CCTV** → media placeholder shows `⏱ 21:30 · 📡 CCTV-3` + the clock hotspot label; click the **Кат** entity → her card → open **Переписка с администратором** → the **Журнал доступа** unseals (🔒 disappears in the index).
4. Open **Журнал доступа** → pin it. Both pinned records appear in Досье.
5. Click **Заключение** → pick **Эрон** + the two facts «Запись: Допрос Эрона» and «Журнал доступа СКУД · время: 21:28» → **Предъявить**.
6. Ending screen shows **Истина установлена**, rank **S**, 100/100, all metrics ✓.

Take screenshots of: the terminal, an opened record with the media placeholder, the accusation modal, the ending screen. If any step misbehaves, fix the responsible component and re-verify before continuing.

- [ ] **Step 2: Verify no console errors**

In the browser devtools console during the run-through: expect no errors or React warnings.

- [ ] **Step 3: Retire the v1 files**

```bash
git rm -r src/games/shadow-trace/ui src/games/shadow-trace/domain src/games/shadow-trace/systems public/data/cases
```

(The old `src/games/shadow-trace/engine/` A0-superseded module is also dead, but it is retired together with this cleanup ONLY if nothing imports it — confirm with `grep -rn "shadow-trace/engine" src tests`. If the A0 archive tests or anything still reference `engine/`, leave it; otherwise `git rm -r src/games/shadow-trace/engine`.)

- [ ] **Step 4: Re-verify the build is green after deletion**

Run: `npm run typecheck`
Expected: clean (nothing references the deleted v1 files).

Run: `npm run build`
Expected: succeeds.

Run: `npm run test`
Expected: all tests pass (the deleted v1 had no tests of its own that we keep; archive tests stay green).

- [ ] **Step 5: Commit**

```bash
git add -A src/games/shadow-trace public/data
git commit -m "chore(shadow-trace): retire v1 playthrough (replaced by archive A1a)"
```

(Here `git add -A` is scoped to `src/games/shadow-trace` and `public/data` paths only — the deletions — NOT a bare `git add -A`.)

---

## Self-Review

**Spec coverage** (against `2026-06-18-shadow-trace-archive-a1-ui-design.md`):
- §2 module/wiring (`ShadowTraceGameModule`→`ArchiveGame`, `useArchiveGame`, `ArchiveCaseManager`, registration unchanged) → Tasks 2, 4, 9.
- §3 three-pane terminal (Index/Reader/CaseFile, EntityLink, RecordView, EntityCard, breadcrumb/back, ephemeral nav) → Tasks 5, 6, 7, 9.
- §4 flows (thread navigation; seal unlock via openRecord/grantKey; pins/suspicions/notes; accusation fact-model with `getSelectableFacts`; ending + rank + achievements/records) → Tasks 1, 6, 7, 8, 9.
- §5 media: A1a placeholder (`MediaPlaceholder`) → Task 6; full `MediaRenderer` is A1b (separate plan, out of scope here).
- §6 data/persistence (JSON case + validating loader; save `ArchiveProgress` directly; payloadVersion 2; restore on caseId match) → Tasks 2, 4, 8, 9.
- §8 verification (vitest for pure logic; run-the-app for UI; typecheck/build gates) → Tasks 1–3 vitest, 5–9 typecheck/build, 10 run-through.
- §9 retire v1 → Task 10.

**Placeholder scan:** none — every step has complete code/commands.

**Type consistency:** `ArchiveAction` (Task 3) is consumed identically in Tasks 4–9. `ArchiveView` (Task 6) is consumed in Task 9. `getSelectableFacts`/`SelectableFact` (Task 1) consumed in Task 8. Component prop shapes match between definition and call sites (`onOpenRecord`/`onOpenEntity`/`dispatch`/`onAccuse`/`onSubmit`). Save payload is `ArchiveProgress` everywhere (autosave in Task 4, final save in Task 8, restore in Task 9). `payloadVersion: 2` set in Task 9. The case JSON's contradictions use `{kind:'record'}`/`{kind:'metadata'}` granularity that exactly matches what `getSelectableFacts` emits and what the run-through selects in Task 10.

**Note on a tested assumption:** Task 2 imports the case `.json` in a vitest test, which requires `resolveJsonModule` (Step 3 handles enabling it if absent). The run-through (Task 10) is the authoritative end-to-end check, since the React layer has no automated test env.
