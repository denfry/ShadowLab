import { describe, expect, it } from 'vitest';
import { resolveEnding, scoreCaseArchive, decisiveContradiction, checkAccusation } from '@/games/shadow-trace/archive/endings';
import { createArchiveProgress, openRecord, accuse } from '@/games/shadow-trace/archive/state';
import { pinRecord, markSuspicion } from '@/games/shadow-trace/archive/casefile';
import { sampleArchiveCase } from './fixtures/sample-archive-case';
import type { ArchiveProgress, FactRef } from '@/games/shadow-trace/archive/types';

const lie: [FactRef, FactRef] = [
  { kind: 'recordClaim', recordId: 'r_eron', claimId: 'home' },
  { kind: 'metadata', recordId: 'r_access_log', field: 'time' },
];

/** Walk the full solve: open the thread, unseal the log, pin the contradicting records. */
function solvedState(): ArchiveProgress {
  let p = createArchiveProgress(sampleArchiveCase);
  p = openRecord(sampleArchiveCase, p, 'r_cctv_photo');
  p = openRecord(sampleArchiveCase, p, 'r_chat_admin');
  p = openRecord(sampleArchiveCase, p, 'r_access_log');
  p = pinRecord(p, 'r_eron');
  p = pinRecord(p, 'r_access_log');
  p = pinRecord(p, 'r_cctv_photo'); // makes c_photo noticed too
  return accuse(p, { culpritEntityId: 's_eron', decisiveLie: lie });
}

describe('decisiveContradiction', () => {
  it('is the highest-weight authored contradiction', () => {
    expect(decisiveContradiction(sampleArchiveCase)?.id).toBe('c_time');
  });
});

describe('resolveEnding', () => {
  it('returns truth for a correct, well-supported accusation', () => {
    expect(resolveEnding(sampleArchiveCase, solvedState()).id).toBe('end_truth');
  });
  it('returns miscarriage when the wrong suspect is accused', () => {
    const p = accuse(createArchiveProgress(sampleArchiveCase), { culpritEntityId: 's_mara' });
    expect(resolveEnding(sampleArchiveCase, p).id).toBe('end_miscarriage');
  });
  it('returns cold_case when there is no accusation', () => {
    expect(resolveEnding(sampleArchiveCase, createArchiveProgress(sampleArchiveCase)).id).toBe('end_cold');
  });
  it('falls back to a synthetic cold_case when no authored ending matches', () => {
    const noEndings = { ...sampleArchiveCase, endings: [] };
    const e = resolveEnding(noEndings, createArchiveProgress(noEndings));
    expect(e.id).toBe('cold_case_default');
    expect(e.quality).toBe('cold_case');
  });
});

describe('scoreCaseArchive', () => {
  it('awards a perfect S for the full solve', () => {
    const r = scoreCaseArchive(sampleArchiveCase, solvedState());
    expect(r.decisiveLieCorrect).toBe(true);
    expect(r.contradictionsNoticed).toBe(2);
    expect(r.contradictionsTotal).toBe(2);
    expect(r.sealsOpened).toBe(1);
    expect(r.sealsTotal).toBe(1);
    expect(r.accusationQuality).toBe('truth');
    expect(r.score).toBe(100);
    expect(r.rank).toBe('S');
    expect(r.flagsForCampaign).toEqual(['eron_jailed']);
  });

  it('penalises an empty suspicion that belongs to no contradiction', () => {
    let p = solvedState();
    p = markSuspicion(p, 'r_report'); // r_report is in no contradiction
    const r = scoreCaseArchive(sampleArchiveCase, p);
    expect(r.emptySuspicions).toBe(1);
    expect(r.score).toBe(95); // 100 - 5
  });

  it('scores a wrong accusation low (miscarriage, no decisive lie)', () => {
    const p = accuse(createArchiveProgress(sampleArchiveCase), { culpritEntityId: 's_mara' });
    const r = scoreCaseArchive(sampleArchiveCase, p);
    expect(r.accusationQuality).toBe('miscarriage');
    expect(r.decisiveLieCorrect).toBe(false);
    expect(r.rank).toBe('F');
  });
});

describe('checkAccusation', () => {
  it('bundles the resolved ending and the score', () => {
    const out = checkAccusation(sampleArchiveCase, solvedState());
    expect(out.ending.id).toBe('end_truth');
    expect(out.result.rank).toBe('S');
  });
});
