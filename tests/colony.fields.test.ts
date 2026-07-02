import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { computeHud } from '@/games/colony/systems/projection';
import { designateField } from '@/games/colony/systems/fields';
import { setBiome, setPassable, setNode, setBuildingId, idx, biomeAt } from '@/games/colony/systems/grid';

describe('fields scaffold', () => {
  it('createColony seeds fiber at 0 with capacity, and empty fields/regrowCooldowns maps', () => {
    const s = createColony(1);
    expect(s.resources.fiber.amount).toBe(0);
    expect(s.resources.fiber.capacity).toBeGreaterThan(0);
    expect(s.fields.size).toBe(0);
    expect(s.regrowCooldowns.size).toBe(0);
  });
  it('hud projection includes fiber', () => {
    const hud = computeHud(createColony(1));
    expect(hud.resources.fiber).toBeDefined();
  });
});

describe('designateField', () => {
  it('marks only grass/meadow/marsh tiles inside the rect with the chosen crop', () => {
    const s = createColony(2);
    setBiome(s.map, 10, 10, 'grass'); setPassable(s.map, 10, 10, true);
    setBiome(s.map, 11, 10, 'forest'); setPassable(s.map, 11, 10, true); // not cleared yet
    setBiome(s.map, 12, 10, 'rock'); setPassable(s.map, 12, 10, true);
    designateField(s, { x0: 10, y0: 10, x1: 12, y1: 10 }, 'wheat');
    expect(s.fields.get(idx(10, 10, s.map.w))).toEqual({ crop: 'wheat', stage: 'till', progress: 0 });
    expect(s.fields.has(idx(11, 10, s.map.w))).toBe(false); // forest — must clear (chop) first
    expect(s.fields.has(idx(12, 10, s.map.w))).toBe(false); // rock — never farmable
  });
  it('rejects tiles with a building or an existing wild resource node', () => {
    const s = createColony(3);
    setBiome(s.map, 20, 20, 'grass'); setPassable(s.map, 20, 20, true);
    setBuildingId(s.map, 20, 20, 'b1');
    setBiome(s.map, 21, 20, 'grass'); setPassable(s.map, 21, 20, true);
    setNode(s.map, 21, 20, { kind: 'berries', amount: 5, max: 5 });
    designateField(s, { x0: 20, y0: 20, x1: 21, y1: 20 }, 'potato');
    expect(s.fields.size).toBe(0);
  });
  it('clear removes any plot in the rect; re-designating overwrites crop and resets progress', () => {
    const s = createColony(4);
    setBiome(s.map, 30, 30, 'meadow'); setPassable(s.map, 30, 30, true);
    setNode(s.map, 30, 30); // clear any wild node that worldgen may have placed
    designateField(s, { x0: 30, y0: 30, x1: 30, y1: 30 }, 'legume');
    const plot = s.fields.get(idx(30, 30, s.map.w))!;
    plot.stage = 'plant'; plot.progress = 3; // simulate partial progress
    designateField(s, { x0: 30, y0: 30, x1: 30, y1: 30 }, 'flax');
    expect(s.fields.get(idx(30, 30, s.map.w))).toEqual({ crop: 'flax', stage: 'till', progress: 0 });
    designateField(s, { x0: 30, y0: 30, x1: 30, y1: 30 }, 'clear');
    expect(s.fields.size).toBe(0);
  });
});
