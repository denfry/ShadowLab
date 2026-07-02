import { describe, expect, it } from 'vitest';
import { fieldColor } from '@/games/colony/scenes/render/FieldLayer';

describe('field overlay color', () => {
  it('maps stage to a color; grow interpolates by progress fraction', () => {
    expect(fieldColor({ crop: 'wheat', stage: 'till', progress: 0 }, 720)).toBe(0x6b4a2f);
    expect(fieldColor({ crop: 'wheat', stage: 'plant', progress: 0 }, 720)).toBe(0x7a5a3a);
    expect(fieldColor({ crop: 'wheat', stage: 'ready', progress: 0 }, 720)).toBe(0xe8c23a);
    expect(fieldColor({ crop: 'wheat', stage: 'grow', progress: 0 }, 720)).toBe(0x5a6b2f);
    expect(fieldColor({ crop: 'wheat', stage: 'grow', progress: 720 }, 720)).toBe(0x84de5a);
  });
});
