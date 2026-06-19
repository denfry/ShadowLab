import type { SaveFile } from '@/types/save';

export interface SaveSummary {
  playtimeSec: number;
  achievementsUnlocked: number;
  totalSlots: number;
}

export function summarizeSave(file: SaveFile): SaveSummary {
  return {
    playtimeSec: file.profile.stats.totalPlaytimeSec,
    achievementsUnlocked: Object.keys(file.achievements.unlocked).length,
    totalSlots: Object.values(file.games).reduce((n, slots) => n + slots.length, 0),
  };
}

export function formatPlaytime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h} ч ${m} мин`;
  if (m > 0) return `${m} мин`;
  return 'меньше минуты';
}
