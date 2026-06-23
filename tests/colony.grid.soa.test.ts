import { describe, expect, it } from 'vitest';
import {
  createMap, idx, biomeAt, setBiome, passableAt, setPassable, tempAt, setTemp,
  fertilityAt, roomIdAt, setRoomId, buildingIdAt, setBuildingId,
  nodeAt, setNode, depleteNode, forEachTile, findNearestNode, tileAt,
} from '@/games/colony/systems/grid';

describe('SoA grid backend', () => {
  it('createMap allocates typed arrays with sane defaults', () => {
    const m = createMap(4, 3);
    expect(m.w).toBe(4); expect(m.h).toBe(3);
    expect(m.biome).toBeInstanceOf(Uint8Array);
    expect(m.elevation).toBeInstanceOf(Float32Array);
    expect(m.passable).toBeInstanceOf(Uint8Array);
    expect(biomeAt(m, 0, 0)).toBe('grass');
    expect(passableAt(m, 0, 0)).toBe(true);
    expect(tempAt(m, 0, 0)).toBe(16);
    expect(nodeAt(m, 0, 0)).toBeUndefined();
  });
  it('biome codec round-trips every biome', () => {
    const m = createMap(7, 1);
    const all = ['water','marsh','meadow','grass','forest','rock','mountain'] as const;
    all.forEach((b, x) => setBiome(m, x, 0, b));
    all.forEach((b, x) => expect(biomeAt(m, x, 0)).toBe(b));
  });
  it('numeric accessors read/write the backing arrays', () => {
    const m = createMap(3, 3);
    setPassable(m, 1, 1, false); expect(passableAt(m, 1, 1)).toBe(false);
    setTemp(m, 1, 1, -4.5); expect(tempAt(m, 1, 1)).toBeCloseTo(-4.5, 3);
    setRoomId(m, 1, 1, 7); expect(roomIdAt(m, 1, 1)).toBe(7);
  });
  it('node + buildingId are sparse and clear correctly', () => {
    const m = createMap(3, 1);
    setNode(m, 2, 0, { kind: 'wood', amount: 5, max: 10 });
    expect(nodeAt(m, 2, 0)?.amount).toBe(5);
    expect(m.nodes.size).toBe(1);
    expect(depleteNode(m, 2, 0, 3)).toBe(3);
    expect(nodeAt(m, 2, 0)?.amount).toBe(2);
    expect(depleteNode(m, 2, 0, 99)).toBe(2);
    expect(nodeAt(m, 2, 0)).toBeUndefined();
    expect(m.nodes.size).toBe(0);
    setBuildingId(m, 0, 0, 'b1'); expect(buildingIdAt(m, 0, 0)).toBe('b1');
    setBuildingId(m, 0, 0, undefined); expect(buildingIdAt(m, 0, 0)).toBeUndefined();
  });
  it('out-of-bounds reads are safe defaults', () => {
    const m = createMap(2, 2);
    expect(passableAt(m, -1, 0)).toBe(false);
    expect(biomeAt(m, 9, 9)).toBeUndefined();
    expect(tempAt(m, 9, 9)).toBe(0);
    expect(tileAt(9, 9, m)).toBeUndefined();
  });
  it('forEachTile visits every index once with correct x,y', () => {
    const m = createMap(3, 2);
    const seen: Array<[number, number, number]> = [];
    forEachTile(m, (i, x, y) => seen.push([i, x, y]));
    expect(seen).toHaveLength(6);
    expect(seen[4]).toEqual([4, 1, 1]); // i=4 -> x=1,y=1 on w=3
  });
  it('findNearestNode scans the sparse node map by Manhattan', () => {
    const m = createMap(5, 1);
    setNode(m, 4, 0, { kind: 'wood', amount: 1, max: 1 });
    setNode(m, 1, 0, { kind: 'wood', amount: 1, max: 1 });
    expect(findNearestNode(m, { x: 0, y: 0 }, 'wood')).toEqual({ x: 1, y: 0 });
    expect(findNearestNode(m, { x: 0, y: 0 }, 'stone')).toBeUndefined();
  });
  it('tileAt returns a constructed view (mutating the view does NOT write back)', () => {
    const m = createMap(2, 1);
    const t = tileAt(0, 0, m)!;
    expect(t.biome).toBe('grass');
    t.biome = 'forest';
    expect(biomeAt(m, 0, 0)).toBe('grass'); // view is a copy
  });
});
