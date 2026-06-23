// tests/colony.worldgen.test.ts
import { describe, it, expect } from 'vitest';
import { regenerateWorld, pickStartSite } from '@/games/colony/domain/worldgen';
import { passableAt, biomeAt } from '@/games/colony/systems/grid';

describe('worldgen', () => {
  it('детерминирован: один сид → идентичная карта', () => {
    const a = regenerateWorld(123);
    const b = regenerateWorld(123);
    expect(a.tiles.map((t) => t.biome)).toEqual(b.tiles.map((t) => t.biome));
    expect(a.tiles.map((t) => t.node?.kind ?? null)).toEqual(b.tiles.map((t) => t.node?.kind ?? null));
  });
  it('разные сиды → разные карты', () => {
    const a = regenerateWorld(1).tiles.map((t) => t.biome).join('');
    const b = regenerateWorld(2).tiles.map((t) => t.biome).join('');
    expect(a).not.toBe(b);
  });
  it('биомы из допустимого набора; вода и горы непроходимы', () => {
    const m = regenerateWorld(7);
    const allowed = new Set(['water', 'marsh', 'meadow', 'grass', 'forest', 'rock', 'mountain']);
    for (const t of m.tiles) expect(allowed.has(t.biome)).toBe(true);
    for (const t of m.tiles) {
      if (t.biome === 'water' || t.biome === 'mountain') expect(t.passable).toBe(false);
    }
  });
  it('содержит леса с узлами дерева', () => {
    const m = regenerateWorld(7);
    expect(m.tiles.some((t) => t.node?.kind === 'wood')).toBe(true);
  });
  it('стартовая площадка проходима и не на воде', () => {
    const m = regenerateWorld(7);
    const s = pickStartSite(m);
    expect(passableAt(m, s.x, s.y)).toBe(true);
    expect(biomeAt(m, s.x, s.y)).not.toBe('water');
  });
});
