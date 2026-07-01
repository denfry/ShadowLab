import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { tick } from '@/games/colony/systems/tick';
import { TICKS_PER_DAY } from '@/games/colony/data/balance';
import { pickStartSite } from '@/games/colony/domain/worldgen';
import { passableAt, neighbors4, idx } from '@/games/colony/systems/grid';

const run = (seed: number, n: number) => {
  const s = createColony(seed);
  for (let i = 0; i < n; i++) tick(s);
  return s;
};

describe('tick orchestration', () => {
  it('rolls over a new day after TICKS_PER_DAY', () => {
    const s = createColony(1);
    for (let i = 0; i < TICKS_PER_DAY; i++) tick(s);
    expect(s.day).toBe(2);
  });

  it('is deterministic for a given seed', () => {
    const a = run(4242, TICKS_PER_DAY * 2);
    const b = run(4242, TICKS_PER_DAY * 2);
    expect(a.resources.food.amount).toBeCloseTo(b.resources.food.amount, 5);
    expect(a.resources.wood.amount).toBeCloseTo(b.resources.wood.amount, 5);
    expect(a.colonists.filter((c) => c.alive).length).toBe(b.colonists.filter((c) => c.alive).length);
    expect(a.day).toBe(b.day);
  }, 30000);

  it('ends in defeat when everyone starves', () => {
    const s = createColony(7);
    s.resources.food.amount = 0;
    s.colonists.forEach((c) => { c.needs.hunger = 100; (['farm','woodcut','research','build'] as const).forEach((j) => (c.priorities[j] = 0)); });
    for (let i = 0; i < TICKS_PER_DAY * 4 && !s.flags.gameOver; i++) tick(s);
    expect(s.flags.gameOver).toBe(true);
    expect(s.flags.victory).toBe(false);
  }, 30000);

  it('colonists actually move (positions change) over a day', () => {
    const s = createColony(11);
    // gathering is zone-gated now → give them a reachable field tile to walk to
    const start = pickStartSite(s.map);
    let spot = start;
    for (const n of neighbors4(start.x, start.y, s.map)) { if (passableAt(s.map, n.x, n.y)) { spot = n; break; } }
    s.fields.set(idx(spot.x, spot.y, s.map.w), { crop: 'wheat', stage: 'till', progress: 0 });
    s.colonists.forEach((c) => { c.priorities.farm = 3; });
    const before = s.colonists.map((c) => `${c.pos.x.toFixed(2)},${c.pos.y.toFixed(2)}`);
    for (let i = 0; i < TICKS_PER_DAY; i++) tick(s);
    const after = s.colonists.map((c) => `${c.pos.x.toFixed(2)},${c.pos.y.toFixed(2)}`);
    expect(after).not.toEqual(before);
  }, 30000);

  it('один сид → идентичный прогон 300 тиков', () => {
    const a = createColony(2024);
    const b = createColony(2024);
    for (let i = 0; i < 300; i++) { tick(a); tick(b); }
    expect(a.resources.wood.amount).toBe(b.resources.wood.amount);
    expect(a.colonists.map((c) => `${c.pos.x.toFixed(3)},${c.pos.y.toFixed(3)}`))
      .toEqual(b.colonists.map((c) => `${c.pos.x.toFixed(3)},${c.pos.y.toFixed(3)}`));
  }, 30000);
});
