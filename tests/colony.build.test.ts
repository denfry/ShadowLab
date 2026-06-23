import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { canPlace, placeBlueprint } from '@/games/colony/systems/build';
import { setBiome } from '@/games/colony/systems/grid';
import { MAP_W, MAP_H } from '@/games/colony/data/balance';

const center = () => ({ x: Math.floor(MAP_W / 2), y: Math.floor(MAP_H / 2) });

describe('build placement', () => {
  it('places a farm blueprint on valid grass and spends wood', () => {
    const s = createColony(1);
    const t = center();
    const wood0 = s.resources.wood.amount;
    const res = placeBlueprint(s, 'farm', t.x, t.y);
    expect(res.ok).toBe(true);
    expect(s.resources.wood.amount).toBeLessThan(wood0);
    const b = s.buildings[s.buildings.length - 1];
    expect(b.type).toBe('farm');
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
    const t = center();
    placeBlueprint(s, 'farm', t.x, t.y);
    expect(canPlace(s, t.x, t.y)).toBe(false);
  });

  it('rejects when wood is insufficient', () => {
    const s = createColony(1);
    const t = center();
    s.resources.wood.amount = 0;
    const res = placeBlueprint(s, 'lab', t.x, t.y);
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/дерев/i);
  });
});
