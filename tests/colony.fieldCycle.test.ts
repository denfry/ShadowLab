import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { runJobScheduler } from '@/games/colony/systems/jobScheduler';
import { setBiome, setPassable, idx } from '@/games/colony/systems/grid';

describe('field scheduler targeting', () => {
  it('targets a till-stage field tile; ignores grow-stage tiles', () => {
    const s = createColony(1);
    const c0 = s.colonists[0];
    const tx = Math.round(c0.pos.x), ty = Math.round(c0.pos.y);
    setBiome(s.map, tx, ty, 'grass'); setPassable(s.map, tx, ty, true);
    s.fields.set(idx(tx, ty, s.map.w), { crop: 'wheat', stage: 'till', progress: 0 });
    s.colonists.forEach((c) => {
      c.task = 'idle';
      (['woodcut', 'forage', 'mine', 'research', 'build', 'tailor'] as const).forEach((j) => (c.priorities[j] = 0));
      c.priorities.farm = 3;
    });
    runJobScheduler(s);
    expect(s.colonists.some((c) => c.task === 'goto_work' && c.targetTile?.x === tx && c.targetTile?.y === ty)).toBe(true);
  });
  it('does not target till/plant tiles in winter, but still targets a ready tile', () => {
    const s = createColony(1);
    const c0 = s.colonists[0];
    const tx = Math.round(c0.pos.x), ty = Math.round(c0.pos.y);
    setBiome(s.map, tx, ty, 'grass'); setPassable(s.map, tx, ty, true);
    s.fields.set(idx(tx, ty, s.map.w), { crop: 'wheat', stage: 'till', progress: 0 });
    s.env.season = 'winter';
    s.colonists.forEach((c) => {
      c.task = 'idle';
      (['woodcut', 'forage', 'mine', 'research', 'build', 'tailor'] as const).forEach((j) => (c.priorities[j] = 0));
      c.priorities.farm = 3;
    });
    runJobScheduler(s);
    expect(s.colonists.some((c) => c.task === 'goto_work')).toBe(false);
    s.fields.set(idx(tx, ty, s.map.w), { crop: 'wheat', stage: 'ready', progress: 0 });
    runJobScheduler(s);
    expect(s.colonists.some((c) => c.task === 'goto_work' && c.targetTile?.x === tx && c.targetTile?.y === ty)).toBe(true);
  });
});
