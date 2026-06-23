// tests/colony.worldgen.test.ts
import { describe, it, expect } from 'vitest';
import { regenerateWorld, pickStartSite } from '@/games/colony/domain/worldgen';
import { passableAt, biomeAt, forEachTile, nodeAt } from '@/games/colony/systems/grid';

describe('worldgen', () => {
  it('детерминирован: один сид → идентичная карта', () => {
    const a = regenerateWorld(123);
    const b = regenerateWorld(123);
    const biomesA: string[] = [], biomesB: string[] = [];
    const nodesA: (string | null)[] = [], nodesB: (string | null)[] = [];
    forEachTile(a, (_i, x, y) => {
      biomesA.push(biomeAt(a, x, y) ?? '');
      nodesA.push(nodeAt(a, x, y)?.kind ?? null);
    });
    forEachTile(b, (_i, x, y) => {
      biomesB.push(biomeAt(b, x, y) ?? '');
      nodesB.push(nodeAt(b, x, y)?.kind ?? null);
    });
    expect(biomesA).toEqual(biomesB);
    expect(nodesA).toEqual(nodesB);
  });
  it('разные сиды → разные карты', () => {
    const a = regenerateWorld(1);
    const b = regenerateWorld(2);
    const biomesA: string[] = [], biomesB: string[] = [];
    forEachTile(a, (_i, x, y) => biomesA.push(biomeAt(a, x, y) ?? ''));
    forEachTile(b, (_i, x, y) => biomesB.push(biomeAt(b, x, y) ?? ''));
    expect(biomesA.join('')).not.toBe(biomesB.join(''));
  });
  it('биомы из допустимого набора; вода и горы непроходимы', () => {
    const m = regenerateWorld(7);
    const allowed = new Set(['water', 'marsh', 'meadow', 'grass', 'forest', 'rock', 'mountain']);
    forEachTile(m, (_i, x, y) => {
      const b = biomeAt(m, x, y)!;
      expect(allowed.has(b)).toBe(true);
      if (b === 'water' || b === 'mountain') expect(passableAt(m, x, y)).toBe(false);
    });
  });
  it('содержит леса с узлами дерева', () => {
    const m = regenerateWorld(7);
    let hasWood = false;
    forEachTile(m, (_i, x, y) => { if (nodeAt(m, x, y)?.kind === 'wood') hasWood = true; });
    expect(hasWood).toBe(true);
  });
  it('стартовая площадка проходима и не на воде', () => {
    const m = regenerateWorld(7);
    const s = pickStartSite(m);
    expect(passableAt(m, s.x, s.y)).toBe(true);
    expect(biomeAt(m, s.x, s.y)).not.toBe('water');
  });
});
