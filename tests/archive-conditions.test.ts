import { describe, expect, it } from 'vitest';
import { evaluateArchiveCondition, isContradictionNoticed } from '@/games/shadow-trace/archive/conditions';
import { createArchiveProgress, accuse } from '@/games/shadow-trace/archive/state';
import { pinRecord, markSuspicion } from '@/games/shadow-trace/archive/casefile';
import { sampleArchiveCase } from './fixtures/sample-archive-case';
import type { FactRef } from '@/games/shadow-trace/archive/types';

const cTime = sampleArchiveCase.contradictions.find((c) => c.id === 'c_time')!;
const lie: [FactRef, FactRef] = [
  { kind: 'recordClaim', recordId: 'r_eron', claimId: 'home' },
  { kind: 'metadata', recordId: 'r_access_log', field: 'time' },
];

describe('isContradictionNoticed', () => {
  it('is true once both referenced records are pinned or suspected', () => {
    let p = createArchiveProgress(sampleArchiveCase);
    expect(isContradictionNoticed(cTime, p)).toBe(false);
    p = pinRecord(p, 'r_eron');
    expect(isContradictionNoticed(cTime, p)).toBe(false); // only one side
    p = markSuspicion(p, 'r_access_log');
    expect(isContradictionNoticed(cTime, p)).toBe(true);
  });
});

describe('evaluateArchiveCondition', () => {
  it('evaluates accuse / decisiveLie / noticedContradiction / hasKey and combinators', () => {
    let p = createArchiveProgress(sampleArchiveCase);
    p = pinRecord(pinRecord(p, 'r_eron'), 'r_access_log');
    p = accuse(p, { culpritEntityId: 's_eron', decisiveLie: lie });

    expect(evaluateArchiveCondition({ accuse: 's_eron' }, sampleArchiveCase, p)).toBe(true);
    expect(evaluateArchiveCondition({ accuse: 's_mara' }, sampleArchiveCase, p)).toBe(false);
    expect(evaluateArchiveCondition({ decisiveLie: 'c_time' }, sampleArchiveCase, p)).toBe(true);
    expect(evaluateArchiveCondition({ decisiveLie: 'c_photo' }, sampleArchiveCase, p)).toBe(false);
    expect(evaluateArchiveCondition({ noticedContradiction: 'c_time' }, sampleArchiveCase, p)).toBe(true);
    expect(evaluateArchiveCondition({ hasKey: 'k_archive' }, sampleArchiveCase, p)).toBe(false);
    expect(
      evaluateArchiveCondition({ all: [{ accuse: 's_eron' }, { decisiveLie: 'c_time' }] }, sampleArchiveCase, p),
    ).toBe(true);
    expect(evaluateArchiveCondition({ not: { accuse: 's_mara' } }, sampleArchiveCase, p)).toBe(true);
    expect(evaluateArchiveCondition({ all: [] }, sampleArchiveCase, p)).toBe(true);
  });
});
