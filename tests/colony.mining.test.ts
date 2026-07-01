import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { runJobScheduler } from '@/games/colony/systems/jobScheduler';
import { setNode, idx, setBiome, biomeAt, nodeAt, setPassable } from '@/games/colony/systems/grid';
import { runWork } from '@/games/colony/systems/work';
import { tick } from '@/games/colony/systems/tick';
import { designate } from '@/games/colony/systems/designations';

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

describe('mining work', () => {
  it('mining a stone node yields stone; depletion clears node + designation; biome stays rock', () => {
    const s = createColony(5);
    const c = s.colonists[0];
    const tx = Math.round(c.pos.x), ty = Math.round(c.pos.y);
    setBiome(s.map, tx, ty, 'rock');
    setNode(s.map, tx, ty, { kind: 'stone', amount: 0.01, max: 20 }); // depletes in 1 tick
    s.designations.add(idx(tx, ty, s.map.w));
    c.task = 'work'; c.targetTile = { x: tx, y: ty }; c.targetBuildingId = undefined; c.pos = { x: tx, y: ty };
    const stone0 = s.resources.stone.amount;
    runWork(s);
    expect(s.resources.stone.amount).toBeGreaterThan(stone0);
    expect(nodeAt(s.map, tx, ty)).toBeUndefined();
    expect(s.designations.has(idx(tx, ty, s.map.w))).toBe(false);
    expect(biomeAt(s.map, tx, ty)).toBe('rock'); // ore leaves rock, not grass
  });
  it('foraging berries yields food', () => {
    const s = createColony(6);
    const c = s.colonists[0];
    const tx = Math.round(c.pos.x), ty = Math.round(c.pos.y);
    setNode(s.map, tx, ty, { kind: 'berries', amount: 5, max: 5 });
    s.designations.add(idx(tx, ty, s.map.w));
    c.task = 'work'; c.targetTile = { x: tx, y: ty }; c.targetBuildingId = undefined; c.pos = { x: tx, y: ty };
    const food0 = s.resources.food.amount;
    runWork(s);
    expect(s.resources.food.amount).toBeGreaterThan(food0);
  });
});

describe('mine targeting requires passability', () => {
  it('does not target ore on an impassable mountain tile; becomes targetable once passable', () => {
    const s = createColony(7);
    const c0 = s.colonists[0];
    const tx = Math.round(c0.pos.x) + 1, ty = Math.round(c0.pos.y);
    setBiome(s.map, tx, ty, 'mountain');
    setPassable(s.map, tx, ty, false);
    setNode(s.map, tx, ty, { kind: 'iron', amount: 20, max: 20 });
    s.designations.add(idx(tx, ty, s.map.w));
    s.colonists.forEach((c) => {
      c.task = 'idle';
      (['farm', 'forage', 'woodcut', 'research', 'build', 'tailor'] as const).forEach((j) => (c.priorities[j] = 0));
      c.priorities.mine = 3;
    });
    runJobScheduler(s);
    expect(s.colonists.some((c) => c.targetTile?.x === tx && c.targetTile?.y === ty)).toBe(false);
    // a tunnel (or any means) opens the tile — now it's a valid mine target
    setPassable(s.map, tx, ty, true);
    s.colonists.forEach((c) => { c.task = 'idle'; });
    runJobScheduler(s);
    expect(s.colonists.some((c) => c.targetTile?.x === tx && c.targetTile?.y === ty)).toBe(true);
  });
});

describe('mining determinism', () => {
  it('a run with designations + mining is deterministic and exception-free', () => {
    const build = (seed: number) => {
      const s = createColony(seed);
      designate(s, { x0: 0, y0: 0, x1: s.map.w - 1, y1: s.map.h - 1 }, 'mine');
      designate(s, { x0: 0, y0: 0, x1: s.map.w - 1, y1: s.map.h - 1 }, 'chop');
      designate(s, { x0: 0, y0: 0, x1: s.map.w - 1, y1: s.map.h - 1 }, 'forage');
      s.colonists.forEach((c) => { c.priorities.mine = 3; c.priorities.woodcut = 3; c.priorities.forage = 3; });
      return s;
    };
    const a = build(2024), b = build(2024);
    for (let i = 0; i < 300; i++) { tick(a); tick(b); }
    expect(a.resources.stone.amount).toBe(b.resources.stone.amount);
    expect(a.resources.wood.amount).toBe(b.resources.wood.amount);
    expect(a.colonists.map((c) => `${c.pos.x.toFixed(3)},${c.pos.y.toFixed(3)}`))
      .toEqual(b.colonists.map((c) => `${c.pos.x.toFixed(3)},${c.pos.y.toFixed(3)}`));
  }, 30000);
});
