import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { applyFoodSpoilage } from '@/games/colony/systems/tick';

describe('food spoilage', () => {
  it('food spoils when warm and unstored', () => {
    const s = createColony(1);
    s.env.outdoorTemp = 20;
    s.resources.food.amount = 100;
    s.buildings = [];
    applyFoodSpoilage(s);
    expect(s.resources.food.amount).toBeLessThan(100);
  });

  it('storage slows spoilage', () => {
    const warm = createColony(1); warm.env.outdoorTemp = 20; warm.resources.food.amount = 100; warm.buildings = [];
    applyFoodSpoilage(warm);
    const stored = createColony(1); stored.env.outdoorTemp = 20; stored.resources.food.amount = 100;
    stored.buildings = [{ id: 's1', type: 'storage', tile: { x: 0, y: 0 }, workSlots: 0, jobType: undefined, built: true, buildProgress: 25, buildRequired: 25 }];
    applyFoodSpoilage(stored);
    expect(stored.resources.food.amount).toBeGreaterThan(warm.resources.food.amount);
  });

  it('cold preserves food', () => {
    const s = createColony(1);
    s.env.outdoorTemp = -10;
    s.resources.food.amount = 100;
    s.buildings = [];
    applyFoodSpoilage(s);
    expect(s.resources.food.amount).toBeGreaterThan(99); // почти не испортилась
  });
});
