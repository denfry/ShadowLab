import { create } from 'zustand';
import type { SaveFile } from '@/types/save';
import type { SaveSummary } from '@/services/cloud/saveSummary';

export type SyncPhase = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

export interface SyncConflict {
  local: SaveFile;
  cloud: SaveFile;
  localSummary: SaveSummary;
  cloudSummary: SaveSummary;
  cloudUpdatedAt: string;
}

interface SyncStore {
  phase: SyncPhase;
  lastSyncedAt: string | null;
  conflict: SyncConflict | null;
  setPhase(phase: SyncPhase): void;
  markSynced(at: string): void;
  setConflict(conflict: SyncConflict | null): void;
}

export const useSyncStore = create<SyncStore>((set) => ({
  phase: 'idle',
  lastSyncedAt: null,
  conflict: null,
  setPhase: (phase) => set({ phase }),
  markSynced: (at) => set({ phase: 'synced', lastSyncedAt: at }),
  setConflict: (conflict) => set({ conflict }),
}));
