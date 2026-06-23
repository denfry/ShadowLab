import { describe, expect, it } from 'vitest';
import { visibleTileRange, clampScroll } from '@/games/colony/scenes/cameraMath';
describe('cameraMath', () => {
  it('visibleTileRange covers exactly the on-screen tiles (+1 margin), clamped to map', () => {
    // scroll origin at world (0,0), zoom 1, 100x100 px view, tile 10 -> tiles 0..10 (with margin), clamped
    const r = visibleTileRange(0, 0, 1, 100, 100, 10, 256, 256);
    expect(r.x0).toBe(0); expect(r.y0).toBe(0);
    expect(r.x1).toBeGreaterThanOrEqual(9);
    expect(r.x1).toBeLessThanOrEqual(11);
  });
  it('visibleTileRange clamps at the far map edge', () => {
    const r = visibleTileRange(255 * 10, 255 * 10, 1, 100, 100, 10, 256, 256);
    expect(r.x1).toBe(255); expect(r.y1).toBe(255);
  });
  it('clampScroll keeps the viewport inside the world', () => {
    const c = clampScroll(-500, -500, 1, 100, 100, 256 * 10, 256 * 10);
    expect(c.x).toBeGreaterThanOrEqual(0); expect(c.y).toBeGreaterThanOrEqual(0);
    const far = clampScroll(99999, 99999, 1, 100, 100, 256 * 10, 256 * 10);
    expect(far.x).toBe(256 * 10 - 100);
    expect(far.y).toBe(256 * 10 - 100);
  });
});
