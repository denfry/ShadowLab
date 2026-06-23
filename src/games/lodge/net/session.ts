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
