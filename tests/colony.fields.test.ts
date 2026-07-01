import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { computeHud } from '@/games/colony/systems/projection';

describe('fields scaffold', () => {
  it('createColony seeds fiber at 0 with capacity, and empty fields/regrowCooldowns maps', () => {
    const s = createColony(1);
    expect(s.resources.fiber.amount).toBe(0);
    expect(s.resources.fiber.capacity).toBeGreaterThan(0);
    expect(s.fields.size).toBe(0);
    expect(s.regrowCooldowns.size).toBe(0);
  });
  it('hud projection includes fiber', () => {
    const hud = computeHud(createColony(1));
    expect(hud.resources.fiber).toBeDefined();
  });
});
