import { describe, expect, it } from 'vitest';
import { regenerateWorld, pickStartSite } from '@/games/colony/domain/worldgen';
import { passableAt, biomeAt, forEachTile, neighbors4 } from '@/games/colony/systems/grid';
import { MAP_W, MAP_H } from '@/games/colony/data/balance';
import { createColony } from '@/games/colony/domain/createColony';
import { tick } from '@/games/colony/systems/tick';

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

function populate(seed: number, n: number) {
  const s = createColony(seed);
  const base = s.colonists[0];
  // spiral out from the start placing colonists on passable tiles (deterministic)
  const start = { x: Math.round(base.pos.x), y: Math.round(base.pos.y) };
  const spots: Array<{ x: number; y: number }> = [];
  for (let rad = 0; rad < 40 && spots.length < n; rad++)
    for (let dy = -rad; dy <= rad && spots.length < n; dy++)
      for (let dx = -rad; dx <= rad && spots.length < n; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
        const x = start.x + dx, y = start.y + dy;
        if (passableAt(s.map, x, y)) spots.push({ x, y });
      }
  s.colonists = spots.slice(0, n).map((p, i) => ({
    ...base, id: `c${i}`, name: `C${i}`, pos: { x: p.x, y: p.y }, path: [], task: 'idle' as const,
  }));
  return s;
}

describe('scale smoke', () => {
  it('256² with 200 agents runs 300 ticks without throwing', () => {
    const s = populate(2026, 200);
    expect(s.colonists.length).toBe(200);
    expect(() => { for (let i = 0; i < 300; i++) tick(s); }).not.toThrow();
  }, 120000);
  it('one seed -> identical run with 200 agents', () => {
    const a = populate(2026, 200), b = populate(2026, 200);
    for (let i = 0; i < 200; i++) { tick(a); tick(b); }
    const proj = (s: any) => s.colonists.map((c: any) => [c.task, Math.round(c.pos.x), Math.round(c.pos.y), c.path.length]);
    expect(proj(a)).toEqual(proj(b));
  }, 120000);
});
