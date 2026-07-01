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
  it('excludes a grow-stage tile from targeting even when it is closer than a valid till-stage tile', () => {
    const s = createColony(1);
    const c0 = s.colonists[0];
    const tx = Math.round(c0.pos.x), ty = Math.round(c0.pos.y);
    setBiome(s.map, tx, ty, 'grass'); setPassable(s.map, tx, ty, true);
    setBiome(s.map, tx, ty + 1, 'grass'); setPassable(s.map, tx, ty + 1, true);
    // Grow-stage plot sits right under the colonist (distance 0) — closest possible target.
    s.fields.set(idx(tx, ty, s.map.w), { crop: 'wheat', stage: 'grow', progress: 0 });
    // Till-stage plot is one tile farther away — the only tile that should be indexed.
    s.fields.set(idx(tx, ty + 1, s.map.w), { crop: 'wheat', stage: 'till', progress: 0 });
    s.colonists.forEach((c) => {
      c.task = 'idle';
      (['woodcut', 'forage', 'mine', 'research', 'build', 'tailor'] as const).forEach((j) => (c.priorities[j] = 0));
      c.priorities.farm = 3;
    });
    runJobScheduler(s);
    // If the grow-stage tile were (wrongly) indexed, it would win as nearest (distance 0)
    // instead of the farther till-stage tile — so this also proves the exclusion is exercised.
    expect(s.colonists.some((c) => c.task === 'goto_work' && c.targetTile?.x === tx && c.targetTile?.y === ty + 1)).toBe(true);
    expect(s.colonists.some((c) => c.targetTile?.x === tx && c.targetTile?.y === ty)).toBe(false);
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
