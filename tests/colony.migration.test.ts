import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { computeHud } from '@/games/colony/systems/projection';

describe('phase 1 model migration', () => {
  it('initializes env, rooms, stock and tailorProgress', () => {
    const s = createColony(1);
    expect(s.version).toBe(5);
    expect(s.env.season).toBe('spring');
    expect(s.rooms).toEqual([]);
    expect(s.roomSig).toBe('');
    expect(s.stock.clothing).toBe(0);
    expect(s.tailorProgress).toBe(0);
  });

  it('initializes new tile and colonist fields', () => {
    const s = createColony(1);
    expect(s.map.tiles.every((t) => t.roomId === 0 && typeof t.temp === 'number')).toBe(true);
    expect(s.colonists.every((c) => c.clothed === false && c.needs.cold === 0)).toBe(true);
  });

  it('projects env and clothing into the HUD', () => {
    const hud = computeHud(createColony(1));
    expect(hud.env.season).toBe('spring');
    expect(hud.clothing).toBe(0);
    expect(typeof hud.colonists[0].cold).toBe('number');
    expect(hud.colonists[0].clothed).toBe(false);
  });
});
