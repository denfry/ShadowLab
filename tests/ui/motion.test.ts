import { describe, it, expect } from 'vitest';
import { motionAllowed } from '@/ui/motion';

describe('motionAllowed', () => {
  it('allows motion when neither reduced source is set', () => {
    expect(motionAllowed(false, false)).toBe(true);
  });
  it('blocks motion when OS prefers reduced', () => {
    expect(motionAllowed(true, false)).toBe(false);
  });
  it('blocks motion when the in-app setting is on', () => {
    expect(motionAllowed(false, true)).toBe(false);
  });
  it('blocks motion when both are set', () => {
    expect(motionAllowed(true, true)).toBe(false);
  });
});
