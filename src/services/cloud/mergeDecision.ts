import type { SaveFile } from '@/types/save';

export type SyncAction = 'push' | 'pull' | 'conflict' | 'noop';

/** A save is "meaningful" once the player has actually made progress. */
export function isMeaningfulSave(file: SaveFile): boolean {
  const hasSlots = Object.values(file.games).some((slots) => slots.length > 0);
  const hasPlaytime = file.profile.stats.totalPlaytimeSec > 0;
  const hasAchievements = Object.keys(file.achievements.unlocked).length > 0;
  const hasRecords = Object.keys(file.records).length > 0;
  return hasSlots || hasPlaytime || hasAchievements || hasRecords;
}

function sameSave(a: SaveFile, b: SaveFile): boolean {
  const norm = (f: SaveFile) => JSON.stringify({ ...f, exportedAt: undefined });
  return norm(a) === norm(b);
}

export function decideSync(local: SaveFile, cloud: { data: SaveFile } | null): SyncAction {
  const localMeaningful = isMeaningfulSave(local);
  if (!cloud) return localMeaningful ? 'push' : 'noop';

  const cloudMeaningful = isMeaningfulSave(cloud.data);
  if (localMeaningful && !cloudMeaningful) return 'push';
  if (!localMeaningful && cloudMeaningful) return 'pull';
  if (!localMeaningful && !cloudMeaningful) return 'noop';
  return sameSave(local, cloud.data) ? 'noop' : 'conflict';
}
