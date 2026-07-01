import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { designate } from '@/games/colony/systems/designations';
import { setNode, idx } from '@/games/colony/systems/grid';

describe('designations', () => {
  it('chop marks only wood nodes inside the rect', () => {
    const s = createColony(1);
    setNode(s.map, 10, 10, { kind: 'wood', amount: 5, max: 5 });
    setNode(s.map, 11, 10, { kind: 'stone', amount: 5, max: 5 });
    setNode(s.map, 30, 30, { kind: 'wood', amount: 5, max: 5 }); // outside
    designate(s, { x0: 9, y0: 9, x1: 12, y1: 12 }, 'chop');
    expect(s.designations.has(idx(10, 10, s.map.w))).toBe(true);
    expect(s.designations.has(idx(11, 10, s.map.w))).toBe(false); // stone, not chop
    expect(s.designations.has(idx(30, 30, s.map.w))).toBe(false); // outside rect
  });
  it('mine marks any ore kind; forage marks berries', () => {
    const s = createColony(2);
    setNode(s.map, 5, 5, { kind: 'iron', amount: 5, max: 5 });
    setNode(s.map, 6, 5, { kind: 'berries', amount: 5, max: 5 });
    designate(s, { x0: 4, y0: 4, x1: 7, y1: 7 }, 'mine');
    expect(s.designations.has(idx(5, 5, s.map.w))).toBe(true);
    expect(s.designations.has(idx(6, 5, s.map.w))).toBe(false);
    designate(s, { x0: 4, y0: 4, x1: 7, y1: 7 }, 'forage');
    expect(s.designations.has(idx(6, 5, s.map.w))).toBe(true);
  });
  it('cancel clears any designation in the rect', () => {
    const s = createColony(3);
    setNode(s.map, 8, 8, { kind: 'wood', amount: 5, max: 5 });
    designate(s, { x0: 7, y0: 7, x1: 9, y1: 9 }, 'chop');
    expect(s.designations.size).toBe(1);
    designate(s, { x0: 7, y0: 7, x1: 9, y1: 9 }, 'cancel');
    expect(s.designations.size).toBe(0);
  });
});
