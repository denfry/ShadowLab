import { describe, expect, it } from 'vitest';
import { migrateSaveFile } from '@/services/save/migrations';
import { createColony } from '@/games/colony/domain/createColony';
import { toSave, fromSave } from '@/games/colony/domain/save';
import { biomeAt, nodeAt, depleteNode, forEachTile } from '@/games/colony/systems/grid';

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

describe('colony save round-trip', () => {
  it('round-trips a mutated 256² world deterministically', () => {
    const s = createColony(777);
    // mutate: deplete a known wood node + change a biome
    let woodTile: { x: number; y: number } | undefined;
    forEachTile(s.map, (i, x, y) => { if (!woodTile && nodeAt(s.map, x, y)?.kind === 'wood') woodTile = { x, y }; });
    if (woodTile) depleteNode(s.map, woodTile.x, woodTile.y, 3);
    const loaded = fromSave(toSave(s));
    expect(loaded.version).toBe(8);
    // every tile biome + node matches
    let mismatches = 0;
    forEachTile(s.map, (i, x, y) => {
      if (biomeAt(s.map, x, y) !== biomeAt(loaded.map, x, y)) mismatches++;
      if ((nodeAt(s.map, x, y)?.amount ?? -1) !== (nodeAt(loaded.map, x, y)?.amount ?? -1)) mismatches++;
    });
    expect(mismatches).toBe(0);
  }, 30000);
});

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
