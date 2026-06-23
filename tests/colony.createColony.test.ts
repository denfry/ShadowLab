import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { START_COLONISTS, MAP_W, MAP_H } from '@/games/colony/data/balance';

describe('createColony', () => {
  it('is deterministic for a given seed', () => {
    const a = createColony(999);
    const b = createColony(999);
    expect(a.map.tiles.map((t) => t.terrain)).toEqual(b.map.tiles.map((t) => t.terrain));
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

  it('keeps the central spawn area passable grass', () => {
    const s = createColony(3);
    const cx = Math.floor(MAP_W / 2);
    const cy = Math.floor(MAP_H / 2);
    const center = s.map.tiles[cy * MAP_W + cx];
    expect(center.terrain).toBe('grass');
    expect(center.passable).toBe(true);
  });

  it('marks water and rock impassable, forest carries wood', () => {
    const s = createColony(5);
    for (const t of s.map.tiles) {
      if (t.terrain === 'water' || t.terrain === 'rock') expect(t.passable).toBe(false);
      if (t.terrain === 'forest') expect(t.wood ?? 0).toBeGreaterThan(0);
    }
  });
});
