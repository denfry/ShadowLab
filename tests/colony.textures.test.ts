import { describe, expect, it } from 'vitest';
import { BIOME_BASE, elevationShade, slopeAO, clampByte, biomePixel } from '@/games/colony/scenes/render/textures';

describe('texture color model', () => {
  it('every biome has an rgb base', () => {
    for (const b of ['water','marsh','meadow','grass','forest','rock','mountain'] as const) {
      expect(BIOME_BASE[b]).toHaveLength(3);
      BIOME_BASE[b].forEach((c) => { expect(c).toBeGreaterThanOrEqual(0); expect(c).toBeLessThanOrEqual(255); });
    }
  });
  it('elevationShade brightens high ground and darkens low ground monotonically', () => {
    expect(elevationShade(0.9)).toBeGreaterThan(elevationShade(0.5));
    expect(elevationShade(0.5)).toBeGreaterThan(elevationShade(0.1));
  });
  it('slopeAO darkens when the neighbour drops away (cliff) and is 1 on flat', () => {
    expect(slopeAO(0.6, 0.6)).toBe(1);          // flat
    expect(slopeAO(0.6, 0.3)).toBeLessThan(1);  // cliff edge -> darker
    expect(slopeAO(0.6, 0.3)).toBeGreaterThanOrEqual(0.6);
  });
  it('clampByte clamps to 0..255 integers', () => {
    expect(clampByte(-5)).toBe(0);
    expect(clampByte(300)).toBe(255);
    expect(clampByte(127.9)).toBe(127);
  });
  it('biomePixel is deterministic and stays in byte range', () => {
    const a = biomePixel('grass', 0.5, 0.2, 0.5);
    const b = biomePixel('grass', 0.5, 0.2, 0.5);
    expect(a).toEqual(b);
    a.forEach((c) => { expect(c).toBeGreaterThanOrEqual(0); expect(c).toBeLessThanOrEqual(255); });
  });
  it('biomePixel: higher elevation yields a brighter pixel than lower for the same biome', () => {
    const hi = biomePixel('grass', 0.9, 0, 0.9);
    const lo = biomePixel('grass', 0.2, 0, 0.2);
    expect(hi[0] + hi[1] + hi[2]).toBeGreaterThan(lo[0] + lo[1] + lo[2]);
  });
});
