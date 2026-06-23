import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { stepAgents } from '@/games/colony/systems/agent';

describe('agent movement', () => {
  it('advances a colonist along its path and arrives at work', () => {
    const s = createColony(1);
    const c = s.colonists[0];
    c.task = 'goto_work';
    c.pos = { x: 0, y: 0 };
    c.path = [{ x: 1, y: 0 }, { x: 2, y: 0 }];
    // Прогоняем достаточно тиков, чтобы дойти.
    for (let i = 0; i < 100 && c.task === 'goto_work'; i++) stepAgents(s);
    expect(c.task).toBe('work');
    expect(c.path).toHaveLength(0);
    expect(Math.round(c.pos.x)).toBe(2);
  });

  it('transitions goto_eat -> eat on arrival', () => {
    const s = createColony(1);
    const c = s.colonists[0];
    c.task = 'goto_eat';
    c.pos = { x: 0, y: 0 };
    c.path = [{ x: 1, y: 0 }];
    for (let i = 0; i < 100 && c.task === 'goto_eat'; i++) stepAgents(s);
    expect(c.task).toBe('eat');
  });

  it('does nothing for idle/working colonists', () => {
    const s = createColony(1);
    const c = s.colonists[0];
    c.task = 'work';
    const pos = { ...c.pos };
    stepAgents(s);
    expect(c.pos).toEqual(pos);
  });
});
