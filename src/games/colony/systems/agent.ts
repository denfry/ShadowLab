import type { Colonist, ColonyState, TaskKind } from '../domain/types';
import { ARRIVE_EPS, MOVE_SPEED } from '../data/balance';

const ARRIVAL: Partial<Record<TaskKind, TaskKind>> = {
  goto_work: 'work',
  goto_eat: 'eat',
  goto_sleep: 'sleep',
};

function advance(c: Colonist): void {
  if (c.path.length === 0) return;
  const next = c.path[0];
  const dx = next.x - c.pos.x;
  const dy = next.y - c.pos.y;
  const d = Math.hypot(dx, dy);
  if (d <= MOVE_SPEED + ARRIVE_EPS) {
    c.pos = { x: next.x, y: next.y };
    c.path.shift();
  } else {
    c.pos = { x: c.pos.x + (dx / d) * MOVE_SPEED, y: c.pos.y + (dy / d) * MOVE_SPEED };
  }
}

/** Двигает идущих колонистов; по достижении цели переключает задачу. Без RNG. */
export function stepAgents(s: ColonyState): void {
  for (const c of s.colonists) {
    if (!c.alive) continue;
    if (c.task !== 'goto_work' && c.task !== 'goto_eat' && c.task !== 'goto_sleep') continue;
    advance(c);
    if (c.path.length === 0) {
      c.task = ARRIVAL[c.task] ?? 'idle';
    }
  }
}
