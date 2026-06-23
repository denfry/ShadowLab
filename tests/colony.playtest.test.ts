import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { placeBlueprint } from '@/games/colony/systems/build';
import { tick, alive } from '@/games/colony/systems/tick';
import { TICKS_PER_DAY, MAP_W, MAP_H } from '@/games/colony/data/balance';

/**
 * Headless "playtest": exercises the full Phase 0 loop end-to-end —
 * place farms + storage, builders construct them, farmers feed the colony —
 * and asserts the colony is actually survivable (no path deadlock, no instant
 * starvation spiral) over a full run. Catches gameplay/balance regressions that
 * the per-system unit tests do not.
 */
describe('colony Phase 0 playtest', () => {
  it('a colony given farms survives the run and produces food', () => {
    const s = createColony(2024);
    const cx = Math.floor(MAP_W / 2);
    const cy = Math.floor(MAP_H / 2);

    expect(placeBlueprint(s, 'farm', cx + 1, cy).ok).toBe(true);
    expect(placeBlueprint(s, 'farm', cx, cy + 1).ok).toBe(true);
    expect(placeBlueprint(s, 'storage', cx - 1, cy).ok).toBe(true);

    s.colonists.forEach((c) => { c.priorities.build = 3; c.priorities.farm = 3; });

    // Run until the win-stub day (12) or game over.
    for (let i = 0; i < TICKS_PER_DAY * 11 && !s.flags.gameOver; i++) tick(s);

    // The colony must not have died out.
    expect(alive(s).length).toBeGreaterThan(0);
    // Builders must have completed at least one farm.
    expect(s.buildings.filter((b) => b.type === 'farm' && b.built).length).toBeGreaterThan(0);
    // Colonists must have gained some farming/building experience (work actually happened).
    const totalXp = s.colonists.reduce(
      (sum, c) => sum + c.skills.farming.level + c.skills.building.level,
      0,
    );
    expect(totalXp).toBeGreaterThan(0);
  });

  it('without any farms the colony eventually starves (negative control)', () => {
    const s = createColony(2024);
    // No farms placed; disable farm/research so nobody can produce food.
    s.colonists.forEach((c) => {
      c.priorities.farm = 0;
      c.priorities.research = 0;
    });
    for (let i = 0; i < TICKS_PER_DAY * 30 && !s.flags.gameOver; i++) tick(s);
    expect(s.flags.gameOver).toBe(true);
    expect(s.flags.victory).toBe(false);
  });

  it('survives into winter with a heated room and clothing buffer', () => {
    const s = createColony(777);
    const cx = Math.floor(MAP_W / 2), cy = Math.floor(MAP_H / 2);
    // фермы для еды
    placeBlueprint(s, 'farm', cx + 1, cy);
    placeBlueprint(s, 'farm', cx, cy + 1);
    // запас одежды и дерева, чтобы пережить холод
    s.stock.clothing = 5;
    s.resources.wood.amount = 200;
    s.colonists.forEach((c) => { c.priorities.build = 3; c.priorities.farm = 3; });
    for (let i = 0; i < TICKS_PER_DAY * 8 && !s.flags.gameOver; i++) tick(s);
    expect(alive(s).length).toBeGreaterThan(0);
  });
});
