import type { SaveFile } from '@/types/save';
import { formatPlaytime } from '@/services/cloud/saveSummary';

export interface ProgressTile {
  label: string;
  value: string;
}

export function buildProgressTiles(
  file: SaveFile,
  achUnlocked: number,
  achTotal: number,
  records: Record<string, number>,
): ProgressTile[] {
  const tiles: ProgressTile[] = [
    { label: 'Время в играх', value: formatPlaytime(file.profile.stats.totalPlaytimeSec) },
    { label: 'Игр начато', value: String(Object.values(file.games).filter((s) => s.length > 0).length) },
    { label: 'Достижения', value: `${achUnlocked}/${achTotal}` },
  ];
  const bestDay = records['colony.bestDay'];
  if (bestDay && bestDay > 0) tiles.push({ label: 'Колония · лучший день', value: String(bestDay) });
  return tiles;
}
