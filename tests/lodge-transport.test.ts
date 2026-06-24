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
