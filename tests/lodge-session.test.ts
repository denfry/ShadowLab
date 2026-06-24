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

async function startedPair(seed = 2026) {
  const hub = new InMemoryHub();
  const host = makeNode(hub, 'h', 'Host', true);
  const guest = makeNode(hub, 'g', 'Guest', false);
  await host.session.start();
  await guest.session.start();
  host.session.startRun(seed, 'standard', 'g');
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
    const { hub, host, guest } = await startedPair(123);
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
