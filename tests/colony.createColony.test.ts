import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { START_COLONISTS } from '@/games/colony/data/balance';
import { passableAt, biomeAt, forEachTile } from '@/games/colony/systems/grid';

describe('createColony', () => {
  it('is deterministic for a given seed', () => {
    const a = createColony(999);
    const b = createColony(999);
    const biomesA: string[] = [], biomesB: string[] = [];
    forEachTile(a.map, (_i, x, y) => biomesA.push(biomeAt(a.map, x, y) ?? ''));
    forEachTile(b.map, (_i, x, y) => biomesB.push(biomeAt(b.map, x, y) ?? ''));
    expect(biomesA).toEqual(biomesB);
  });

  it('spawns the starting colonists with names, traits and skills', () => {
    const s = createColony(1);
    expect(s.colonists).toHaveLength(START_COLONISTS);
    for (const c of s.colonists) {
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.traits.length).toBeGreaterThanOrEqual(1);
      expect(c.alive).toBe(true);
      expect(c.task).toBe('idle');
      expect(c.skills.farming).toBeDefined();
    }
  });

  it('колонисты спавнятся на проходимых тайлах у старт-площадки', () => {
    const s = createColony(42);
    expect(s.colonists.length).toBeGreaterThan(0);
    for (const c of s.colonists) {
      expect(passableAt(s.map, Math.round(c.pos.x), Math.round(c.pos.y))).toBe(true);
    }
  });

  it('версия пейлоада = 7', () => {
    expect(createColony(1).version).toBe(7);
  });
});
