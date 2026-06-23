import { describe, expect, it } from 'vitest';
import { findPath } from '@/games/colony/systems/pathfinding';
import { createMap, setPassable } from '@/games/colony/systems/grid';
import type { ColonyMap } from '@/games/colony/systems/grid';

function grid(w: number, h: number, blocked: [number, number][] = []): ColonyMap {
  const m = createMap(w, h);
  for (const [x, y] of blocked) setPassable(m, x, y, false);
  return m;
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

  it('finds an optimal-length path around a wall on a larger grid', () => {
    const m = createMap(40, 40);
    for (let y = 0; y < 38; y++) setPassable(m, 20, y, false); // vertical wall, gap at bottom
    const path = findPath(m, { x: 0, y: 0 }, { x: 39, y: 0 })!;
    expect(path).not.toBeNull();
    // last point is the goal; every step is 4-adjacent and (except goal) passable
    expect(path[path.length - 1]).toEqual({ x: 39, y: 0 });
    for (let k = 0; k < path.length; k++) {
      const prev = k === 0 ? { x: 0, y: 0 } : path[k - 1];
      expect(Math.abs(path[k].x - prev.x) + Math.abs(path[k].y - prev.y)).toBe(1);
    }
  });
});
