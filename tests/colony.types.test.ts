import { describe, expect, it } from 'vitest';
import { TRAITS, TRAIT_IDS } from '@/games/colony/domain/traits';
import { SKILL_IDS, emptySkills, grantXp, skillMultiplier } from '@/games/colony/domain/skills';

describe('domain primitives', () => {
  it('exposes every trait by its id', () => {
    for (const id of TRAIT_IDS) expect(TRAITS[id].id).toBe(id);
  });

  it('starts every skill at level 0', () => {
    const s = emptySkills();
    expect(SKILL_IDS.every((id) => s[id].level === 0 && s[id].xp === 0)).toBe(true);
  });

  it('levels a skill every 100 xp', () => {
    const s = emptySkills();
    grantXp(s.farming, 250);
    expect(s.farming.level).toBe(2);
    expect(s.farming.xp).toBe(50);
  });

  it('skill multiplier grows with level', () => {
    expect(skillMultiplier(0)).toBeCloseTo(1.0, 5);
    expect(skillMultiplier(5)).toBeCloseTo(1.4, 5);
  });

  it('Tile несёт биом, высоту и опц. узел ресурса', () => {
    const t: import('@/games/colony/domain/types').Tile = {
      x: 0, y: 0, biome: 'forest', elevation: 0.5, fertility: 0.4,
      passable: true, roomId: 0, temp: 16, node: { kind: 'wood', amount: 30, max: 30 },
    };
    expect(t.biome).toBe('forest');
    expect(t.node?.kind).toBe('wood');
  });
});
