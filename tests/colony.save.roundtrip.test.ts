// tests/colony.save.roundtrip.test.ts
import { describe, it, expect } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { toSave, fromSave } from '@/games/colony/domain/save';
import { nodeAt, biomeAt, setNode, setBiome, passableAt, buildingIdAt, forEachTile } from '@/games/colony/systems/grid';
import { idx } from '@/games/colony/systems/grid';

describe('save round-trip', () => {
  it('мир регенерируется из сида идентично (биомы)', () => {
    const s = createColony(77);
    const r = fromSave(toSave(s));
    const biomesS: string[] = [], biomesR: string[] = [];
    forEachTile(s.map, (_i, x, y) => biomesS.push(biomeAt(s.map, x, y) ?? ''));
    forEachTile(r.map, (_i, x, y) => biomesR.push(biomeAt(r.map, x, y) ?? ''));
    expect(biomesR).toEqual(biomesS);
    expect(r.seed).toBe(s.seed);
    expect(r.version).toBe(s.version);
  });
  it('истощение узла и смена биома (рубка) переживают сейв', () => {
    const s = createColony(77);
    // Найдём тайл с деревом и «вырубим» его вручную через setters.
    let wtX = -1, wtY = -1;
    forEachTile(s.map, (_i, x, y) => {
      if (wtX === -1 && nodeAt(s.map, x, y)?.kind === 'wood') { wtX = x; wtY = y; }
    });
    setNode(s.map, wtX, wtY, undefined);
    setBiome(s.map, wtX, wtY, 'grass');
    const r = fromSave(toSave(s));
    expect(nodeAt(r.map, wtX, wtY)).toBeUndefined();
    expect(biomeAt(r.map, wtX, wtY)).toBe('grass');
  });
  it('частичное истощение узла переживает сейв', () => {
    const s = createColony(77);
    let wtX = -1, wtY = -1;
    forEachTile(s.map, (_i, x, y) => {
      if (wtX === -1 && nodeAt(s.map, x, y)?.kind === 'wood') { wtX = x; wtY = y; }
    });
    const node = nodeAt(s.map, wtX, wtY)!;
    node.amount = 3;
    const r = fromSave(toSave(s));
    expect(nodeAt(r.map, wtX, wtY)?.amount).toBe(3);
  });
  it('узел, которого нет в свежей генерации, восстанавливается полностью (kind/amount/max)', () => {
    const s = createColony(77);
    // Найдём тайл без узла и не вода
    let tx = -1, ty = -1;
    forEachTile(s.map, (_i, x, y) => {
      if (tx === -1 && !nodeAt(s.map, x, y) && biomeAt(s.map, x, y) !== 'water') { tx = x; ty = y; }
    });
    setNode(s.map, tx, ty, { kind: 'stone', amount: 5, max: 10 });
    const r = fromSave(toSave(s));
    const n = nodeAt(r.map, tx, ty);
    expect(n).toEqual({ kind: 'stone', amount: 5, max: 10 });
  });
  it('постройки восстанавливают buildingId/passable тайла', () => {
    const s = createColony(77);
    let tx = -1, ty = -1;
    forEachTile(s.map, (_i, x, y) => {
      if (tx === -1 && passableAt(s.map, x, y) && !nodeAt(s.map, x, y)) { tx = x; ty = y; }
    });
    s.buildings.push({
      id: 'b1', type: 'wall', tile: { x: tx, y: ty }, workSlots: 0,
      jobType: undefined, built: true, buildProgress: 8, buildRequired: 8,
    });
    const r = fromSave(toSave(s));
    expect(buildingIdAt(r.map, tx, ty)).toBe('b1');
    expect(passableAt(r.map, tx, ty)).toBe(false);
  });
});
