# Зеркальная Ложа — Этап 2 (реалтайм-неткод) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a transport-agnostic, host-authoritative networking layer so two players can join a room by code and co-op-solve a lodge run in real time — fully unit-tested over an in-memory transport, with BroadcastChannel (cross-tab) and Supabase Realtime adapters for actual play.

**Architecture:** A `Transport` interface abstracts the wire. A `LodgeSession` (host or guest) owns ordering: the host assigns `seq`, applies via `applyEvent`, and broadcasts canonical `event`s; guests submit intents and apply the host's ordered stream. State stays the engine's; order stays the host's; `hashState` + `seq` gaps drive resync, snapshots drive reconnect. The session talks to the Этап-1 store through two new methods (`applyServerEvent`/`setRunState`); stations call `session.submit` instead of the local `dispatch`.

**Tech Stack:** TypeScript strict, Vitest, Zustand (present), React 18. New: `@supabase/supabase-js` (for the Supabase adapter only).

## Global Constraints

- **Transport-agnostic core:** `session.ts` and the protocol depend only on the `Transport` interface — never on BroadcastChannel/Supabase directly. The in-memory hub is the test substrate.
- **Engine = state, host = order:** the UI/session never re-implement puzzle rules; all state transitions go through the engine's `applyEvent`; the single canonical order is the host's `seq`.
- **`send` delivers to OTHER peers only** (matches Supabase `broadcast { self: false }`): the host self-applies its own authoritative `event` and broadcasts it to guests.
- **Anonymous identity:** ephemeral `clientId` + display name; no auth. Roles are `host = 'A'`, `guest = 'B'`.
- **Isolation:** no portal `GameId`/`GameTheme`/`GameRegistry`/catalog changes. Net code is reached only via the DEV-only `/dev/lodge` harness. The Этап-1 single-player harness keeps working.
- **Tests:** Vitest, `tests/lodge-*.test.ts`, `@/` alias. The in-memory transport + session core are unit-tested; BroadcastChannel/Supabase adapters and the lobby/net UI are NOT unit-tested (verified by a cross-tab smoke + delegated Supabase live-check).
- **No engine file gains React/DOM/network imports.** Determinism: no `Math.random()`/`Date.now()` in the engine; in transports/UI they are acceptable (room codes, heartbeats, ids).
- **TypeScript strict** (incl. `noFallthroughCasesInSwitch`). Typecheck: `npm run typecheck`.
- **Commits:** Conventional Commits, scope `lodge`; each ends with a second `-m` paragraph: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## File Structure

- `src/games/lodge/net/types.ts` — `Transport`, `NetMessage`, `PeerInfo`.
- `src/games/lodge/net/roomCode.ts` — `makeRoomCode`/`isValidRoomCode`.
- `src/games/lodge/net/transports/inMemory.ts` — `InMemoryHub` + `InMemoryTransport` (test substrate).
- `src/games/lodge/net/session.ts` — `LodgeSession` (host authority + guest apply + resync/snapshot).
- `src/games/lodge/net/transports/broadcastChannel.ts` — cross-tab adapter.
- `src/games/lodge/net/transports/supabase.ts` — Supabase Realtime adapter (new dep).
- `src/games/lodge/net/index.ts` — barrel.
- `src/games/lodge/ui/store/useLodgeStore.ts` — **modify**: add `applyServerEvent`/`setRunState`.
- `src/games/lodge/ui/ClueCard.tsx` — read-only clue view for clue-owner puzzles.
- `src/games/lodge/dev/LobbyScreen.tsx` — name + create/join + ready.
- `src/games/lodge/dev/NetGameView.tsx` — role-filtered 3D stations (via `session.submit`) + clue cards + HUD.
- `src/games/lodge/dev/LodgeDevEntry.tsx` — **default export**: menu (Solo → Этап-1 harness; Multiplayer → lobby → net view).
- `src/app/router.tsx` — **modify**: point `/dev/lodge` at `LodgeDevEntry`.
- `vite.config.ts` — **modify**: add `supabase` manualChunk.
- Tests: `tests/lodge-roomcode.test.ts`, `tests/lodge-transport.test.ts`, `tests/lodge-store-net.test.ts`, `tests/lodge-session.test.ts`.

---

## Task 1: Net protocol types + room codes

**Files:**
- Create: `src/games/lodge/net/types.ts`, `src/games/lodge/net/roomCode.ts`
- Test: `tests/lodge-roomcode.test.ts`

**Interfaces:**
- Consumes: engine types `RunState`/`Difficulty`/`Role`/`PuzzleEvent`/`LodgeEvent`.
- Produces: `Transport`, `NetMessage`, `PeerInfo`; `makeRoomCode(rng: () => number, len?: number): string`, `isValidRoomCode(code: string): boolean`, `ROOM_CODE_ALPHABET`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/lodge-roomcode.test.ts
import { describe, expect, it } from 'vitest';
import { makeRoomCode, isValidRoomCode, ROOM_CODE_ALPHABET } from '@/games/lodge/net/roomCode';
import { makeRng } from '@/games/lodge/engine';

describe('roomCode', () => {
  it('makeRoomCode is deterministic for a given rng and valid', () => {
    const a = makeRoomCode(makeRng(7));
    const b = makeRoomCode(makeRng(7));
    expect(a).toBe(b);
    expect(a).toHaveLength(6);
    expect(isValidRoomCode(a)).toBe(true);
    expect([...a].every((c) => ROOM_CODE_ALPHABET.includes(c))).toBe(true);
  });

  it('isValidRoomCode rejects wrong length, lowercase, and ambiguous chars', () => {
    expect(isValidRoomCode('ABC')).toBe(false);
    expect(isValidRoomCode('abcdef')).toBe(false);
    expect(isValidRoomCode('ABCDE0')).toBe(false); // 0 is not in the alphabet
    expect(isValidRoomCode('ABCDEF')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lodge-roomcode.test.ts`
Expected: FAIL — cannot resolve `@/games/lodge/net/roomCode`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/games/lodge/net/types.ts
import type { RunState, Difficulty, Role, PuzzleEvent, LodgeEvent } from '@/games/lodge/engine';

export interface PeerInfo {
  id: string;
  name: string;
}

export type NetMessage =
  | { t: 'hello'; from: string; name: string }
  | { t: 'room'; seed: number; difficulty: Difficulty; roles: Record<string, Role>; hostId: string }
  | { t: 'intent'; from: string; puzzleId: string; event: PuzzleEvent }
  | { t: 'event'; lodgeEvent: LodgeEvent; stateHash: number }
  | { t: 'snapshot'; to: string; runState: RunState; lastSeq: number }
  | { t: 'resync'; from: string };

export interface Transport {
  selfId: string;
  connect(): Promise<void>;
  disconnect(): void;
  send(msg: NetMessage): void;
  onMessage(cb: (m: NetMessage) => void): () => void;
  onPresence(cb: (peers: PeerInfo[]) => void): () => void;
}
```

```ts
// src/games/lodge/net/roomCode.ts
// Crockford-ish: no 0/O/1/I to avoid read-aloud ambiguity over voice.
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function makeRoomCode(rng: () => number, len = 6): string {
  let out = '';
  for (let i = 0; i < len; i++) {
    out += ROOM_CODE_ALPHABET[Math.floor(rng() * ROOM_CODE_ALPHABET.length)];
  }
  return out;
}

export function isValidRoomCode(code: string): boolean {
  return (
    typeof code === 'string' &&
    code.length === 6 &&
    [...code].every((c) => ROOM_CODE_ALPHABET.includes(c))
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lodge-roomcode.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/games/lodge/net/types.ts src/games/lodge/net/roomCode.ts tests/lodge-roomcode.test.ts
git commit -m "feat(lodge): net protocol types + room codes" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: In-memory transport (test substrate)

**Files:**
- Create: `src/games/lodge/net/transports/inMemory.ts`
- Test: `tests/lodge-transport.test.ts`

**Interfaces:**
- Consumes: `Transport`, `NetMessage`, `PeerInfo` from `../types`.
- Produces: `InMemoryHub` (with `register`, `connect`, `disconnect`, `send`, `injectTo`) and `InMemoryTransport implements Transport`. `send` delivers to all connected members except the sender; presence emits the connected member list on connect/disconnect.

- [ ] **Step 1: Write the failing test**

```ts
// tests/lodge-transport.test.ts
import { describe, expect, it } from 'vitest';
import { InMemoryHub, InMemoryTransport } from '@/games/lodge/net/transports/inMemory';
import type { NetMessage, PeerInfo } from '@/games/lodge/net/types';

describe('InMemoryTransport', () => {
  it('delivers messages to other peers but not the sender, and tracks presence', async () => {
    const hub = new InMemoryHub();
    const a = new InMemoryTransport('a', 'Alice', hub);
    const b = new InMemoryTransport('b', 'Bob', hub);

    const aGot: NetMessage[] = [];
    const bGot: NetMessage[] = [];
    let bPeers: PeerInfo[] = [];
    a.onMessage((m) => aGot.push(m));
    b.onMessage((m) => bGot.push(m));
    b.onPresence((p) => { bPeers = p; });

    await a.connect();
    await b.connect();
    expect(bPeers.map((p) => p.id).sort()).toEqual(['a', 'b']);

    a.send({ t: 'resync', from: 'a' });
    expect(bGot).toHaveLength(1);
    expect(aGot).toHaveLength(0); // sender does not receive its own message
  });

  it('injectTo delivers a crafted message to a single peer', async () => {
    const hub = new InMemoryHub();
    const a = new InMemoryTransport('a', 'A', hub);
    await a.connect();
    const got: NetMessage[] = [];
    a.onMessage((m) => got.push(m));
    hub.injectTo('a', { t: 'resync', from: 'x' });
    expect(got).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lodge-transport.test.ts`
Expected: FAIL — cannot resolve the module.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/games/lodge/net/transports/inMemory.ts
import type { Transport, NetMessage, PeerInfo } from '../types';

interface Member {
  info: PeerInfo;
  onMsg: ((m: NetMessage) => void)[];
  onPres: ((p: PeerInfo[]) => void)[];
  connected: boolean;
}

export class InMemoryHub {
  private members = new Map<string, Member>();

  register(id: string, name: string): Member {
    const existing = this.members.get(id);
    if (existing) {
      existing.info = { id, name };
      return existing;
    }
    const m: Member = { info: { id, name }, onMsg: [], onPres: [], connected: false };
    this.members.set(id, m);
    return m;
  }

  connect(id: string): void {
    const m = this.members.get(id);
    if (m) {
      m.connected = true;
      this.emitPresence();
    }
  }

  disconnect(id: string): void {
    const m = this.members.get(id);
    if (m) {
      m.connected = false;
      this.emitPresence();
    }
  }

  send(from: string, msg: NetMessage): void {
    for (const [id, m] of this.members) {
      if (id !== from && m.connected) for (const cb of [...m.onMsg]) cb(msg);
    }
  }

  injectTo(id: string, msg: NetMessage): void {
    const m = this.members.get(id);
    if (m && m.connected) for (const cb of [...m.onMsg]) cb(msg);
  }

  private emitPresence(): void {
    const list = [...this.members.values()].filter((m) => m.connected).map((m) => m.info);
    for (const m of this.members.values()) {
      if (m.connected) for (const cb of [...m.onPres]) cb(list);
    }
  }
}

export class InMemoryTransport implements Transport {
  private member: Member;

  constructor(public selfId: string, name: string, private hub: InMemoryHub) {
    this.member = hub.register(selfId, name);
  }

  async connect(): Promise<void> {
    this.hub.connect(this.selfId);
  }

  disconnect(): void {
    this.hub.disconnect(this.selfId);
  }

  send(msg: NetMessage): void {
    this.hub.send(this.selfId, msg);
  }

  onMessage(cb: (m: NetMessage) => void): () => void {
    this.member.onMsg.push(cb);
    return () => {
      this.member.onMsg = this.member.onMsg.filter((f) => f !== cb);
    };
  }

  onPresence(cb: (p: PeerInfo[]) => void): () => void {
    this.member.onPres.push(cb);
    return () => {
      this.member.onPres = this.member.onPres.filter((f) => f !== cb);
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lodge-transport.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/games/lodge/net/transports/inMemory.ts tests/lodge-transport.test.ts
git commit -m "feat(lodge): in-memory transport hub for net tests" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Store seam — applyServerEvent + setRunState

**Files:**
- Modify: `src/games/lodge/ui/store/useLodgeStore.ts`
- Test: `tests/lodge-store-net.test.ts`

**Interfaces:**
- Consumes: engine `applyEvent`; type `LodgeEvent`.
- Produces (added to `LodgeStore`): `applyServerEvent(lodgeEvent: LodgeEvent): void` (applies a host-ordered event verbatim), `setRunState(runState: RunState): void` (replaces state, re-selects first puzzle). Existing fields/actions unchanged.

- [ ] **Step 1: Write the failing test**

```ts
// tests/lodge-store-net.test.ts
import { describe, expect, it, beforeEach } from 'vitest';
import { useLodgeStore } from '@/games/lodge/ui/store/useLodgeStore';
import { createRun, initRunState } from '@/games/lodge/engine';

beforeEach(() => useLodgeStore.getState().regenerate(5, 'standard'));

describe('store net seam', () => {
  it('applyServerEvent applies a host-ordered event and advances seq', () => {
    const before = useLodgeStore.getState().runState.seq;
    useLodgeStore.getState().applyServerEvent({ seq: before + 1, puzzleId: 'p0', by: 'A', event: { type: 'dial.clear' } });
    expect(useLodgeStore.getState().runState.seq).toBe(before + 1);
  });

  it('setRunState replaces state and selects the first puzzle', () => {
    const fresh = initRunState(createRun(999, { difficulty: 'gentle' }));
    useLodgeStore.getState().setRunState(fresh);
    expect(useLodgeStore.getState().runState.run.seed).toBe(999);
    expect(useLodgeStore.getState().selectedPuzzleId).toBe('p0');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lodge-store-net.test.ts`
Expected: FAIL — `applyServerEvent`/`setRunState` are not functions.

- [ ] **Step 3: Write minimal implementation**

Edit `src/games/lodge/ui/store/useLodgeStore.ts`. Add `LodgeEvent` to the engine import:

```ts
import {
  createRun,
  initRunState,
  applyEvent,
  ARCHETYPES,
  type RunState,
  type Difficulty,
  type Role,
  type PuzzleEvent,
  type LodgeEvent,
} from '@/games/lodge/engine';
```

Add the two methods to the `LodgeStore` interface (after `autoSolve`):

```ts
  applyServerEvent: (lodgeEvent: LodgeEvent) => void;
  setRunState: (runState: RunState) => void;
```

Add the two implementations inside `create(...)` (after the `autoSolve` block):

```ts
  applyServerEvent(lodgeEvent) {
    const { runState } = get();
    set({ runState: applyEvent(runState, lodgeEvent) });
  },

  setRunState(runState) {
    set({ runState, selectedPuzzleId: runState.run.puzzles[0]?.id ?? null });
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lodge-store-net.test.ts`
Expected: PASS (2 tests).

Run: `npx vitest run tests/lodge-store.test.ts`
Expected: PASS (the Этап-1 store tests still pass — change is additive).

- [ ] **Step 5: Commit**

```bash
git add src/games/lodge/ui/store/useLodgeStore.ts tests/lodge-store-net.test.ts
git commit -m "feat(lodge): store seam for networked events (applyServerEvent/setRunState)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: LodgeSession — host authority, apply, resync, snapshot

**Files:**
- Create: `src/games/lodge/net/session.ts`, `src/games/lodge/net/index.ts`
- Test: `tests/lodge-session.test.ts`

**Interfaces:**
- Consumes: engine `createRun`/`initRunState`/`applyEvent`/`hashState`/`ARCHETYPES` + types; `Transport`/`NetMessage`/`PeerInfo`; `InMemoryHub`/`InMemoryTransport` (test).
- Produces: `interface SessionCallbacks { applyServerEvent; setRunState; getRunState; onRoom?; onPeers?; onHostLeft? }`; `interface SessionOptions { name; isHost }`; `class LodgeSession` with `start()`, `dispose()`, `startRun(seed, difficulty, guestId)`, `submit(puzzleId, event)`, and public readonly-ish `role`/`isHost`/`hostId`. `net/index.ts` re-exports types, roomCode, inMemory, session.

- [ ] **Step 1: Write the failing test**

```ts
// tests/lodge-session.test.ts
import { describe, expect, it } from 'vitest';
import { applyEvent, hashState, ARCHETYPES, type RunState, type LodgeEvent } from '@/games/lodge/engine';
import { InMemoryHub, InMemoryTransport } from '@/games/lodge/net/transports/inMemory';
import { LodgeSession, type SessionCallbacks } from '@/games/lodge/net/session';

function makeNode(hub: InMemoryHub, id: string, name: string, isHost: boolean) {
  let rs: RunState | null = null;
  const cb: SessionCallbacks = {
    applyServerEvent: (e: LodgeEvent) => { rs = applyEvent(rs!, e); },
    setRunState: (next: RunState) => { rs = next; },
    getRunState: () => rs,
  };
  const transport = new InMemoryTransport(id, name, hub);
  const session = new LodgeSession(transport, { name, isHost }, cb);
  return { session, transport, getRs: () => rs };
}

async function startedPair() {
  const hub = new InMemoryHub();
  const host = makeNode(hub, 'h', 'Host', true);
  const guest = makeNode(hub, 'g', 'Guest', false);
  await host.session.start();
  await guest.session.start();
  host.session.startRun(2026, 'standard', 'g');
  return { hub, host, guest };
}

function solveAll(host: ReturnType<typeof makeNode>, guest: ReturnType<typeof makeNode>) {
  const run = host.getRs()!.run;
  for (const p of run.puzzles) {
    const side = p.lockOwner === 'A' ? host : guest;
    const live = side.getRs()!.run.puzzles.find((x) => x.id === p.id)!;
    for (const ev of ARCHETYPES[p.archetypeId].solutionEvents(live)) side.session.submit(p.id, ev);
  }
}

describe('LodgeSession', () => {
  it('assigns roles host=A guest=B and builds an identical run', async () => {
    const { host, guest } = await startedPair();
    expect(host.session.role).toBe('A');
    expect(guest.session.role).toBe('B');
    expect(hashState(host.getRs()!)).toBe(hashState(guest.getRs()!));
  });

  it('converges to escaped through host authority from both sides', async () => {
    const { host, guest } = await startedPair();
    solveAll(host, guest);
    expect(hashState(host.getRs()!)).toBe(hashState(guest.getRs()!));
    expect(host.getRs()!.escaped).toBe(true);
    expect(guest.getRs()!.escaped).toBe(true);
  });

  it('a returning guest (hello after start) gets room+snapshot and catches up', async () => {
    const { hub, host, guest } = await startedPair();
    // guest leaves; host advances a host-owned puzzle
    guest.session.dispose();
    const hostPuzzle = host.getRs()!.run.puzzles.find((p) => p.lockOwner === 'A')!;
    for (const ev of ARCHETYPES[hostPuzzle.archetypeId].solutionEvents(hostPuzzle)) {
      host.session.submit(hostPuzzle.id, ev);
    }
    // guest rejoins fresh
    const guest2 = makeNode(hub, 'g', 'Guest', false);
    await guest2.session.start();
    expect(hashState(guest2.getRs()!)).toBe(hashState(host.getRs()!));
  });

  it('a seq gap makes the guest request resync and recover via snapshot', async () => {
    const { hub, host, guest } = await startedPair();
    // inject an out-of-order event to the guest (seq jumps past lastSeq+1)
    hub.injectTo('g', { t: 'event', lodgeEvent: { seq: 5, puzzleId: 'p0', by: 'A', event: { type: 'dial.clear' } }, stateHash: 0 });
    // guest should have requested resync; host answers with a snapshot → convergence
    expect(hashState(guest.getRs()!)).toBe(hashState(host.getRs()!));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lodge-session.test.ts`
Expected: FAIL — cannot resolve `@/games/lodge/net/session`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/games/lodge/net/session.ts
import { createRun, initRunState, hashState } from '@/games/lodge/engine';
import type { RunState, Difficulty, Role, PuzzleEvent, LodgeEvent } from '@/games/lodge/engine';
import type { Transport, NetMessage, PeerInfo } from './types';

export interface SessionCallbacks {
  applyServerEvent: (e: LodgeEvent) => void;
  setRunState: (rs: RunState) => void;
  getRunState: () => RunState | null;
  onRoom?: (role: Role | null) => void;
  onPeers?: (peers: PeerInfo[]) => void;
  onHostLeft?: () => void;
}

export interface SessionOptions {
  name: string;
  isHost: boolean;
}

export class LodgeSession {
  role: Role | null = null;
  isHost: boolean;
  hostId: string | null = null;

  private roles: Record<string, Role> = {};
  private started = false;
  private seqCounter = 0;
  private lastSeq = 0;
  private offMessage: (() => void) | null = null;
  private offPresence: (() => void) | null = null;

  constructor(
    private transport: Transport,
    private opts: SessionOptions,
    private cb: SessionCallbacks,
  ) {
    this.isHost = opts.isHost;
  }

  async start(): Promise<void> {
    this.offMessage = this.transport.onMessage((m) => this.onMessage(m));
    this.offPresence = this.transport.onPresence((peers) => this.onPresence(peers));
    await this.transport.connect();
    if (this.isHost) this.hostId = this.transport.selfId;
    else this.transport.send({ t: 'hello', from: this.transport.selfId, name: this.opts.name });
  }

  dispose(): void {
    this.offMessage?.();
    this.offPresence?.();
    this.transport.disconnect();
  }

  startRun(seed: number, difficulty: Difficulty, guestId: string): void {
    if (!this.isHost) return;
    const roles: Record<string, Role> = { [this.transport.selfId]: 'A', [guestId]: 'B' };
    const room: NetMessage = { t: 'room', seed, difficulty, roles, hostId: this.transport.selfId };
    this.applyRoom(room);
    this.transport.send(room);
  }

  submit(puzzleId: string, event: PuzzleEvent): void {
    if (this.isHost) this.authorize(this.transport.selfId, puzzleId, event);
    else this.transport.send({ t: 'intent', from: this.transport.selfId, puzzleId, event });
  }

  private authorize(from: string, puzzleId: string, event: PuzzleEvent): void {
    const seq = ++this.seqCounter;
    const lodgeEvent: LodgeEvent = { seq, puzzleId, by: this.roles[from] ?? 'A', event };
    this.cb.applyServerEvent(lodgeEvent);
    this.lastSeq = seq;
    const rs = this.cb.getRunState();
    this.transport.send({ t: 'event', lodgeEvent, stateHash: rs ? hashState(rs) : 0 });
  }

  private onMessage(m: NetMessage): void {
    switch (m.t) {
      case 'hello':
        if (this.isHost && this.started) {
          this.transport.send(this.roomMessage());
          this.sendSnapshot(m.from);
        }
        break;
      case 'room':
        if (!this.isHost) this.applyRoom(m);
        break;
      case 'intent':
        if (this.isHost) this.authorize(m.from, m.puzzleId, m.event);
        break;
      case 'event':
        if (!this.isHost) this.receiveEvent(m);
        break;
      case 'snapshot':
        if (m.to === this.transport.selfId) {
          this.cb.setRunState(m.runState);
          this.lastSeq = m.lastSeq;
        }
        break;
      case 'resync':
        if (this.isHost) this.sendSnapshot(m.from);
        break;
      default:
        break;
    }
  }

  private receiveEvent(m: Extract<NetMessage, { t: 'event' }>): void {
    const seq = m.lodgeEvent.seq;
    if (seq <= this.lastSeq) return;
    if (seq > this.lastSeq + 1) {
      this.transport.send({ t: 'resync', from: this.transport.selfId });
      return;
    }
    this.cb.applyServerEvent(m.lodgeEvent);
    this.lastSeq = seq;
    const rs = this.cb.getRunState();
    if (rs && hashState(rs) !== m.stateHash) {
      this.transport.send({ t: 'resync', from: this.transport.selfId });
    }
  }

  private sendSnapshot(to: string): void {
    const rs = this.cb.getRunState();
    if (!rs) return;
    this.transport.send({ t: 'snapshot', to, runState: rs, lastSeq: this.lastSeq });
  }

  private roomMessage(): NetMessage {
    const rs = this.cb.getRunState();
    return {
      t: 'room',
      seed: rs ? rs.run.seed : 0,
      difficulty: rs ? rs.run.difficulty : 'standard',
      roles: this.roles,
      hostId: this.hostId ?? this.transport.selfId,
    };
  }

  private applyRoom(m: Extract<NetMessage, { t: 'room' }>): void {
    this.hostId = m.hostId;
    this.roles = m.roles;
    this.role = m.roles[this.transport.selfId] ?? null;
    this.cb.setRunState(initRunState(createRun(m.seed, { difficulty: m.difficulty })));
    this.lastSeq = 0;
    this.seqCounter = 0;
    this.started = true;
    this.cb.onRoom?.(this.role);
  }

  private onPresence(peers: PeerInfo[]): void {
    if (!this.isHost && this.hostId && !peers.some((p) => p.id === this.hostId)) {
      this.cb.onHostLeft?.();
    }
    this.cb.onPeers?.(peers);
  }
}
```

```ts
// src/games/lodge/net/index.ts
export * from './types';
export { makeRoomCode, isValidRoomCode, ROOM_CODE_ALPHABET } from './roomCode';
export { InMemoryHub, InMemoryTransport } from './transports/inMemory';
export { LodgeSession } from './session';
export type { SessionCallbacks, SessionOptions } from './session';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lodge-session.test.ts`
Expected: PASS (4 tests).

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/games/lodge/net/session.ts src/games/lodge/net/index.ts tests/lodge-session.test.ts
git commit -m "feat(lodge): LodgeSession host authority + resync/snapshot" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: BroadcastChannel transport (cross-tab)

**Files:**
- Create: `src/games/lodge/net/transports/broadcastChannel.ts`

**Interfaces:**
- Consumes: `Transport`/`NetMessage`/`PeerInfo`.
- Produces: `class BroadcastChannelTransport implements Transport`. Uses `BroadcastChannel('lodge:'+code)`; presence via a periodic heartbeat (`__hb` envelope) with a reaper; `send` posts NetMessages to other tabs.

> No unit test (needs a real `BroadcastChannel` + timers). Verified by typecheck + the Task 10 cross-tab smoke.

- [ ] **Step 1: Write the implementation**

```tsx
// src/games/lodge/net/transports/broadcastChannel.ts
import type { Transport, NetMessage, PeerInfo } from '../types';

type Wire = { kind: 'msg'; from: string; msg: NetMessage } | { kind: 'hb'; id: string; name: string };

const HEARTBEAT_MS = 1000;
const STALE_MS = 3500;

export class BroadcastChannelTransport implements Transport {
  private channel: BroadcastChannel | null = null;
  private msgCbs: ((m: NetMessage) => void)[] = [];
  private presCbs: ((p: PeerInfo[]) => void)[] = [];
  private seen = new Map<string, { name: string; at: number }>();
  private hbTimer: ReturnType<typeof setInterval> | null = null;

  constructor(public selfId: string, private name: string, private code: string) {}

  async connect(): Promise<void> {
    this.channel = new BroadcastChannel('lodge:' + this.code);
    this.channel.onmessage = (e: MessageEvent<Wire>) => this.onWire(e.data);
    this.seen.set(this.selfId, { name: this.name, at: Date.now() });
    this.beat();
    this.hbTimer = setInterval(() => this.beat(), HEARTBEAT_MS);
  }

  disconnect(): void {
    if (this.hbTimer) clearInterval(this.hbTimer);
    this.hbTimer = null;
    this.channel?.close();
    this.channel = null;
  }

  send(msg: NetMessage): void {
    this.channel?.postMessage({ kind: 'msg', from: this.selfId, msg } satisfies Wire);
  }

  onMessage(cb: (m: NetMessage) => void): () => void {
    this.msgCbs.push(cb);
    return () => { this.msgCbs = this.msgCbs.filter((f) => f !== cb); };
  }

  onPresence(cb: (p: PeerInfo[]) => void): () => void {
    this.presCbs.push(cb);
    return () => { this.presCbs = this.presCbs.filter((f) => f !== cb); };
  }

  private onWire(w: Wire): void {
    if (w.kind === 'msg') {
      if (w.from === this.selfId) return; // others only
      for (const cb of [...this.msgCbs]) cb(w.msg);
    } else {
      this.seen.set(w.id, { name: w.name, at: Date.now() });
      this.emitPresence();
    }
  }

  private beat(): void {
    this.channel?.postMessage({ kind: 'hb', id: this.selfId, name: this.name } satisfies Wire);
    const now = Date.now();
    let changed = false;
    for (const [id, v] of this.seen) {
      if (id !== this.selfId && now - v.at > STALE_MS) {
        this.seen.delete(id);
        changed = true;
      }
    }
    if (changed) this.emitPresence();
  }

  private emitPresence(): void {
    const list: PeerInfo[] = [...this.seen.entries()].map(([id, v]) => ({ id, name: v.name }));
    for (const cb of [...this.presCbs]) cb(list);
  }
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/games/lodge/net/transports/broadcastChannel.ts
git commit -m "feat(lodge): BroadcastChannel transport for cross-tab play" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Supabase Realtime transport

**Files:**
- Create: `src/games/lodge/net/transports/supabase.ts`
- Modify: `package.json` (dep), `vite.config.ts` (chunk)

**Interfaces:**
- Consumes: `Transport`/`NetMessage`/`PeerInfo`; `createClient` from `@supabase/supabase-js`.
- Produces: `supabaseConfigured(): boolean`, `class SupabaseBroadcastTransport implements Transport`. Reads `import.meta.env.VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`; channel `lodge:<code>` with broadcast (`self: false`) + presence.

> No unit test (thin SDK wrapper). Verified by typecheck; live cross-machine check is delegated to the user's Supabase project.

- [ ] **Step 1: Install the dependency**

Run: `npm install @supabase/supabase-js`
Expected: installs cleanly.

- [ ] **Step 2: Add a `supabase` manualChunk**

In `vite.config.ts`, add to `manualChunks` (alongside `phaser`/`three`/`vendor`):
```ts
          supabase: ['@supabase/supabase-js'],
```

- [ ] **Step 3: Write the implementation**

```ts
// src/games/lodge/net/transports/supabase.ts
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import type { Transport, NetMessage, PeerInfo } from '../types';

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export function supabaseConfigured(): boolean {
  return Boolean(URL && ANON);
}

export class SupabaseBroadcastTransport implements Transport {
  private client: SupabaseClient | null = null;
  private channel: RealtimeChannel | null = null;
  private msgCbs: ((m: NetMessage) => void)[] = [];
  private presCbs: ((p: PeerInfo[]) => void)[] = [];

  constructor(public selfId: string, private name: string, private code: string) {}

  async connect(): Promise<void> {
    if (!URL || !ANON) throw new Error('Supabase env not configured');
    this.client = createClient(URL, ANON, { realtime: { params: { eventsPerSecond: 20 } } });
    const channel = this.client.channel('lodge:' + this.code, {
      config: { broadcast: { self: false }, presence: { key: this.selfId } },
    });
    this.channel = channel;
    channel.on('broadcast', { event: 'msg' }, ({ payload }) => {
      for (const cb of [...this.msgCbs]) cb(payload as NetMessage);
    });
    channel.on('presence', { event: 'sync' }, () => this.emitPresence());
    await new Promise<void>((resolve) => {
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void channel.track({ id: this.selfId, name: this.name });
          resolve();
        }
      });
    });
  }

  disconnect(): void {
    if (this.channel) void this.client?.removeChannel(this.channel);
    this.channel = null;
  }

  send(msg: NetMessage): void {
    void this.channel?.send({ type: 'broadcast', event: 'msg', payload: msg });
  }

  onMessage(cb: (m: NetMessage) => void): () => void {
    this.msgCbs.push(cb);
    return () => { this.msgCbs = this.msgCbs.filter((f) => f !== cb); };
  }

  onPresence(cb: (p: PeerInfo[]) => void): () => void {
    this.presCbs.push(cb);
    return () => { this.presCbs = this.presCbs.filter((f) => f !== cb); };
  }

  private emitPresence(): void {
    const state = this.channel?.presenceState() ?? {};
    const list: PeerInfo[] = [];
    for (const key of Object.keys(state)) {
      const metas = state[key] as Array<{ id?: string; name?: string }>;
      const meta = metas[0] ?? {};
      list.push({ id: meta.id ?? key, name: meta.name ?? 'Игрок' });
    }
    for (const cb of [...this.presCbs]) cb(list);
  }
}
```

- [ ] **Step 4: Verify typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vite.config.ts src/games/lodge/net/transports/supabase.ts
git commit -m "feat(lodge): Supabase Realtime transport adapter" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: ClueCard + LobbyScreen

**Files:**
- Create: `src/games/lodge/ui/ClueCard.tsx`, `src/games/lodge/dev/LobbyScreen.tsx`

**Interfaces:**
- Consumes: `makeRoomCode`/`isValidRoomCode` from net; engine `PuzzleInstance`.
- Produces: `ClueCard({ puzzle })`; `LobbyScreen({ onStart })` (collects name + create/join) and the exported `LobbyResult` type. Neither imports `NetGameView`, so both typecheck standalone.

> DOM/glue — verified by typecheck + the Task 10 smoke.

- [ ] **Step 1: Write ClueCard**

```tsx
// src/games/lodge/ui/ClueCard.tsx
import type { PuzzleInstance } from '@/games/lodge/engine';

export function ClueCard({ puzzle }: { puzzle: PuzzleInstance }) {
  const clue = puzzle.views[puzzle.clueOwner];
  return (
    <div style={{ border: '1px solid #332c44', borderRadius: 8, padding: 10, margin: 6, color: '#e8e0ff', font: '12px monospace', background: 'rgba(10,8,18,0.7)' }}>
      <div style={{ color: '#9fd0ff', marginBottom: 4 }}>
        Подсказка · {puzzle.archetypeId} {puzzle.solved ? '✓' : ''}
      </div>
      <div style={{ wordBreak: 'break-all' }}>{JSON.stringify(clue)}</div>
      <div style={{ color: '#8a86a6', marginTop: 4 }}>Опиши это напарнику голосом.</div>
    </div>
  );
}
```

- [ ] **Step 2: Write LobbyScreen**

```tsx
// src/games/lodge/dev/LobbyScreen.tsx
import { useState } from 'react';
import { makeRoomCode, isValidRoomCode } from '@/games/lodge/net';

export interface LobbyResult {
  name: string;
  code: string;
  isHost: boolean;
}

export function LobbyScreen({ onStart }: { onStart: (r: LobbyResult) => void }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const ready = name.trim().length > 0;

  const create = () => onStart({ name: name.trim(), code: makeRoomCode(Math.random), isHost: true });
  const join = () => {
    const c = code.trim().toUpperCase();
    if (isValidRoomCode(c)) onStart({ name: name.trim(), code: c, isHost: false });
  };

  return (
    <div style={{ maxWidth: 420, margin: '60px auto', color: '#e8e0ff', font: '14px monospace' }}>
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

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck`
Expected: no errors (ClueCard and LobbyScreen import only the engine and the net barrel — both already exist).

- [ ] **Step 4: Commit**

```bash
git add src/games/lodge/ui/ClueCard.tsx src/games/lodge/dev/LobbyScreen.tsx
git commit -m "feat(lodge): clue card + multiplayer lobby screen" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: NetGameView — networked role-filtered view

**Files:**
- Create: `src/games/lodge/dev/NetGameView.tsx`

**Interfaces:**
- Consumes: `useLodgeStore`; `LodgeSession`/`InMemoryHub`-not-needed; `BroadcastChannelTransport`; `SupabaseBroadcastTransport`/`supabaseConfigured`; `Canvas` + drei; the station `registry` + `stationFor`; `ClueCard`; `LobbyResult`.
- Produces: `NetGameView({ lobby, onExit })`. Builds a `Transport` (Supabase if configured, else BroadcastChannel), a `LodgeSession` wired to the store (`applyServerEvent`/`setRunState`/`getRunState`), and renders: 3D `<Canvas>` with the local player's **lock** stations (calling `session.submit`), a side panel of `ClueCard`s for the player's **clue** puzzles, and a HUD (role, code, connection, ESCAPED). The host gets a "Старт" button (enabled when a guest is present) that calls `session.startRun`.

> DOM+R3F glue — verified by typecheck + the Task 9 cross-tab smoke.

- [ ] **Step 1: Write NetGameView**

```tsx
// src/games/lodge/dev/NetGameView.tsx
import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useLodgeStore } from '@/games/lodge/ui/store/useLodgeStore';
import { stationFor } from '@/games/lodge/ui/scene/stations/registry';
import { ClueCard } from '@/games/lodge/ui/ClueCard';
import { LodgeSession } from '@/games/lodge/net';
import type { PeerInfo, Transport } from '@/games/lodge/net';
import { BroadcastChannelTransport } from '@/games/lodge/net/transports/broadcastChannel';
import { SupabaseBroadcastTransport, supabaseConfigured } from '@/games/lodge/net/transports/supabase';
import type { LobbyResult } from './LobbyScreen';
import type { Role, PuzzleEvent } from '@/games/lodge/engine';

function makeId(): string {
  return 'p-' + Math.random().toString(36).slice(2, 10);
}

export function NetGameView({ lobby, onExit }: { lobby: LobbyResult; onExit: () => void }) {
  const runState = useLodgeStore((s) => s.runState);
  const applyServerEvent = useLodgeStore((s) => s.applyServerEvent);
  const setRunState = useLodgeStore((s) => s.setRunState);
  const [role, setRole] = useState<Role | null>(null);
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [hostLeft, setHostLeft] = useState(false);
  const sessionRef = useRef<LodgeSession | null>(null);

  useEffect(() => {
    const selfId = makeId();
    const transport: Transport = supabaseConfigured()
      ? new SupabaseBroadcastTransport(selfId, lobby.name, lobby.code)
      : new BroadcastChannelTransport(selfId, lobby.name, lobby.code);
    const session = new LodgeSession(transport, { name: lobby.name, isHost: lobby.isHost }, {
      applyServerEvent,
      setRunState,
      getRunState: () => useLodgeStore.getState().runState,
      onRoom: (r) => setRole(r),
      onPeers: (p) => setPeers(p),
      onHostLeft: () => setHostLeft(true),
    });
    sessionRef.current = session;
    void session.start();
    return () => session.dispose();
  }, [lobby, applyServerEvent, setRunState]);

  const session = sessionRef.current;
  const puzzles = runState.run.puzzles;
  const myLockPuzzles = role ? puzzles.filter((p) => p.lockOwner === role) : [];
  const myCluePuzzles = role ? puzzles.filter((p) => p.clueOwner === role) : [];
  const guest = peers.find((p) => p.id !== (session ? (session.hostId ?? '') : ''));
  const act = (puzzleId: string, _by: Role, event: PuzzleEvent) => session?.submit(puzzleId, event);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0a0712' }}>
      <Canvas camera={{ position: [0, 1.5, 7], fov: 50 }} style={{ position: 'absolute', inset: 0 }}>
        <color attach="background" args={['#0a0712']} />
        <ambientLight intensity={0.25} />
        <pointLight position={[0, 3, 4]} intensity={40} color="#ffd0a0" />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
          <planeGeometry args={[40, 40]} />
          <meshStandardMaterial color="#140e1e" />
        </mesh>
        {myLockPuzzles.map((puzzle, i) => {
          const Station = stationFor(puzzle.views[puzzle.lockOwner].kind);
          const x = (i - (myLockPuzzles.length - 1) / 2) * 3;
          return (
            <group key={puzzle.id} position={[x, 0, 0]}>
              {Station ? <Station puzzle={puzzle} dispatch={act} /> : null}
            </group>
          );
        })}
        <OrbitControls enablePan={false} makeDefault />
      </Canvas>

      <div style={{ position: 'absolute', top: 12, left: 12, color: '#e8e0ff', font: '13px monospace', pointerEvents: 'none' }}>
        <div>Код: {lobby.code} · Роль: {role ?? '—'} · Связь: {peers.length}/2</div>
        <div>Решено: {runState.solvedCount}/{puzzles.length}</div>
        {runState.escaped && <div style={{ color: '#7CFC9A', fontSize: 22 }}>ESCAPED ✓</div>}
        {hostLeft && <div style={{ color: '#ff8888' }}>Хост покинул комнату.</div>}
      </div>

      <div style={{ position: 'absolute', top: 12, right: 12, width: 300, maxHeight: '92vh', overflow: 'auto' }}>
        {lobby.isHost && role === null && (
          <button
            disabled={!guest}
            onClick={() => guest && session?.startRun(Math.floor(Math.random() * 0xffffffff), 'standard', guest.id)}
          >
            Старт (нужен второй игрок)
          </button>
        )}
        {myCluePuzzles.map((p) => <ClueCard key={p.id} puzzle={p} />)}
        <button style={{ marginTop: 8 }} onClick={onExit}>Выйти</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: no errors. (`NetGameView` imports ClueCard, `LobbyResult`, the transports, the session, and the station registry — all already exist. It is not yet imported anywhere; that wiring is Task 9.)

- [ ] **Step 3: Commit**

```bash
git add src/games/lodge/dev/NetGameView.tsx
git commit -m "feat(lodge): networked role-filtered game view" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: LodgeDevEntry + route wiring

**Files:**
- Create: `src/games/lodge/dev/LodgeDevEntry.tsx`
- Modify: `src/app/router.tsx`

**Interfaces:**
- Consumes: `LodgeDevHarness` (Этап-1 default export), `LobbyScreen`/`LobbyResult` (Task 7), `NetGameView` (Task 8).
- Produces: default-export `LodgeDevEntry` (menu → Solo harness or Multiplayer lobby→`NetGameView`). Router `/dev/lodge` lazy-loads `LodgeDevEntry` instead of `LodgeDevHarness`.

> DOM/glue — verified by typecheck + full suite + the Task 10 smoke.

- [ ] **Step 1: Write LodgeDevEntry (default export)**

```tsx
// src/games/lodge/dev/LodgeDevEntry.tsx
import { useState } from 'react';
import LodgeDevHarness from './LodgeDevHarness';
import { LobbyScreen, type LobbyResult } from './LobbyScreen';
import { NetGameView } from './NetGameView';

type Screen = { s: 'menu' } | { s: 'solo' } | { s: 'lobby' } | { s: 'net'; lobby: LobbyResult };

export default function LodgeDevEntry() {
  const [screen, setScreen] = useState<Screen>({ s: 'menu' });

  if (screen.s === 'solo') return <LodgeDevHarness />;
  if (screen.s === 'lobby') return <LobbyScreen onStart={(lobby) => setScreen({ s: 'net', lobby })} />;
  if (screen.s === 'net') return <NetGameView lobby={screen.lobby} onExit={() => setScreen({ s: 'menu' })} />;

  return (
    <div style={{ maxWidth: 420, margin: '80px auto', color: '#e8e0ff', font: '15px monospace', textAlign: 'center' }}>
      <h1>Зеркальная Ложа · DEV</h1>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24 }}>
        <button onClick={() => setScreen({ s: 'solo' })}>Соло (Этап 1)</button>
        <button onClick={() => setScreen({ s: 'lobby' })}>Мультиплеер</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Point the route at the entry**

In `src/app/router.tsx`, change the lazy import target only (keep the variable name and the `/dev/lodge` route element unchanged):
```tsx
const LodgeDevHarness = lazy(() => import('@/games/lodge/dev/LodgeDevEntry'));
```

- [ ] **Step 3: Verify typecheck + full suite**

Run: `npm run typecheck`
Expected: no errors (all imports — `LodgeDevHarness`, `LobbyScreen`, `NetGameView` — now resolve).

Run: `npm test`
Expected: all green — Этап-0/1 (64) + roomcode (2) + transport (2) + store-net (2) + session (4) = 74.

- [ ] **Step 4: Commit**

```bash
git add src/games/lodge/dev/LodgeDevEntry.tsx src/app/router.tsx
git commit -m "feat(lodge): dev entry menu (solo/multiplayer) + route" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Integration smoke + final verification

**Files:** none (verification only; commit only if a fix is needed).

> Behavior gate for the adapters + net UI (no unit tests). Prefer driving two browser contexts (webapp-testing) for the cross-tab BroadcastChannel smoke; if browser automation is unavailable here, run build/typecheck/suite and hand the cross-tab + Supabase checks to the user.

- [ ] **Step 1: Final automated gate**

Run: `npm run typecheck` → no errors.
Run: `npm test` → all green (74).
Run: `npm run build` → succeeds; `@supabase/supabase-js` is in the `supabase` chunk and the lodge net code rides the lazy `/dev/lodge` chunk (not the main `index` bundle).

- [ ] **Step 2: Cross-tab smoke (BroadcastChannel)**

Run (background): `npm run dev`. Open `http://localhost:5173/dev/lodge` in **two** tabs:
1. Tab 1: Multiplayer → enter a name → Создать комнату → note the code.
2. Tab 2: Multiplayer → enter a name → type the code → Войти.
3. Tab 1 (host): both players show (Связь 2/2) → click Старт.
4. Both tabs now show role (A/B), their lock stations, and clue cards for the partner's puzzles.
5. Solve via the 3D controls + voice-style cross-reference (clue card text ↔ partner's lock); confirm actions on one tab appear on the other and the `solvedCount` rises in both.
6. Solve all → both tabs show `ESCAPED ✓`.
7. Reconnect check: close Tab 2 mid-game, reopen `/dev/lodge`, rejoin by code → it catches up to current state (snapshot).

- [ ] **Step 3: Supabase live check (delegated)**

Requires the user's Supabase project: set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (e.g. in `.env.local`), enable Realtime, then repeat Step 2 across two different machines/browsers. With the env set, `NetGameView` selects the Supabase transport automatically.

- [ ] **Step 4: Stop the dev server.** If any step required a code fix, commit it:

```bash
git add -A
git commit -m "fix(lodge): address stage-2 smoke findings" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage** (against `2026-06-23-zerkalnaya-lozha-stage2-netcode-design.md`):
- `Transport` interface + `NetMessage` protocol — Task 1. ✔
- Three adapters (in-memory / BroadcastChannel / Supabase) — Tasks 2, 5, 6. ✔
- `LodgeSession` host authority, seq ordering, resync, snapshot — Task 4. ✔
- Store seam (`applyServerEvent`/`setRunState`) + stations call `act`=`session.submit` — Task 3 (store) + Task 8 (`act` wired in NetGameView). ✔
- Anonymous identity (id + name), roles host=A/guest=B, room code — Tasks 1, 4, 7. ✔
- Role-based view (lock stations 3D + clue cards) — Tasks 7, 8. ✔
- Resilience: dup/gap → resync, hash desync → resync, reconnect → snapshot, host-left — Task 4 (+ HUD in Task 8). ✔
- Tests: convergence, ordering, reconnect, desync, roles, roomCode, transport, store seam — Tasks 1–4. ✔
- Out of scope (3D clue rooms, timer, voice, host migration, portal registration, persistence) — none implemented. ✔
- Supabase live-check delegated; isolation (no portal type/catalog changes) — Tasks 6, 9 (route reuse only). ✔

**2. Placeholder scan:** no `TBD`/`TODO`/"add error handling"/"similar to Task N". Adapter/UI tasks state why they carry no unit test and where behavior is verified (Task 10). The UI tasks are ordered so each typechecks standalone: Task 7 (ClueCard+Lobby) → Task 8 (NetGameView) → Task 9 (entry+route). ✔

**3. Type consistency:** `NetMessage` variants and `Transport` (Task 1) are consumed identically by the hub (2), session (4), and adapters (5,6); `SessionCallbacks` shape matches the store methods (`applyServerEvent(lodgeEvent)`, `setRunState(runState)`, `getRunState(): RunState|null`) defined in Task 3 and wired in Task 8; `submit(puzzleId, event)` matches the stations' `dispatch`-shaped `act` wrapper; `LodgeEvent`/`RunState`/`Role`/`Difficulty` come from the engine throughout. ✔

---

## Notes for the implementer

- Tasks 1–4 are the tested core — follow TDD exactly; the convergence/reconnect/desync tests are the real acceptance.
- Tasks 5–9 are transcription of complete code; verify each with `npm run typecheck`. The UI tasks are ordered so each typechecks standalone: Task 7 (ClueCard + LobbyScreen) → Task 8 (NetGameView) → Task 9 (LodgeDevEntry + route).
- Keep all hex colors ASCII. Keep engine files free of any net/React imports — the seam is the store + the session callbacks, nothing deeper.
- Do not skip Task 10. If browser automation is unavailable, run the automated gate and report the cross-tab + Supabase checks as delegated, with exact local steps.
