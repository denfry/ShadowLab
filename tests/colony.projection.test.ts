import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { computeHud } from '@/games/colony/systems/projection';
import { START_COLONISTS } from '@/games/colony/data/balance';

describe('hud projection', () => {
  it('projects population, resources and colonists', () => {
    const s = createColony(1);
    const hud = computeHud(s);
    expect(hud.population).toBe(START_COLONISTS);
    expect(hud.resources.food.amount).toBe(s.resources.food.amount);
    expect(hud.colonists).toHaveLength(START_COLONISTS);
    expect(hud.colonists[0].topSkill.level).toBeGreaterThanOrEqual(0);
  });

  it('counts only alive colonists', () => {
    const s = createColony(1);
    s.colonists[0].alive = false;
    expect(computeHud(s).population).toBe(START_COLONISTS - 1);
  });

  it('reports building counts by type', () => {
    const s = createColony(1);
    s.buildings.push({ id: 'f', type: 'lab', tile: { x: 0, y: 0 }, workSlots: 2, jobType: 'research', built: true, buildProgress: 45, buildRequired: 45 });
    expect(computeHud(s).buildingCounts.lab).toBe(1);
  });
});
