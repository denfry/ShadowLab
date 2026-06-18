import { describe, expect, it } from 'vitest';
import { migrateSaveFile } from '@/services/save/migrations';

const v1File = {
  schemaVersion: 1,
  profile: {
    id: 'x',
    displayName: 'A',
    avatarId: 'a',
    createdAt: '2026-01-01T00:00:00.000Z',
    stats: { totalPlaytimeSec: 0, gamesPlayed: {} },
    cloudLinked: false,
  },
  settings: {
    audio: { master: 1, music: 1, sfx: 1, muted: false },
    graphics: { quality: 'high', particles: true },
    language: 'ru',
    reducedMotion: false,
  },
  achievements: { unlocked: {}, progress: {} },
  games: {},
};

describe('save migration', () => {
  it('upgrades a v1 file to v2 and adds the records store', () => {
    const migrated = migrateSaveFile(v1File);
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.records).toEqual({});
    expect(migrated.profile.displayName).toBe('A');
  });

  it('falls back to defaults for corrupt input', () => {
    const migrated = migrateSaveFile('not an object');
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.profile).toBeDefined();
    expect(migrated.records).toBeDefined();
  });
});
