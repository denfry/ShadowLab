import { describe, expect, it } from 'vitest';
import {
  matchContradiction,
  discoverContradiction,
  addLink,
} from '@/games/shadow-trace/engine/contradictions';
import { createCaseProgress } from '@/games/shadow-trace/engine/state';
import { sampleCase } from './fixtures/sample-case-v2';
import type { FactRef } from '@/games/shadow-trace/engine/types';

const stRef: FactRef = { type: 'statement', refId: 'st_eron_home' };
const metaRef: FactRef = { type: 'metadata', refId: 'e_photo' };

describe('matchContradiction', () => {
  it('matches a pair regardless of order', () => {
    expect(matchContradiction(sampleCase, stRef, metaRef)?.id).toBe('c_time');
    expect(matchContradiction(sampleCase, metaRef, stRef)?.id).toBe('c_time');
  });

  it('returns null for an unrelated pair', () => {
    expect(matchContradiction(sampleCase, stRef, { type: 'evidence', refId: 'e_log' })).toBeNull();
  });

  it('never matches a self-pair', () => {
    expect(matchContradiction(sampleCase, stRef, stRef)).toBeNull();
  });
});

describe('discoverContradiction', () => {
  it('marks found and applies unlocks (opens n_lab)', () => {
    const p = createCaseProgress(sampleCase);
    expect(p.openNodes).not.toContain('n_lab');
    const next = discoverContradiction(sampleCase, p, 'c_time');
    expect(next.foundContradictions).toContain('c_time');
    expect(next.openNodes).toContain('n_lab');
  });

  it('is a no-op when already found', () => {
    const p = discoverContradiction(sampleCase, createCaseProgress(sampleCase), 'c_time');
    const again = discoverContradiction(sampleCase, p, 'c_time');
    expect(again).toBe(p);
  });
});

describe('addLink', () => {
  it('discovers the contradiction on a correct contradicts link', () => {
    const p = createCaseProgress(sampleCase);
    const next = addLink(sampleCase, p, { fromRef: stRef, toRef: metaRef, relation: 'contradicts' });
    expect(next.links).toHaveLength(1);
    expect(next.foundContradictions).toContain('c_time');
  });

  it('keeps a wrong contradicts link as a harmless hypothesis', () => {
    const p = createCaseProgress(sampleCase);
    const next = addLink(sampleCase, p, {
      fromRef: stRef,
      toRef: { type: 'evidence', refId: 'e_log' },
      relation: 'contradicts',
    });
    expect(next.links).toHaveLength(1);
    expect(next.foundContradictions).toEqual([]);
  });

  it('does not match contradictions for non-contradicts relations', () => {
    const p = createCaseProgress(sampleCase);
    const next = addLink(sampleCase, p, { fromRef: stRef, toRef: metaRef, relation: 'supports' });
    expect(next.foundContradictions).toEqual([]);
  });

  it('ignores a duplicate link regardless of order (no double-count)', () => {
    const p = createCaseProgress(sampleCase);
    const once = addLink(sampleCase, p, { fromRef: stRef, toRef: metaRef, relation: 'contradicts' });
    const twice = addLink(sampleCase, once, { fromRef: metaRef, toRef: stRef, relation: 'contradicts' });
    expect(twice).toBe(once);
    expect(twice.links).toHaveLength(1);
  });
});
