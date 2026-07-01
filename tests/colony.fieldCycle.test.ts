import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { runJobScheduler } from '@/games/colony/systems/jobScheduler';
import { setBiome, setPassable, idx } from '@/games/colony/systems/grid';
import { runWork, advanceGrowth, killUnripeCrops } from '@/games/colony/systems/work';
import { fertilityAt, setFertility } from '@/games/colony/systems/grid';
import { TILL_REQUIRED, PLANT_REQUIRED, HARVEST_REQUIRED, CROP_GROWTH_TICKS } from '@/games/colony/data/balance';

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

describe('field labor cycle', () => {
  it('till -> plant -> grow -> ready -> harvest, yields food and depletes fertility for wheat', () => {
    const s = createColony(5);
    const c = s.colonists[0];
    const tx = Math.round(c.pos.x), ty = Math.round(c.pos.y);
    setBiome(s.map, tx, ty, 'grass'); setPassable(s.map, tx, ty, true);
    setFertility(s.map, tx, ty, 0.5);
    s.fields.set(idx(tx, ty, s.map.w), { crop: 'wheat', stage: 'till', progress: 0 });
    c.task = 'work'; c.targetTile = { x: tx, y: ty }; c.targetBuildingId = undefined; c.pos = { x: tx, y: ty };

    for (let i = 0; i < TILL_REQUIRED * 4; i++) runWork(s); // *4: TILL_BASE=0.5/tick headroom
    expect(s.fields.get(idx(tx, ty, s.map.w))!.stage).toBe('plant');
    // runWork's finishWork cleared task+targetTile on the till->plant transition — re-arm the colonist.
    c.task = 'work'; c.targetTile = { x: tx, y: ty };

    for (let i = 0; i < PLANT_REQUIRED * 4; i++) runWork(s);
    expect(s.fields.get(idx(tx, ty, s.map.w))!.stage).toBe('grow');
    c.task = 'work'; c.targetTile = { x: tx, y: ty };

    for (let i = 0; i < CROP_GROWTH_TICKS.wheat + 1; i++) advanceGrowth(s);
    expect(s.fields.get(idx(tx, ty, s.map.w))!.stage).toBe('ready');

    const food0 = s.resources.food.amount;
    c.task = 'work'; c.targetTile = { x: tx, y: ty };
    for (let i = 0; i < HARVEST_REQUIRED * 4; i++) runWork(s);
    expect(s.resources.food.amount).toBeGreaterThan(food0);
    expect(s.fields.get(idx(tx, ty, s.map.w))!.stage).toBe('till');
    expect(fertilityAt(s.map, tx, ty)).toBeCloseTo(0.44, 5); // 0.5 - 0.06 (wheat)
  });

  it('flax harvest yields fiber, not food', () => {
    const s = createColony(6);
    const c = s.colonists[0];
    const tx = Math.round(c.pos.x), ty = Math.round(c.pos.y);
    setFertility(s.map, tx, ty, 0.5);
    s.fields.set(idx(tx, ty, s.map.w), { crop: 'flax', stage: 'ready', progress: 0 });
    c.task = 'work'; c.targetTile = { x: tx, y: ty }; c.targetBuildingId = undefined; c.pos = { x: tx, y: ty };
    const fiber0 = s.resources.fiber.amount;
    for (let i = 0; i < HARVEST_REQUIRED * 4; i++) runWork(s);
    expect(s.resources.fiber.amount).toBeGreaterThan(fiber0);
  });

  it('legume harvest raises fertility (crop rotation payoff)', () => {
    const s = createColony(7);
    const c = s.colonists[0];
    const tx = Math.round(c.pos.x), ty = Math.round(c.pos.y);
    setFertility(s.map, tx, ty, 0.5);
    s.fields.set(idx(tx, ty, s.map.w), { crop: 'legume', stage: 'ready', progress: 0 });
    c.task = 'work'; c.targetTile = { x: tx, y: ty }; c.targetBuildingId = undefined; c.pos = { x: tx, y: ty };
    for (let i = 0; i < HARVEST_REQUIRED * 4; i++) runWork(s);
    expect(fertilityAt(s.map, tx, ty)).toBeCloseTo(0.58, 5); // 0.5 + 0.08 (legume)
  });

  it('winter onset destroys an unripe (grow-stage) crop, resetting it to till with no fertility penalty', () => {
    const s = createColony(8);
    const tx = 40, ty = 40;
    setFertility(s.map, tx, ty, 0.4);
    s.fields.set(idx(tx, ty, s.map.w), { crop: 'potato', stage: 'grow', progress: 10 });
    killUnripeCrops(s);
    const plot = s.fields.get(idx(tx, ty, s.map.w))!;
    expect(plot.stage).toBe('till');
    expect(plot.progress).toBe(0);
    expect(fertilityAt(s.map, tx, ty)).toBeCloseTo(0.4, 5);
  });
});
