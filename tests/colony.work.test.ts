import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { runWork } from '@/games/colony/systems/work';
import type { Building } from '@/games/colony/domain/types';
import { MAP_W, MAP_H } from '@/games/colony/data/balance';
import { setNode, setBiome, nodeAt, biomeAt } from '@/games/colony/systems/grid';

const center = () => ({ x: Math.floor(MAP_W / 2), y: Math.floor(MAP_H / 2) });

describe('work system', () => {
  it('a farmer working at a farm raises food and gains farming xp', () => {
    const s = createColony(1);
    const t = center();
    const farm: Building = { id: 'f1', type: 'farm', tile: t, workSlots: 3, jobType: 'farm', built: true, buildProgress: 30, buildRequired: 30 };
    s.buildings.push(farm);
    s.map.tiles[t.y * MAP_W + t.x].buildingId = 'f1';
    const c = s.colonists[0];
    c.task = 'work'; c.targetBuildingId = 'f1'; c.targetTile = t; c.pos = { ...t };
    const food0 = s.resources.food.amount;
    const xp0 = c.skills.farming.xp + c.skills.farming.level * 100;
    runWork(s);
    expect(s.resources.food.amount).toBeGreaterThan(food0);
    expect(c.skills.farming.xp + c.skills.farming.level * 100).toBeGreaterThan(xp0);
  });

  it('chopping a forest tile yields wood and depletes the tile', () => {
    const s = createColony(1);
    const tx = Math.floor(MAP_W / 2), ty = Math.floor(MAP_H / 2);
    setBiome(s.map, tx, ty, 'forest');
    setNode(s.map, tx, ty, { kind: 'wood', amount: 0.01, max: 30 }); // почти пусто — истощится за 1 тик
    const c = s.colonists[0];
    c.task = 'work'; c.targetTile = { x: tx, y: ty }; c.targetBuildingId = undefined; c.pos = { x: tx, y: ty };
    const wood0 = s.resources.wood.amount;
    runWork(s);
    expect(s.resources.wood.amount).toBeGreaterThan(wood0);
    // делянка истощена → биом grass, узел очищен
    expect(biomeAt(s.map, tx, ty)).toBe('grass');
    expect(nodeAt(s.map, tx, ty)).toBeUndefined();
  });

  it('builds a blueprint to completion, then it becomes built', () => {
    const s = createColony(1);
    const t = center();
    const bp: Building = { id: 'b1', type: 'storage', tile: t, workSlots: 0, jobType: undefined, built: false, buildProgress: 0, buildRequired: 5 };
    s.buildings.push(bp);
    const c = s.colonists[0];
    c.task = 'work'; c.targetBuildingId = 'b1'; c.targetTile = t; c.pos = { ...t };
    for (let i = 0; i < 200 && !bp.built; i++) runWork(s);
    expect(bp.built).toBe(true);
    expect(c.task).toBe('idle'); // освободился после стройки
  });

  it('a farm on a frozen tile produces no food', () => {
    const s = createColony(1);
    const t = { x: Math.floor(s.map.w / 2), y: Math.floor(s.map.h / 2) };
    const farm = { id: 'f1', type: 'farm' as const, tile: t, workSlots: 3, jobType: 'farm' as const, built: true, buildProgress: 30, buildRequired: 30 };
    s.buildings.push(farm);
    s.map.tiles[t.y * s.map.w + t.x].temp = -5; // мороз
    const c = s.colonists[0];
    c.task = 'work'; c.targetBuildingId = 'f1'; c.targetTile = t; c.pos = { ...t };
    const before = s.resources.food.amount;
    runWork(s);
    expect(s.resources.food.amount).toBe(before);
  });

  it('a tailor bench turns wood into clothing', () => {
    const s = createColony(1);
    const t = { x: Math.floor(s.map.w / 2), y: Math.floor(s.map.h / 2) };
    s.buildings.push({ id: 't1', type: 'tailor', tile: t, workSlots: 2, jobType: 'tailor', built: true, buildProgress: 30, buildRequired: 30 });
    s.resources.wood.amount = 100;
    const c = s.colonists[0];
    c.task = 'work'; c.targetBuildingId = 't1'; c.targetTile = t; c.pos = { ...t };
    const wood0 = s.resources.wood.amount;
    for (let i = 0; i < 400 && s.stock.clothing === 0; i++) runWork(s);
    expect(s.stock.clothing).toBeGreaterThan(0);
    expect(s.resources.wood.amount).toBeLessThan(wood0);
  });
});
