import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { toSave, fromSave } from '@/games/colony/domain/save';
import { tick } from '@/games/colony/systems/tick';
describe('nav lifecycle', () => {
  it('createColony builds a nav with portals', () => {
    const s = createColony(7);
    expect(s.nav).toBeDefined();
    expect(s.nav!.portals.length).toBeGreaterThan(0);
  });
  it('nav is not serialized but rebuilt on load', () => {
    const s = createColony(7);
    const save = toSave(s) as any;
    expect(save.nav).toBeUndefined();
    const loaded = fromSave(toSave(s));
    expect(loaded.nav).toBeDefined();
    expect(loaded.nav!.portals.length).toBe(s.nav!.portals.length);
  });
  it('a run stays deterministic and exception-free with hierarchical routing', () => {
    const a = createColony(99), b = createColony(99);
    for (let i = 0; i < 480; i++) { tick(a); tick(b); }
    expect(a.colonists.map(c => [c.task, c.path.length])).toEqual(b.colonists.map(c => [c.task, c.path.length]));
  }, 30000);
});
