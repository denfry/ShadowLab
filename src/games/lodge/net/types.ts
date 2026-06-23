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
