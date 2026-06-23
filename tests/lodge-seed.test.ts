import { describe, expect, it } from 'vitest';
import { makeRng, randInt, shuffle } from '@/games/lodge/engine/seed';
import { arrEq, normEdge, edgeSetEq, fnv1a, chooseOwners } from '@/games/lodge/engine/util';

describe('makeRng', () => {
  it('is deterministic for a given seed', () => {
    const a = Array.from({ length: 5 }, makeRng(42));
    const b = Array.from({ length: 5 }, makeRng(42));
    expect(a).toEqual(b);
  });

  it('differs across seeds', () => {
    expect(makeRng(1)()).not.toEqual(makeRng(2)());
  });

  it('randInt stays in range', () => {
    const rng = makeRng(7);
    for (let i = 0; i < 50; i++) {
      const n = randInt(rng, 6);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(6);
    }
  });

  it('shuffle is a deterministic permutation', () => {
    const src = [0, 1, 2, 3, 4];
    const s1 = shuffle(makeRng(9), src);
    const s2 = shuffle(makeRng(9), src);
    expect(s1).toEqual(s2);
    expect([...s1].sort()).toEqual(src);
    expect(src).toEqual([0, 1, 2, 3, 4]); // input not mutated
  });
});

describe('util helpers', () => {
  it('arrEq compares by value', () => {
    expect(arrEq([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(arrEq([1, 2], [1, 2, 3])).toBe(false);
  });

  it('normEdge sorts endpoints', () => {
    expect(normEdge(3, 1)).toEqual([1, 3]);
  });

  it('edgeSetEq ignores order and direction', () => {
    expect(edgeSetEq([[0, 1], [2, 3]], [[3, 2], [1, 0]])).toBe(true);
    expect(edgeSetEq([[0, 1]], [[0, 2]])).toBe(false);
  });

  it('fnv1a is stable and sensitive', () => {
    expect(fnv1a('abc')).toBe(fnv1a('abc'));
    expect(fnv1a('abc')).not.toBe(fnv1a('abd'));
  });

  it('chooseOwners always returns distinct roles', () => {
    const rng = makeRng(3);
    for (let i = 0; i < 20; i++) {
      const { clueOwner, lockOwner } = chooseOwners(rng);
      expect(clueOwner).not.toBe(lockOwner);
    }
  });
});
