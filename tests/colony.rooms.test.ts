import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { wallsDoorsSig, recomputeRooms } from '@/games/colony/systems/rooms';
import type { Building } from '@/games/colony/domain/types';
import { idx } from '@/games/colony/systems/grid';

const wall = (id: string, x: number, y: number): Building => ({
  id, type: 'wall', tile: { x, y }, workSlots: 0, jobType: undefined,
  built: true, buildProgress: 8, buildRequired: 8,
});

describe('rooms system', () => {
  it('detects an enclosed 1x1 interior as a room', () => {
    const s = createColony(1);
    // Стены вокруг (10,10): (9,10),(11,10),(10,9),(10,11) — диагонали не нужны для 4-связности.
    s.buildings.push(wall('w1', 9, 10), wall('w2', 11, 10), wall('w3', 10, 9), wall('w4', 10, 11));
    recomputeRooms(s);
    const t = s.map.tiles[idx(10, 10, s.map.w)];
    expect(t.roomId).toBeGreaterThan(0);
    const room = s.rooms.find((r) => r.id === t.roomId)!;
    expect(room.area).toBe(1);
  });

  it('a tile with no walls around it stays outdoor (roomId 0)', () => {
    const s = createColony(1);
    recomputeRooms(s);
    expect(s.map.tiles.every((t) => t.roomId === 0)).toBe(true);
    expect(s.rooms).toHaveLength(0);
  });

  it('breaching a wall removes the room', () => {
    const s = createColony(1);
    s.buildings.push(wall('w1', 9, 10), wall('w2', 11, 10), wall('w3', 10, 9), wall('w4', 10, 11));
    recomputeRooms(s);
    expect(s.map.tiles[idx(10, 10, s.map.w)].roomId).toBeGreaterThan(0);
    s.buildings = s.buildings.filter((b) => b.id !== 'w1'); // пролом
    recomputeRooms(s);
    expect(s.map.tiles[idx(10, 10, s.map.w)].roomId).toBe(0);
  });

  it('signature changes only with walls/doors', () => {
    const s = createColony(1);
    const a = wallsDoorsSig(s);
    s.buildings.push(wall('w1', 9, 10));
    expect(wallsDoorsSig(s)).not.toBe(a);
  });
});
