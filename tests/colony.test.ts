import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { tick, tryBuild, tryResearch, alive, allTechResearched } from '@/games/colony/systems/simulation';

const runTicks = (seed: number, n: number) => {
  const s = createColony(seed);
  for (let i = 0; i < n; i++) tick(s);
  return s;
};

describe('colony simulation', () => {
  it('is deterministic for a given seed', () => {
    const a = runTicks(12345, 500);
    const b = runTicks(12345, 500);
    expect(a.resources.food.amount).toBeCloseTo(b.resources.food.amount, 5);
    expect(alive(a).length).toBe(alive(b).length);
    expect(a.day).toBe(b.day);
  });

  it('spends wood when building a farm', () => {
    const s = createColony(1);
    const before = s.resources.wood.amount;
    const res = tryBuild(s, 'farm');
    expect(res.ok).toBe(true);
    expect(s.resources.wood.amount).toBeLessThan(before);
    expect(s.buildings).toHaveLength(1);
  });

  it('gates the tech tree by prerequisites', () => {
    const s = createColony(2);
    s.resources.science.amount = 300;
    expect(tryResearch(s, 'irrigation').ok).toBe(false); // needs tools first
    expect(tryResearch(s, 'tools').ok).toBe(true);
    expect(tryResearch(s, 'irrigation').ok).toBe(true);
    expect(tryResearch(s, 'medicine').ok).toBe(true);
    expect(allTechResearched(s)).toBe(true);
    expect(s.tech.researched).toContain('tools');
  });

  it('reaches game over if everyone starves', () => {
    const s = createColony(7);
    s.resources.food.amount = 0;
    // Strip all food production by making everyone idle.
    s.colonists.forEach((c) => (c.job = 'idle'));
    for (let i = 0; i < 6000 && !s.flags.gameOver; i++) tick(s);
    expect(s.flags.gameOver).toBe(true);
    expect(s.flags.victory).toBe(false);
  });
});
