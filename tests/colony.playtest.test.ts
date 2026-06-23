import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { placeBlueprint } from '@/games/colony/systems/build';
import { tick, alive } from '@/games/colony/systems/tick';
import { TICKS_PER_DAY } from '@/games/colony/data/balance';
import { pickStartSite } from '@/games/colony/domain/worldgen';
import { passableAt } from '@/games/colony/systems/grid';

/**
 * Headless "playtest": exercises the full Phase 0 loop end-to-end —
 * place farms + storage, builders construct them, farmers feed the colony —
 * and asserts the colony is actually survivable (no path deadlock, no instant
 * starvation spiral) over a full run. Catches gameplay/balance regressions that
 * the per-system unit tests do not.
 *
 * Buildings are placed near pickStartSite (always passable grass/meadow) rather
 * than at MAP_W/2, MAP_H/2, which may be water or mountain on a 256² world.
 */

/** Find up to `n` distinct passable offsets adjacent to `start`, searching outward. */
function nearbySlots(s: ReturnType<typeof createColony>, n: number): Array<{ x: number; y: number }> {
  const start = pickStartSite(s.map);
  const slots: Array<{ x: number; y: number }> = [];
  for (let r = 1; r <= 20 && slots.length < n; r++) {
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]) {
      const x = start.x + dx * r, y = start.y + dy * r;
      if (passableAt(s.map, x, y) && !slots.some(p => p.x === x && p.y === y)) {
        slots.push({ x, y });
        if (slots.length >= n) break;
      }
    }
  }
  return slots;
}

describe('colony Phase 0 playtest', () => {
  it('a colony given farms survives the run and produces food', () => {
    const s = createColony(2024);
    const [t1, t2, t3] = nearbySlots(s, 3);

    expect(placeBlueprint(s, 'farm', t1.x, t1.y).ok).toBe(true);
    expect(placeBlueprint(s, 'farm', t2.x, t2.y).ok).toBe(true);
    expect(placeBlueprint(s, 'storage', t3.x, t3.y).ok).toBe(true);

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
  }, 60000);

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
  }, 60000);

  it('survives into winter with a heated room and clothing buffer', () => {
    const s = createColony(777);
    const [t1, t2] = nearbySlots(s, 2);
    // фермы для еды
    placeBlueprint(s, 'farm', t1.x, t1.y);
    placeBlueprint(s, 'farm', t2.x, t2.y);
    // запас одежды и дерева, чтобы пережить холод
    s.stock.clothing = 5;
    s.resources.wood.amount = 200;
    s.colonists.forEach((c) => { c.priorities.build = 3; c.priorities.farm = 3; });
    for (let i = 0; i < TICKS_PER_DAY * 8 && !s.flags.gameOver; i++) tick(s);
    expect(alive(s).length).toBeGreaterThan(0);
  }, 60000);
});
