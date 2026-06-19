import { describe, it, expect } from 'vitest';
import { buildProgressTiles } from '@/ui/home/progressModel';
import { defaultSaveFile } from '@/services/save/defaults';

describe('buildProgressTiles', () => {
  it('always returns time / games / achievements tiles', () => {
    const tiles = buildProgressTiles(defaultSaveFile(), 0, 17, {});
    expect(tiles.map((t) => t.label)).toEqual(['Время в играх', 'Игр начато', 'Достижения']);
    expect(tiles[2].value).toBe('0/17');
  });
  it('appends a colony best-day tile when present', () => {
    const tiles = buildProgressTiles(defaultSaveFile(), 3, 17, { 'colony.bestDay': 12 });
    expect(tiles.some((t) => t.value === '12')).toBe(true);
  });
});
