import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { computeHud } from '@/games/colony/systems/projection';
import { forEachTile, roomIdAt, tempAt } from '@/games/colony/systems/grid';

describe('phase 1 model migration', () => {
  it('initializes env, rooms, stock and tailorProgress', () => {
    const s = createColony(1);
    expect(s.version).toBe(6);
    expect(s.env.season).toBe('spring');
    expect(s.rooms).toEqual([]);
    expect(s.roomSig).toBe('');
    expect(s.stock.clothing).toBe(0);
    expect(s.tailorProgress).toBe(0);
  });

  it('initializes new tile and colonist fields', () => {
    const s = createColony(1);
    let allOk = true;
    forEachTile(s.map, (_i, x, y) => {
      if (roomIdAt(s.map, x, y) !== 0 || typeof tempAt(s.map, x, y) !== 'number') allOk = false;
    });
    expect(allOk).toBe(true);
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
