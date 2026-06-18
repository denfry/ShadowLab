import { create } from 'zustand';

export type RuntimeStatus = 'idle' | 'loading' | 'running' | 'paused' | 'over';

interface GameRuntimeStore {
  status: RuntimeStatus;
  loadProgress: number;
  hud: Record<string, unknown>;
  lastResult: unknown;
  setStatus(status: RuntimeStatus): void;
  setLoadProgress(value: number): void;
  setHud(hud: Record<string, unknown>): void;
  setResult(result: unknown): void;
  reset(): void;
}

/** The bridge between the running game and portal chrome — holds only a light
 *  projection of game state (never the heavy ColonyState itself). */
export const useGameRuntimeStore = create<GameRuntimeStore>((set) => ({
  status: 'idle',
  loadProgress: 0,
  hud: {},
  lastResult: null,
  setStatus: (status) => set({ status }),
  setLoadProgress: (loadProgress) => set({ loadProgress }),
  setHud: (hud) => set({ hud }),
  setResult: (lastResult) => set({ lastResult, status: 'over' }),
  reset: () => set({ status: 'idle', loadProgress: 0, hud: {}, lastResult: null }),
}));
