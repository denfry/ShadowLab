import { SAVE_SCHEMA_VERSION, type SaveFile } from '@/types/save';
import { makeId, nowIso } from '@/core/utils';

export function defaultSaveFile(): SaveFile {
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    profile: {
      id: makeId('player'),
      displayName: 'Investigator',
      avatarId: 'avatar-01',
      createdAt: nowIso(),
      stats: { totalPlaytimeSec: 0, gamesPlayed: {} },
      cloudLinked: false,
    },
    settings: {
      audio: { master: 0.8, music: 0.6, sfx: 0.8, muted: false },
      graphics: { quality: 'high', particles: true },
      language: 'ru',
      reducedMotion: false,
    },
    achievements: { unlocked: {}, progress: {} },
    games: {},
    records: {},
  };
}
