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
      const isNew = !this.seen.has(w.id);
      this.seen.set(w.id, { name: w.name, at: Date.now() });
      if (isNew) this.emitPresence();
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
