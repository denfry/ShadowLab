import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { runNeeds, coldWorkFactor } from '@/games/colony/systems/needs';

function freezeColonist(s: ReturnType<typeof createColony>) {
  // Поставить все тайлы холодными.
  for (const t of s.map.tiles) t.temp = -10;
}

describe('cold need', () => {
  it('cold rises when the colonist stands on a cold tile', () => {
    const s = createColony(1);
    freezeColonist(s);
    const c = s.colonists[0];
    c.needs.cold = 0;
    runNeeds(s);
    expect(c.needs.cold).toBeGreaterThan(0);
  });

  it('clothing reduces cold accumulation (auto-equips from stock)', () => {
    const s = createColony(1);
    freezeColonist(s);
    s.stock.clothing = 5;
    const c = s.colonists[0];
    c.needs.cold = 40; // выше CLOTHE_THRESHOLD
    runNeeds(s);
    expect(c.clothed).toBe(true);
    expect(s.stock.clothing).toBe(4);
  });

  it('warmth lowers cold', () => {
    const s = createColony(1);
    for (const t of s.map.tiles) t.temp = 22;
    const c = s.colonists[0];
    c.needs.cold = 50;
    runNeeds(s);
    expect(c.needs.cold).toBeLessThan(50);
  });

  it('freezing damages health', () => {
    const s = createColony(1);
    for (const t of s.map.tiles) t.temp = -10;
    const c = s.colonists[0];
    const before = c.health;
    runNeeds(s);
    expect(c.health).toBeLessThan(before);
  });

  it('coldWorkFactor drops below 1 only above the threshold', () => {
    const s = createColony(1);
    const c = s.colonists[0];
    c.needs.cold = 0;
    expect(coldWorkFactor(c)).toBeCloseTo(1, 5);
    c.needs.cold = 100;
    expect(coldWorkFactor(c)).toBeLessThan(1);
  });
});
