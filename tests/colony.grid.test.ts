import { describe, expect, it } from 'vitest';
import {
  idx, inBounds, tileAt, neighbors4,
  biomeAt, passableAt, tempAt, nodeAt, setPassable, setBiome, setNode,
  depleteNode, findNearestNode, forEachTile,
} from '@/games/colony/systems/grid';
import type { ColonyMap } from '@/games/colony/systems/grid';
import type { Tile } from '@/games/colony/domain/types';

const grid = (w: number, h: number): { w: number; h: number; tiles: Tile[] } => {
  const tiles: Tile[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      tiles.push({ x, y, biome: 'grass', elevation: 0.5, fertility: 0.5, passable: true, roomId: 0, temp: 16 });
  return { w, h, tiles };
};

function makeMap(): ColonyMap {
  const w = 3, h = 1;
  const tiles = Array.from({ length: w * h }, (_, i) => ({
    x: i % w, y: 0, biome: 'grass' as const, elevation: 0.5, fertility: 0.4,
    passable: true, roomId: 0, temp: 16,
  }));
  return { w, h, tiles };
}

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

describe('grid accessors', () => {
  it('читают/пишут поля тайла', () => {
    const m = makeMap();
    expect(biomeAt(m, 0, 0)).toBe('grass');
    setBiome(m, 0, 0, 'forest');
    expect(biomeAt(m, 0, 0)).toBe('forest');
    setPassable(m, 1, 0, false);
    expect(passableAt(m, 1, 0)).toBe(false);
    expect(tempAt(m, 2, 0)).toBe(16);
  });
  it('узлы: установка, истощение, очистка', () => {
    const m = makeMap();
    setNode(m, 2, 0, { kind: 'wood', amount: 5, max: 10 });
    expect(nodeAt(m, 2, 0)?.amount).toBe(5);
    expect(depleteNode(m, 2, 0, 3)).toBe(3);
    expect(nodeAt(m, 2, 0)?.amount).toBe(2);
    expect(depleteNode(m, 2, 0, 99)).toBe(2);
    expect(nodeAt(m, 2, 0)).toBeUndefined();
  });
  it('findNearestNode возвращает ближайший тайл с узлом нужного вида', () => {
    const m = makeMap();
    setNode(m, 2, 0, { kind: 'wood', amount: 5, max: 5 });
    expect(findNearestNode(m, { x: 0, y: 0 }, 'wood')).toEqual({ x: 2, y: 0 });
    expect(findNearestNode(m, { x: 0, y: 0 }, 'stone')).toBeUndefined();
  });
  it('passableAt за границей — false', () => {
    const m = makeMap();
    expect(passableAt(m, -1, 0)).toBe(false);
    expect(passableAt(m, 9, 0)).toBe(false);
  });
});
