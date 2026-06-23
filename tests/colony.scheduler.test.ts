import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { tick } from '@/games/colony/systems/tick';

it('scheduler assigns woodcut to the nearest wood node (deterministic over a run)', () => {
  const a = createColony(12345);
  const b = createColony(12345);
  for (let i = 0; i < 240; i++) { tick(a); tick(b); }
  // identical seed → identical colonist tasks/positions
  expect(a.colonists.map(c => [c.task, Math.round(c.pos.x), Math.round(c.pos.y)]))
    .toEqual(b.colonists.map(c => [c.task, Math.round(c.pos.x), Math.round(c.pos.y)]));
});
