import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { computeHud } from '@/games/colony/systems/projection';
import { emptySkills } from '@/games/colony/domain/skills';

describe('new resources', () => {
  it('createColony seeds stone/clay/iron/gold at 0 with capacity', () => {
    const s = createColony(1);
    for (const id of ['stone', 'clay', 'iron', 'gold'] as const) {
      expect(s.resources[id].amount).toBe(0);
      expect(s.resources[id].capacity).toBeGreaterThan(0);
    }
  });
  it('hud projection includes the new resources', () => {
    const hud = computeHud(createColony(1));
    for (const id of ['stone', 'clay', 'iron', 'gold'] as const) {
      expect(hud.resources[id]).toBeDefined();
    }
  });
});

describe('mining skill + harvest jobs', () => {
  it('colonists have mine/forage priorities and a mining skill', () => {
    const s = createColony(1);
    const c = s.colonists[0];
    expect(c.priorities.mine).toBeGreaterThanOrEqual(0);
    expect(c.priorities.forage).toBeGreaterThanOrEqual(0);
    expect(emptySkills().mining).toEqual({ level: 0, xp: 0 });
  });
});
