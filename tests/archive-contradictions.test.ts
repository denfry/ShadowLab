import { describe, expect, it } from 'vitest';
import { sameRef, matchContradiction } from '@/games/shadow-trace/archive/contradictions';
import { sampleArchiveCase } from './fixtures/sample-archive-case';
import type { FactRef } from '@/games/shadow-trace/archive/types';

const eronClaim: FactRef = { kind: 'recordClaim', recordId: 'r_eron', claimId: 'home' };
const logMeta: FactRef = { kind: 'metadata', recordId: 'r_access_log', field: 'time' };

describe('sameRef', () => {
  it('compares by kind and ids', () => {
    expect(sameRef(eronClaim, { kind: 'recordClaim', recordId: 'r_eron', claimId: 'home' })).toBe(true);
    expect(sameRef(eronClaim, { kind: 'recordClaim', recordId: 'r_eron', claimId: 'away' })).toBe(false);
    expect(sameRef(eronClaim, logMeta)).toBe(false);
    expect(sameRef({ kind: 'entity', entityId: 's_eron' }, { kind: 'entity', entityId: 's_eron' })).toBe(true);
  });
});

describe('matchContradiction', () => {
  it('matches an authored pair order-independently', () => {
    expect(matchContradiction(sampleArchiveCase, eronClaim, logMeta)?.id).toBe('c_time');
    expect(matchContradiction(sampleArchiveCase, logMeta, eronClaim)?.id).toBe('c_time');
  });
  it('returns null for an unrelated pair or a self-pair', () => {
    expect(matchContradiction(sampleArchiveCase, eronClaim, eronClaim)).toBeNull();
    expect(
      matchContradiction(sampleArchiveCase, logMeta, { kind: 'metadata', recordId: 'r_cctv_photo', field: 'time' }),
    ).toBeNull();
  });
});
