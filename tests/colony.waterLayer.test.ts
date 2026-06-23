import { describe, expect, it } from 'vitest';
import { waterScrollOffset } from '@/games/colony/scenes/render/WaterLayer';
describe('waterScrollOffset', () => {
  it('is deterministic and wraps within the period', () => {
    expect(waterScrollOffset(0, 0.01, 16)).toBe(0);
    expect(waterScrollOffset(1000, 0.01, 16)).toBeCloseTo(10 % 16, 5);
    const o = waterScrollOffset(999999, 0.01, 16);
    expect(o).toBeGreaterThanOrEqual(0); expect(o).toBeLessThan(16);
  });
});
