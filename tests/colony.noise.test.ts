import { describe, it, expect } from 'vitest';
import { fbm, valueNoise } from '@/core/utils/noise';

describe('noise', () => {
  it('детерминирован: одинаковые аргументы → одинаковый результат', () => {
    expect(fbm(42, 1.5, 2.5)).toBe(fbm(42, 1.5, 2.5));
    expect(valueNoise(7, 3.2, 9.1)).toBe(valueNoise(7, 3.2, 9.1));
  });
  it('в диапазоне [0,1)', () => {
    for (let i = 0; i < 200; i++) {
      const v = fbm(1, i * 0.3, i * 0.7, 4);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it('меняется по координатам и по сиду', () => {
    expect(fbm(1, 0.1, 0.1)).not.toBe(fbm(1, 5.7, 8.3));
    expect(fbm(1, 2.2, 2.2)).not.toBe(fbm(2, 2.2, 2.2));
  });
});
