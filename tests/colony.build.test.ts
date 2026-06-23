import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { canPlace, placeBlueprint } from '@/games/colony/systems/build';
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

  it('rejects placement on water', () => {
    const s = createColony(1);
    const water = s.map.tiles.find((t) => t.terrain === 'water');
    if (!water) return; // на редком сиде воды может не быть в кадре теста
    expect(canPlace(s, water.x, water.y)).toBe(false);
    const res = placeBlueprint(s, 'farm', water.x, water.y);
    expect(res.ok).toBe(false);
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
