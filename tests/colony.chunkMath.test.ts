import { describe, expect, it } from 'vitest';
import {
  chunkIdOf, chunkCounts, visibleChunkRange, chunkTileBounds, lodForZoom,
  worldToMinimap, minimapToWorldTile, minimapViewportRect,
} from '@/games/colony/scenes/render/chunkMath';

describe('chunkMath', () => {
  it('chunkCounts uses ceil so the last partial chunk is included', () => {
    expect(chunkCounts(256, 256, 32)).toEqual({ cw: 8, ch: 8 });
    expect(chunkCounts(40, 40, 32)).toEqual({ cw: 2, ch: 2 });
  });
  it('chunkIdOf is row-major', () => {
    expect(chunkIdOf(0, 0, 8)).toBe(0);
    expect(chunkIdOf(1, 1, 8)).toBe(9);
  });
  it('chunkTileBounds clamps the last chunk to the map', () => {
    expect(chunkTileBounds(0, 0, 32, 256, 256)).toEqual({ x0: 0, y0: 0, x1: 31, y1: 31 });
    expect(chunkTileBounds(7, 7, 32, 250, 250)).toEqual({ x0: 224, y0: 224, x1: 249, y1: 249 });
  });
  it('visibleChunkRange covers on-screen chunks with a +1 margin, clamped', () => {
    // origin (0,0), zoom 1, 100x100px view, tile 22, chunk 32 -> chunk px = 704
    const r = visibleChunkRange(0, 0, 1, 100, 100, 22, 32, 256, 256);
    expect(r.cx0).toBe(0); expect(r.cy0).toBe(0);
    expect(r.cx1).toBeGreaterThanOrEqual(0);
    expect(r.cx1).toBeLessThanOrEqual(1); // ~100px view spans <1 chunk + margin
  });
  it('visibleChunkRange clamps at the far edge', () => {
    const r = visibleChunkRange(255 * 22, 255 * 22, 1, 100, 100, 22, 32, 256, 256);
    expect(r.cx1).toBe(7); expect(r.cy1).toBe(7);
  });
  it('lodForZoom switches at the threshold', () => {
    expect(lodForZoom(0.4, 0.55)).toBe('far');
    expect(lodForZoom(0.55, 0.55)).toBe('near');
    expect(lodForZoom(1.2, 0.55)).toBe('near');
  });
  it('worldToMinimap scales world px into minimap px', () => {
    expect(worldToMinimap(0, 0, 2560, 2560, 192, 192)).toEqual({ x: 0, y: 0 });
    expect(worldToMinimap(2560, 2560, 2560, 2560, 192, 192)).toEqual({ x: 192, y: 192 });
    expect(worldToMinimap(1280, 1280, 2560, 2560, 192, 192)).toEqual({ x: 96, y: 96 });
  });
  it('minimapToWorldTile inverts to a tile coordinate', () => {
    expect(minimapToWorldTile(96, 96, 192, 192, 256, 256, 22)).toEqual({ x: 128, y: 128 });
    expect(minimapToWorldTile(0, 0, 192, 192, 256, 256, 22)).toEqual({ x: 0, y: 0 });
  });
  it('minimapViewportRect maps the camera viewport into minimap space', () => {
    const rect = minimapViewportRect(0, 0, 1, 256, 256, 2560, 2560, 192, 192);
    expect(rect.x).toBe(0); expect(rect.y).toBe(0);
    expect(rect.w).toBeCloseTo(192 * (256 / 2560), 3);
  });
});
