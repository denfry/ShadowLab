import { describe, expect, it } from 'vitest';
import { designationColor } from '@/games/colony/scenes/render/DesignationLayer';

describe('designation overlay color', () => {
  it('maps node kinds to mode colors', () => {
    expect(designationColor('wood')).toBe(0x84de5a);                 // chop = green
    for (const k of ['stone', 'clay', 'iron', 'gold'] as const) {
      expect(designationColor(k)).toBe(0xe8a13a);                    // mine = orange
    }
    expect(designationColor('berries')).toBe(0xb46ed8);              // forage = purple
  });
});
