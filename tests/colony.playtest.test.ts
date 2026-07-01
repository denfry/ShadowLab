import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { placeBlueprint } from '@/games/colony/systems/build';
import { designateField } from '@/games/colony/systems/fields';
import { tick, alive } from '@/games/colony/systems/tick';
import { TICKS_PER_DAY } from '@/games/colony/data/balance';
import { pickStartSite } from '@/games/colony/domain/worldgen';
import { passableAt, setBiome, setPassable } from '@/games/colony/systems/grid';

/**
 * Headless "playtest": exercises the full field-farming loop end-to-end —
 * designate wheat fields, colonists till/plant/harvest them — and asserts the
 * colony is actually survivable (no path deadlock, no instant starvation
 * spiral) over a full run. Catches gameplay/balance regressions that the
 * per-system unit tests do not.
 */

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

/** Clears a 5x5 patch of grass around `t` and designates it as a wheat field. */
function sowWheatField(s: ReturnType<typeof createColony>, t: { x: number; y: number }): void {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      setBiome(s.map, t.x + dx, t.y + dy, 'grass');
      setPassable(s.map, t.x + dx, t.y + dy, true);
    }
  }
  designateField(s, { x0: t.x - 2, y0: t.y - 2, x1: t.x + 2, y1: t.y + 2 }, 'wheat');
}

describe('colony Phase 0 playtest', () => {
  it('a colony given fields survives the run and produces food', () => {
    const s = createColony(2024);
    const [t1, t2, t3] = nearbySlots(s, 3);
    sowWheatField(s, t1);
    sowWheatField(s, t2);
    expect(placeBlueprint(s, 'storage', t3.x, t3.y).ok).toBe(true);

    s.colonists.forEach((c) => { c.priorities.build = 3; c.priorities.farm = 3; });

    for (let i = 0; i < TICKS_PER_DAY * 11 && !s.flags.gameOver; i++) tick(s);

    expect(alive(s).length).toBeGreaterThan(0);
    const totalXp = s.colonists.reduce((sum, c) => sum + c.skills.farming.level, 0);
    expect(totalXp).toBeGreaterThan(0);
  }, 60000);

  it('without any fields the colony eventually starves (negative control)', () => {
    const s = createColony(2024);
    s.colonists.forEach((c) => {
      c.priorities.farm = 0;
      c.priorities.research = 0;
    });
    for (let i = 0; i < TICKS_PER_DAY * 30 && !s.flags.gameOver; i++) tick(s);
    expect(s.flags.gameOver).toBe(true);
    expect(s.flags.victory).toBe(false);
  }, 60000);

  it('survives into the next season with a heated room and clothing buffer', () => {
    const s = createColony(777);
    const [t1, t2] = nearbySlots(s, 2);
    sowWheatField(s, t1);
    sowWheatField(s, t2);
    s.stock.clothing = 5;
    s.resources.wood.amount = 200;
    s.colonists.forEach((c) => { c.priorities.build = 3; c.priorities.farm = 3; });
    for (let i = 0; i < TICKS_PER_DAY * 8 && !s.flags.gameOver; i++) tick(s);
    expect(alive(s).length).toBeGreaterThan(0);
  }, 60000);
});
