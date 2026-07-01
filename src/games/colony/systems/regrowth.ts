import type { ColonyState } from '../domain/types';
import type { Rng } from '@/core/utils/rng';
import { REGROW_CHANCE_WOOD, WOOD_SAPLING_AMOUNT, BERRY_AMOUNT } from '../data/balance';
import { idx, nodeAt, setNode, biomeAt, buildingIdAt, neighbors4 } from './grid';

/** Раз в игровой день: живой wood-узел может засеять саженец на дикий соседний
 *  grass-тайл; истощённые ягодники, чей кулдаун вышел, восстанавливаются.
 *  Единственный источник случайности — переданный seeded Rng; порядок обхода
 *  Map/соседей фиксирован (детерминизм). */
export function runRegrowth(s: ColonyState, rng: Rng): void {
  for (const [i, node] of s.map.nodes) {
    if (node.kind !== 'wood' || node.amount <= 0) continue;
    if (!rng.chance(REGROW_CHANCE_WOOD)) continue;
    const x = i % s.map.w, y = Math.floor(i / s.map.w);
    for (const n of neighbors4(x, y, s.map)) {
      const ni = idx(n.x, n.y, s.map.w);
      if (biomeAt(s.map, n.x, n.y) !== 'grass') continue;
      if (buildingIdAt(s.map, n.x, n.y)) continue;
      if (s.fields.has(ni)) continue;
      if (nodeAt(s.map, n.x, n.y)) continue;
      setNode(s.map, n.x, n.y, { kind: 'wood', amount: WOOD_SAPLING_AMOUNT, max: WOOD_SAPLING_AMOUNT });
      break; // один саженец за узел за день
    }
  }
  for (const [i, daysLeft] of [...s.regrowCooldowns]) {
    const left = daysLeft - 1;
    if (left > 0) { s.regrowCooldowns.set(i, left); continue; }
    s.regrowCooldowns.delete(i);
    const x = i % s.map.w, y = Math.floor(i / s.map.w);
    if (buildingIdAt(s.map, x, y) || s.fields.has(i) || nodeAt(s.map, x, y)) continue;
    setNode(s.map, x, y, { kind: 'berries', amount: BERRY_AMOUNT, max: BERRY_AMOUNT });
  }
}
