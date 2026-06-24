import { describe, expect, it } from 'vitest';
import { SYMBOLS, ROLES, DIFFICULTY } from '@/games/lodge/engine/types';

describe('lodge constants', () => {
  it('symbols are unique', () => {
    expect(new Set(SYMBOLS).size).toBe(SYMBOLS.length);
    expect(SYMBOLS.length).toBeGreaterThanOrEqual(8);
  });

  it('roles are exactly A and B', () => {
    expect([...ROLES]).toEqual(['A', 'B']);
  });

  it('difficulty lengths increase gentle < standard < devious', () => {
    expect(DIFFICULTY.gentle.dialLen).toBeLessThan(DIFFICULTY.standard.dialLen);
    expect(DIFFICULTY.standard.dialLen).toBeLessThan(DIFFICULTY.devious.dialLen);
  });
});
