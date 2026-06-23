import { describe, expect, it } from 'vitest';
import { idx, inBounds, tileAt, neighbors4 } from '@/games/colony/systems/grid';
import type { Tile } from '@/games/colony/domain/types';

const grid = (w: number, h: number): { w: number; h: number; tiles: Tile[] } => {
  const tiles: Tile[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      tiles.push({ x, y, terrain: 'grass', fertility: 0.5, passable: true, roomId: 0, temp: 16 });
  return { w, h, tiles };
};

describe('grid helpers', () => {
  it('maps (x,y) to a flat index', () => {
    expect(idx(3, 2, 10)).toBe(23);
  });

  it('detects bounds', () => {
    const g = grid(5, 5);
    expect(inBounds(0, 0, g)).toBe(true);
    expect(inBounds(4, 4, g)).toBe(true);
    expect(inBounds(-1, 0, g)).toBe(false);
    expect(inBounds(5, 0, g)).toBe(false);
  });

  it('returns the tile at coordinates and undefined out of bounds', () => {
    const g = grid(5, 5);
    expect(tileAt(2, 1, g)?.y).toBe(1);
    expect(tileAt(9, 9, g)).toBeUndefined();
  });

  it('returns 4-neighbours within bounds', () => {
    const g = grid(5, 5);
    expect(neighbors4(0, 0, g)).toEqual([{ x: 1, y: 0 }, { x: 0, y: 1 }]);
    expect(neighbors4(2, 2, g)).toHaveLength(4);
  });
});
