import { describe, expect, it } from 'vitest';
import { entityDepth, nodeSpriteKey } from '@/games/colony/scenes/render/SpriteLayer';
describe('SpriteLayer helpers', () => {
  it('entityDepth increases with world-y (lower on screen = front)', () => {
    expect(entityDepth(100)).toBeGreaterThan(entityDepth(50));
  });
  it('nodeSpriteKey maps node kinds to sprite groups', () => {
    expect(nodeSpriteKey('wood')).toBe('tree');
    expect(nodeSpriteKey('stone')).toBe('rock');
    expect(nodeSpriteKey('iron')).toBe('rock');
    expect(nodeSpriteKey('gold')).toBe('rock');
    expect(nodeSpriteKey('berries')).toBe('berry');
    expect(nodeSpriteKey('fish')).toBeNull(); // fish not drawn as a land sprite
    expect(nodeSpriteKey('clay')).toBeNull();
  });
});
