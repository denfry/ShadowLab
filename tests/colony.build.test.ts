import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { canPlace, placeBlueprint } from '@/games/colony/systems/build';
import { setBiome } from '@/games/colony/systems/grid';
import { pickStartSite } from '@/games/colony/domain/worldgen';

// Use the colony's start site (always passable grass/meadow) as the anchor.
// MAP_W/2, MAP_H/2 is no longer reliable on a 256² world (may be water/mountain).
const startTile = (s: ReturnType<typeof createColony>) => pickStartSite(s.map);

describe('build placement', () => {
  it('places a bedroom blueprint on valid grass and spends wood', () => {
    const s = createColony(1);
    const t = startTile(s);
    const wood0 = s.resources.wood.amount;
    const res = placeBlueprint(s, 'bedroom', t.x, t.y);
    expect(res.ok).toBe(true);
    expect(s.resources.wood.amount).toBeLessThan(wood0);
    const b = s.buildings[s.buildings.length - 1];
    expect(b.type).toBe('bedroom');
    expect(b.built).toBe(false);
  });

  it('нельзя строить на воде и горах, можно на скале', () => {
    const s = createColony(1);
    setBiome(s.map, 5, 5, 'water');
    setBiome(s.map, 6, 5, 'mountain');
    setBiome(s.map, 7, 5, 'rock');
    expect(canPlace(s, 5, 5)).toBe(false);
    expect(canPlace(s, 6, 5)).toBe(false);
    expect(canPlace(s, 7, 5)).toBe(true);
  });

  it('rejects placement on an occupied tile', () => {
    const s = createColony(1);
    const t = startTile(s);
    placeBlueprint(s, 'bedroom', t.x, t.y);
    expect(canPlace(s, t.x, t.y)).toBe(false);
  });

  it('rejects when wood is insufficient', () => {
    const s = createColony(1);
    const t = startTile(s);
    s.resources.wood.amount = 0;
    const res = placeBlueprint(s, 'lab', t.x, t.y);
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/дерев/i);
  });
});
