import { describe, expect, it } from 'vitest';
import { findPath } from '@/games/colony/systems/pathfinding';
import type { ColonyMap } from '@/games/colony/systems/grid';

function grid(w: number, h: number, blocked: [number, number][] = []): ColonyMap {
  const tiles = Array.from({ length: w * h }, (_, i) => ({
    x: i % w, y: Math.floor(i / w), biome: 'grass' as const, elevation: 0.5,
    fertility: 0.5, passable: true, roomId: 0, temp: 16,
  }));
  for (const [x, y] of blocked) tiles[y * w + x].passable = false;
  return { w, h, tiles };
}

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
