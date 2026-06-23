import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { runJobScheduler } from '@/games/colony/systems/jobScheduler';
import type { Building } from '@/games/colony/domain/types';
import { MAP_W, MAP_H } from '@/games/colony/data/balance';
import { setNode } from '@/games/colony/systems/grid';

const farmAt = (x: number, y: number): Building => ({
  id: 'farm1', type: 'farm', tile: { x, y }, workSlots: 3, jobType: 'farm',
  built: true, buildProgress: 30, buildRequired: 30,
});

describe('job scheduler', () => {
  it('assigns an idle colonist to an available farm', () => {
    const s = createColony(1);
    const cx = Math.floor(MAP_W / 2);
    const cy = Math.floor(MAP_H / 2);
    s.buildings.push(farmAt(cx + 1, cy));
    s.colonists.forEach((c) => { c.task = 'idle'; c.priorities.farm = 3; });
    runJobScheduler(s);
    const working = s.colonists.filter((c) => c.targetBuildingId === 'farm1');
    expect(working.length).toBeGreaterThan(0);
    expect(working[0].task).toBe('goto_work');
  });

  it('never assigns more workers than the building has slots', () => {
    const s = createColony(1);
    const cx = Math.floor(MAP_W / 2);
    const cy = Math.floor(MAP_H / 2);
    s.buildings.push(farmAt(cx + 1, cy));
    s.colonists.forEach((c) => { c.task = 'idle'; c.priorities.farm = 3; c.priorities.woodcut = 0; c.priorities.research = 0; c.priorities.build = 0; });
    runJobScheduler(s);
    expect(s.colonists.filter((c) => c.targetBuildingId === 'farm1').length).toBeLessThanOrEqual(3);
  });

  it('skips colonists whose only job priority is 0', () => {
    const s = createColony(1);
    s.colonists.forEach((c) => {
      c.task = 'idle';
      c.priorities.farm = 0; c.priorities.woodcut = 0; c.priorities.research = 0; c.priorities.build = 0;
    });
    runJobScheduler(s);
    expect(s.colonists.every((c) => c.task === 'idle')).toBe(true);
  });

  it('assigns a colonist to a tailor bench', () => {
    const s = createColony(1);
    const cx = Math.floor(MAP_W / 2), cy = Math.floor(MAP_H / 2);
    s.buildings.push({ id: 't1', type: 'tailor', tile: { x: cx + 1, y: cy }, workSlots: 2, jobType: 'tailor', built: true, buildProgress: 30, buildRequired: 30 });
    s.colonists.forEach((c) => { c.task = 'idle'; (['farm','woodcut','research','build','tailor'] as const).forEach((j) => (c.priorities[j] = 0)); c.priorities.tailor = 3; });
    runJobScheduler(s);
    expect(s.colonists.some((c) => c.targetBuildingId === 't1' && c.task === 'goto_work')).toBe(true);
  });

  it('assigns a woodcutter to a wood node placed via setNode', () => {
    const s = createColony(1);
    // Place the wood node on the tile the first colonist is standing on
    // (guaranteed passable by createColony) so pathfinding always succeeds.
    const c0 = s.colonists[0];
    const tx = Math.round(c0.pos.x);
    const ty = Math.round(c0.pos.y);
    setNode(s.map, tx, ty, { kind: 'wood', amount: 30, max: 30 });
    s.colonists.forEach((c) => {
      c.task = 'idle';
      (['farm', 'research', 'build', 'tailor'] as const).forEach((j) => (c.priorities[j] = 0));
      c.priorities.woodcut = 3;
    });
    runJobScheduler(s);
    expect(s.colonists.some((c) => c.task === 'goto_work' && c.targetTile?.x === tx && c.targetTile?.y === ty)).toBe(true);
  });
});
