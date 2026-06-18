import { create } from 'zustand';
import type { AchievementDefinition, AchievementProgress } from '@/types/achievements';
import { AchievementManager } from '@/services/achievements/AchievementManager';

interface AchievementStore {
  defs: AchievementDefinition[];
  progress: Record<string, AchievementProgress>;
  points: { earned: number; total: number };
  refresh(): void;
}

export const useAchievementStore = create<AchievementStore>((set) => ({
  defs: AchievementManager.getDefinitions(),
  progress: AchievementManager.getProgress(),
  points: AchievementManager.totalPoints(),

  refresh: () =>
    set({
      progress: AchievementManager.getProgress(),
      points: AchievementManager.totalPoints(),
    }),
}));
