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
