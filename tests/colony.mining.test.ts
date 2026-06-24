import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { runJobScheduler } from '@/games/colony/systems/jobScheduler';
import { setNode, idx } from '@/games/colony/systems/grid';

describe('mining scheduler', () => {
  it('mine job targets a designated ore node; ignores undesignated', () => {
    const s = createColony(1);
    const c0 = s.colonists[0];
    const tx = Math.round(c0.pos.x), ty = Math.round(c0.pos.y);
    setNode(s.map, tx, ty, { kind: 'stone', amount: 20, max: 20 });
    s.colonists.forEach((c) => {
      c.task = 'idle';
      (['farm', 'forage', 'woodcut', 'research', 'build', 'tailor'] as const).forEach((j) => (c.priorities[j] = 0));
      c.priorities.mine = 3;
    });
    // not designated yet → no assignment
    runJobScheduler(s);
    expect(s.colonists.some((c) => c.task === 'goto_work')).toBe(false);
    // designate, then it assigns
    s.designations.add(idx(tx, ty, s.map.w));
    s.colonists.forEach((c) => { c.task = 'idle'; });
    runJobScheduler(s);
    expect(s.colonists.some((c) => c.task === 'goto_work' && c.targetTile?.x === tx && c.targetTile?.y === ty)).toBe(true);
  });
});
