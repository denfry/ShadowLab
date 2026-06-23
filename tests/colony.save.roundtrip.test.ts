// tests/colony.save.roundtrip.test.ts
import { describe, it, expect } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { toSave, fromSave } from '@/games/colony/domain/save';
import { nodeAt, biomeAt } from '@/games/colony/systems/grid';
import { idx } from '@/games/colony/systems/grid';

describe('save round-trip', () => {
  it('мир регенерируется из сида идентично (биомы)', () => {
    const s = createColony(77);
    const r = fromSave(toSave(s));
    expect(r.map.tiles.map((t) => t.biome)).toEqual(s.map.tiles.map((t) => t.biome));
    expect(r.seed).toBe(s.seed);
    expect(r.version).toBe(s.version);
  });
  it('истощение узла и смена биома (рубка) переживают сейв', () => {
    const s = createColony(77);
    // Найдём тайл с деревом и «вырубим» его вручную.
    const wt = s.map.tiles.find((t) => t.node?.kind === 'wood')!;
    wt.node = undefined;
    wt.biome = 'grass';
    const r = fromSave(toSave(s));
    expect(nodeAt(r.map, wt.x, wt.y)).toBeUndefined();
    expect(biomeAt(r.map, wt.x, wt.y)).toBe('grass');
  });
  it('частичное истощение узла переживает сейв', () => {
    const s = createColony(77);
    const wt = s.map.tiles.find((t) => t.node?.kind === 'wood')!;
    wt.node!.amount = 3;
    const r = fromSave(toSave(s));
    expect(nodeAt(r.map, wt.x, wt.y)?.amount).toBe(3);
  });
  it('постройки восстанавливают buildingId/passable тайла', () => {
    const s = createColony(77);
    const t = s.map.tiles.find((tt) => tt.passable && !tt.node)!;
    s.buildings.push({
      id: 'b1', type: 'wall', tile: { x: t.x, y: t.y }, workSlots: 0,
      jobType: undefined, built: true, buildProgress: 8, buildRequired: 8,
    });
    const r = fromSave(toSave(s));
    expect(r.map.tiles[idx(t.x, t.y, r.map.w)].buildingId).toBe('b1');
    expect(r.map.tiles[idx(t.x, t.y, r.map.w)].passable).toBe(false);
  });
});
