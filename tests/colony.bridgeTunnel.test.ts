import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { canPlaceType, placeBlueprint } from '@/games/colony/systems/build';
import { setBiome, forEachTile, biomeAt, setPassable, passableAt, nearestPassableAdjacent } from '@/games/colony/systems/grid';
import { runJobScheduler } from '@/games/colony/systems/jobScheduler';

function findTile(s: ReturnType<typeof createColony>, biome: string): { x: number; y: number } {
  let found = { x: -1, y: -1 };
  forEachTile(s.map, (_i, x, y) => { if (found.x < 0 && biomeAt(s.map, x, y) === biome) found = { x, y }; });
  return found;
}

describe('bridge/tunnel placement', () => {
  it('bridge only on water, tunnel only on mountain', () => {
    const s = createColony(1);
    setBiome(s.map, 20, 20, 'water');
    setBiome(s.map, 22, 20, 'mountain');
    setBiome(s.map, 24, 20, 'grass');
    expect(canPlaceType(s, 'bridge', 20, 20)).toBe(true);
    expect(canPlaceType(s, 'bridge', 24, 20)).toBe(false); // grass
    expect(canPlaceType(s, 'tunnel', 22, 20)).toBe(true);
    expect(canPlaceType(s, 'tunnel', 20, 20)).toBe(false); // water
  });
  it('placing a bridge deducts wood and creates an unbuilt blueprint', () => {
    const s = createColony(1);
    setBiome(s.map, 20, 20, 'water');
    s.resources.wood.amount = 100;
    const wood0 = s.resources.wood.amount;
    const res = placeBlueprint(s, 'bridge', 20, 20);
    expect(res.ok).toBe(true);
    expect(s.resources.wood.amount).toBeLessThan(wood0);
    expect(s.buildings.some((b) => b.type === 'bridge' && !b.built)).toBe(true);
  });
});

describe('build target adjacency', () => {
  it('nearestPassableAdjacent finds a passable neighbor of an impassable tile', () => {
    const s = createColony(1);
    setBiome(s.map, 40, 40, 'water'); setPassable(s.map, 40, 40, false);
    setBiome(s.map, 41, 40, 'grass'); setPassable(s.map, 41, 40, true);
    const adj = nearestPassableAdjacent(s.map, 40, 40);
    expect(adj).toBeDefined();
    expect(passableAt(s.map, adj!.x, adj!.y)).toBe(true);
  });
  it('a bridge blueprint is targeted via a passable adjacent tile, not the water tile', () => {
    const s = createColony(1);
    const c0 = s.colonists[0];
    const wx = Math.round(c0.pos.x) + 1, wy = Math.round(c0.pos.y);
    setBiome(s.map, wx, wy, 'water'); setPassable(s.map, wx, wy, false);
    s.resources.wood.amount = 100;
    placeBlueprint(s, 'bridge', wx, wy);
    s.colonists.forEach((c) => { c.task = 'idle'; (['farm','forage','woodcut','mine','research','tailor'] as const).forEach((j) => (c.priorities[j] = 0)); c.priorities.build = 3; });
    runJobScheduler(s);
    const builder = s.colonists.find((c) => c.task === 'goto_work' && c.targetBuildingId);
    expect(builder).toBeDefined();
    expect(passableAt(s.map, builder!.targetTile!.x, builder!.targetTile!.y)).toBe(true);
  });
});
