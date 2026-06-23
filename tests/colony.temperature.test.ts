import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { recomputeRooms } from '@/games/colony/systems/rooms';
import { runTemperature } from '@/games/colony/systems/temperature';
import type { Building } from '@/games/colony/domain/types';
import { tempAt } from '@/games/colony/systems/grid';

const wall = (id: string, x: number, y: number): Building => ({
  id, type: 'wall', tile: { x, y }, workSlots: 0, jobType: undefined, built: true, buildProgress: 8, buildRequired: 8,
});
const heater = (id: string, x: number, y: number): Building => ({
  id, type: 'heater', tile: { x, y }, workSlots: 0, jobType: undefined, built: true, buildProgress: 25, buildRequired: 25,
});

function enclose(s: ReturnType<typeof createColony>) {
  // Комната-кольцо вокруг (10,10): стены по периметру 3x3 рамки, интерьер (10,10).
  s.buildings.push(wall('a', 9, 9), wall('b', 10, 9), wall('c', 11, 9), wall('d', 9, 10), wall('e', 11, 10), wall('f', 9, 11), wall('g', 10, 11), wall('h', 11, 11));
}

describe('temperature system', () => {
  it('a heated enclosed room gets warmer than outside', () => {
    const s = createColony(1);
    s.env.outdoorTemp = -10;
    enclose(s);
    s.buildings.push(heater('ht', 10, 10));
    recomputeRooms(s);
    for (let i = 0; i < 200; i++) runTemperature(s);
    const room = s.rooms.find((r) => r.tiles.length > 0)!;
    expect(room.temp).toBeGreaterThan(s.env.outdoorTemp);
  });

  it('a heater with no wood does not heat', () => {
    const s = createColony(1);
    s.env.outdoorTemp = -10;
    s.resources.wood.amount = 0;
    enclose(s);
    s.buildings.push(heater('ht', 10, 10));
    recomputeRooms(s);
    for (let i = 0; i < 200; i++) runTemperature(s);
    const room = s.rooms[0];
    expect(room.temp).toBeLessThanOrEqual(s.env.outdoorTemp + 0.5);
  });

  it('outdoor tiles equal outdoorTemp', () => {
    const s = createColony(1);
    s.env.outdoorTemp = 5;
    recomputeRooms(s);
    runTemperature(s);
    expect(tempAt(s.map, 0, 0)).toBe(5);
  });
});
