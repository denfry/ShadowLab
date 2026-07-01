import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { runJobScheduler } from '@/games/colony/systems/jobScheduler';
import { setNode, passableAt, neighbors4, idx } from '@/games/colony/systems/grid';
import { pickStartSite } from '@/games/colony/domain/worldgen';

function nearbyPassable(s: ReturnType<typeof createColony>, dx: number, dy: number): { x: number; y: number } {
  const start = pickStartSite(s.map);
  for (let r = 1; r <= 10; r++) {
    const x = start.x + dx * r, y = start.y + dy * r;
    if (passableAt(s.map, x, y)) return { x, y };
  }
  for (const n of neighbors4(start.x, start.y, s.map)) {
    if (passableAt(s.map, n.x, n.y)) return { x: n.x, y: n.y };
  }
  return start;
}

describe('job scheduler', () => {
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
    const t = nearbyPassable(s, 1, 0);
    s.buildings.push({ id: 't1', type: 'tailor', tile: { x: t.x, y: t.y }, workSlots: 2, jobType: 'tailor', built: true, buildProgress: 30, buildRequired: 30 });
    s.colonists.forEach((c) => { c.task = 'idle'; (['farm','woodcut','research','build','tailor'] as const).forEach((j) => (c.priorities[j] = 0)); c.priorities.tailor = 3; });
    runJobScheduler(s);
    expect(s.colonists.some((c) => c.targetBuildingId === 't1' && c.task === 'goto_work')).toBe(true);
  });

  it('assigns a woodcutter to a wood node placed via setNode', () => {
    const s = createColony(1);
    const c0 = s.colonists[0];
    const tx = Math.round(c0.pos.x);
    const ty = Math.round(c0.pos.y);
    setNode(s.map, tx, ty, { kind: 'wood', amount: 30, max: 30 });
    s.designations.add(idx(tx, ty, s.map.w));
    s.colonists.forEach((c) => {
      c.task = 'idle';
      (['farm', 'research', 'build', 'tailor'] as const).forEach((j) => (c.priorities[j] = 0));
      c.priorities.woodcut = 3;
    });
    runJobScheduler(s);
    expect(s.colonists.some((c) => c.task === 'goto_work' && c.targetTile?.x === tx && c.targetTile?.y === ty)).toBe(true);
  });
});
