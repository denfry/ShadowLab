import { describe, expect, it } from 'vitest';
import { regenerateWorld, pickStartSite } from '@/games/colony/domain/worldgen';
import { passableAt, biomeAt, forEachTile, neighbors4 } from '@/games/colony/systems/grid';
import { MAP_W, MAP_H } from '@/games/colony/data/balance';

describe('256² worldgen', () => {
  it('map is the configured size', () => {
    expect(MAP_W).toBe(256); expect(MAP_H).toBe(256);
  });
  it('start site is passable and has a passable neighbourhood', () => {
    const m = regenerateWorld(42);
    const s = pickStartSite(m);
    expect(passableAt(m, s.x, s.y)).toBe(true);
    const open = neighbors4(s.x, s.y, m).filter((n) => passableAt(m, n.x, n.y)).length;
    expect(open).toBeGreaterThanOrEqual(2); // not boxed in
  }, 30000);
  it('a flood fill from the start reaches a large connected area', () => {
    const m = regenerateWorld(42);
    const s = pickStartSite(m);
    const seen = new Uint8Array(m.w * m.h);
    const stack = [s]; let count = 0;
    seen[s.y * m.w + s.x] = 1;
    while (stack.length) {
      const p = stack.pop()!; count++;
      for (const n of neighbors4(p.x, p.y, m)) {
        const i = n.y * m.w + n.x;
        if (!seen[i] && passableAt(m, n.x, n.y)) { seen[i] = 1; stack.push(n); }
      }
    }
    expect(count).toBeGreaterThan(m.w * m.h * 0.3); // >30% of tiles reachable
  }, 30000);
  it('has biome variety (water, forest, and grass/meadow all present)', () => {
    const m = regenerateWorld(42);
    const kinds = new Set<string>();
    forEachTile(m, (_i, x, y) => kinds.add(biomeAt(m, x, y)!));
    expect(kinds.has('water')).toBe(true);
    expect(kinds.has('forest')).toBe(true);
    expect(kinds.has('grass') || kinds.has('meadow')).toBe(true);
  }, 30000);
});
