import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { runNeeds } from '@/games/colony/systems/needs';
import { HUNGER_EAT_THRESHOLD } from '@/games/colony/data/balance';

describe('needs system', () => {
  it('increases hunger and fatigue over time', () => {
    const s = createColony(1);
    const c = s.colonists[0];
    c.needs.hunger = 0;
    c.needs.fatigue = 0;
    runNeeds(s);
    expect(c.needs.hunger).toBeGreaterThan(0);
    expect(c.needs.fatigue).toBeGreaterThan(0);
  });

  it('sends a starving idle colonist to eat when food is available', () => {
    const s = createColony(1);
    s.resources.food.amount = 100;
    const c = s.colonists[0];
    c.task = 'idle';
    c.needs.hunger = HUNGER_EAT_THRESHOLD + 5;
    runNeeds(s);
    expect(['goto_eat', 'eat']).toContain(c.task);
  });

  it('consuming a meal clears hunger and spends food', () => {
    const s = createColony(1);
    s.resources.food.amount = 50;
    const c = s.colonists[0];
    c.task = 'eat';
    c.needs.hunger = 90;
    runNeeds(s);
    expect(c.needs.hunger).toBe(0);
    expect(s.resources.food.amount).toBeLessThan(50);
    expect(c.task).toBe('idle');
  });

  it('damages health while hunger is maxed and food is gone', () => {
    const s = createColony(1);
    s.resources.food.amount = 0;
    const c = s.colonists[0];
    c.needs.hunger = 100;
    const before = c.health;
    runNeeds(s);
    expect(c.health).toBeLessThan(before);
  });
});
