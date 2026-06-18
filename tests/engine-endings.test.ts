import { describe, expect, it } from 'vitest';
import { resolveEnding, scoreCaseV2 } from '@/games/shadow-trace/engine/endings';
import { createCaseProgress } from '@/games/shadow-trace/engine/state';
import { addLink } from '@/games/shadow-trace/engine/contradictions';
import { sampleCase } from './fixtures/sample-case-v2';
import type { CaseProgressV2, FactRef } from '@/games/shadow-trace/engine/types';

const stRef: FactRef = { type: 'statement', refId: 'st_eron_home' };
const metaRef: FactRef = { type: 'metadata', refId: 'e_photo' };

/** A fully-solved run: contradiction found, lab flag set, correct accusation, fake flagged. */
function solved(): CaseProgressV2 {
  let p = createCaseProgress(sampleCase);
  p = addLink(sampleCase, p, { fromRef: stRef, toRef: metaRef, relation: 'contradicts' });
  p = { ...p, flags: { ...p.flags, lab_done: true } };
  p = { ...p, accusation: { culpritId: 's_eron', fakeEvidenceIds: ['e_photo'], keyContradictionIds: ['c_time'] } };
  return p;
}

describe('resolveEnding', () => {
  it('returns the first ending whose requires holds (truth for a full solve)', () => {
    expect(resolveEnding(sampleCase, solved()).id).toBe('end_truth');
  });

  it('falls through to partial when the proof is incomplete', () => {
    const p = { ...createCaseProgress(sampleCase), accusation: { culpritId: 's_eron', fakeEvidenceIds: [], keyContradictionIds: [] } };
    expect(resolveEnding(sampleCase, p).id).toBe('end_partial');
  });

  it('returns miscarriage when accusing the innocent', () => {
    const p = { ...createCaseProgress(sampleCase), accusation: { culpritId: 's_mara', fakeEvidenceIds: [], keyContradictionIds: [] } };
    expect(resolveEnding(sampleCase, p).id).toBe('end_miscarriage');
  });

  it('returns cold_case catch-all with no accusation', () => {
    expect(resolveEnding(sampleCase, createCaseProgress(sampleCase)).quality).toBe('cold_case');
  });

  it('uses the synthetic cold_case fallback when no ending matches', () => {
    const noEndings = { ...sampleCase, endings: [] };
    const r = resolveEnding(noEndings, createCaseProgress(sampleCase));
    expect(r.id).toBe('cold_case_default');
    expect(r.quality).toBe('cold_case');
  });
});

describe('scoreCaseV2', () => {
  it('gives a perfect S for a full solve and carries campaign flags', () => {
    const r = scoreCaseV2(sampleCase, solved());
    expect(r.accusationQuality).toBe('truth');
    expect(r.contradictionsFound).toBe(1);
    expect(r.contradictionsTotal).toBe(1);
    expect(r.fakesIdentified).toBe(1);
    expect(r.fakesTotal).toBe(1);
    expect(r.correctLinks).toBe(1);
    expect(r.falseLinks).toBe(0);
    expect(r.rank).toBe('S');
    expect(r.score).toBe(100);
    expect(r.flagsForCampaign).toEqual(['eron_jailed']);
  });

  it('penalises false contradicts links', () => {
    let p = solved();
    p = addLink(sampleCase, p, { fromRef: stRef, toRef: { type: 'evidence', refId: 'e_log' }, relation: 'contradicts' });
    const r = scoreCaseV2(sampleCase, p);
    expect(r.falseLinks).toBe(1);
    expect(r.score).toBe(90);
    expect(r.rank).toBe('A');
  });

  it('scores a miscarriage low', () => {
    const p = { ...createCaseProgress(sampleCase), accusation: { culpritId: 's_mara', fakeEvidenceIds: [], keyContradictionIds: [] } };
    const r = scoreCaseV2(sampleCase, p);
    expect(r.accusationQuality).toBe('miscarriage');
    expect(r.rank).toBe('F');
  });
});
