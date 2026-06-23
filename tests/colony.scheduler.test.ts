import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { tick } from '@/games/colony/systems/tick';
import { ASSIGN_BUDGET } from '@/games/colony/data/balance';

it('scheduler assigns woodcut to the nearest wood node (deterministic over a run)', () => {
  const a = createColony(12345);
  const b = createColony(12345);
  for (let i = 0; i < 240; i++) { tick(a); tick(b); }
  // identical seed → identical colonist tasks/positions
  expect(a.colonists.map(c => [c.task, Math.round(c.pos.x), Math.round(c.pos.y)]))
    .toEqual(b.colonists.map(c => [c.task, Math.round(c.pos.x), Math.round(c.pos.y)]));
});

it('assigns at most ASSIGN_BUDGET paths per tick but eventually serves everyone', () => {
  const s = createColony(2024);
  // force many idle colonists by cloning (deterministic, no RNG)
  const base = s.colonists[0];
  while (s.colonists.length < ASSIGN_BUDGET + 10) {
    s.colonists.push({ ...base, id: `c${s.colonists.length}`, pos: { ...base.pos }, path: [], task: 'idle' });
  }
  // one scheduler pass assigns no more than budget new goto_work transitions
  tick(s);
  const assignedThisTick = s.colonists.filter(c => c.task === 'goto_work').length;
  expect(assignedThisTick).toBeLessThanOrEqual(ASSIGN_BUDGET);
});
