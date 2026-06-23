import { describe, expect, it } from 'vitest';
import { findPath } from '@/games/colony/systems/pathfinding';
import type { Tile } from '@/games/colony/domain/types';

const grid = (w: number, h: number, blocked: [number, number][] = []) => {
  const set = new Set(blocked.map(([x, y]) => `${x},${y}`));
  const tiles: Tile[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      tiles.push({ x, y, terrain: 'grass', fertility: 0.5, passable: !set.has(`${x},${y}`), roomId: 0, temp: 16 });
  return { w, h, tiles };
};

describe('A* pathfinding', () => {
  it('finds a straight path on open ground', () => {
    const g = grid(5, 1);
    const path = findPath(g, { x: 0, y: 0 }, { x: 4, y: 0 });
    expect(path).not.toBeNull();
    expect(path![path!.length - 1]).toEqual({ x: 4, y: 0 });
    expect(path![0]).toEqual({ x: 1, y: 0 }); // стартовая клетка исключена
    expect(path!).toHaveLength(4);
  });

  it('routes around an obstacle', () => {
    // Стена по x=2, кроме (2,2) — путь обязан пройти через щель.
    const g = grid(5, 5, [[2, 0], [2, 1], [2, 3], [2, 4]]);
    const path = findPath(g, { x: 0, y: 0 }, { x: 4, y: 0 });
    expect(path).not.toBeNull();
    expect(path!.some((p) => p.x === 2 && p.y === 2)).toBe(true);
  });

  it('returns null when target is unreachable', () => {
    const g = grid(3, 3, [[1, 0], [1, 1], [1, 2]]); // стена делит карту
    expect(findPath(g, { x: 0, y: 0 }, { x: 2, y: 0 })).toBeNull();
  });

  it('returns an empty path when start equals goal', () => {
    const g = grid(3, 3);
    expect(findPath(g, { x: 1, y: 1 }, { x: 1, y: 1 })).toEqual([]);
  });
});
