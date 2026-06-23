import { describe, expect, it } from 'vitest';
import { LODGE_DEFINITION } from '@/games/lodge/definition';

describe('LODGE_DEFINITION', () => {
  it('is a valid, available portal entry on the shadow theme', () => {
    expect(LODGE_DEFINITION.id).toBe('lodge');
    expect(LODGE_DEFINITION.theme).toBe('shadow');
    expect(LODGE_DEFINITION.status).toBe('available');
    expect(LODGE_DEFINITION.title.length).toBeGreaterThan(0);
    expect(LODGE_DEFINITION.tagline.length).toBeGreaterThan(0);
    expect(LODGE_DEFINITION.description.length).toBeGreaterThan(0);
    expect(LODGE_DEFINITION.bootHint.length).toBeGreaterThan(0);
    expect(LODGE_DEFINITION.tags.length).toBeGreaterThan(0);
  });
});
