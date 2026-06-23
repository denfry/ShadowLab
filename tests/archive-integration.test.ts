import { describe, expect, it } from 'vitest';
import {
  createArchiveProgress,
  openRecord,
  accuse,
  pinRecord,
  markSuspicion,
  checkAccusation,
  validateArchiveCase,
  getDiscoveredIndex,
} from '@/games/shadow-trace/archive';
import { sampleArchiveCase } from './fixtures/sample-archive-case';
import type { FactRef } from '@/games/shadow-trace/archive';

const lie: [FactRef, FactRef] = [
  { kind: 'recordClaim', recordId: 'r_eron', claimId: 'home' },
  { kind: 'metadata', recordId: 'r_access_log', field: 'time' },
];

describe('archive engine — public barrel', () => {
  it('re-exports the validator, which accepts the sample case', () => {
    expect(validateArchiveCase(sampleArchiveCase).ok).toBe(true);
  });
});

describe('full solve via the public API', () => {
  it('follows the thread, unseals the log, accuses correctly, and earns rank S', () => {
    let p = createArchiveProgress(sampleArchiveCase);

    // follow the thread: CCTV photo reveals the admin -> admin chat grants the key -> log unseals
    p = openRecord(sampleArchiveCase, p, 'r_cctv_photo');
    p = openRecord(sampleArchiveCase, p, 'r_chat_admin');
    expect(p.keys).toContain('k_archive');
    p = openRecord(sampleArchiveCase, p, 'r_access_log');
    expect(p.seenRecords).toContain('r_access_log');

    // the admin now shows up in the index
    const persons = getDiscoveredIndex(sampleArchiveCase, p).find((g) => g.type === 'person')!;
    expect(persons.entities.map((e) => e.entity.id)).toContain('s_admin');

    // pin both contradicting records (and the photo so the secondary contradiction is noticed)
    p = pinRecord(p, 'r_eron');
    p = pinRecord(p, 'r_access_log');
    p = pinRecord(p, 'r_cctv_photo');

    p = accuse(p, { culpritEntityId: 's_eron', decisiveLie: lie });
    const out = checkAccusation(sampleArchiveCase, p);
    expect(out.ending.id).toBe('end_truth');
    expect(out.result.rank).toBe('S');
    expect(out.result.score).toBe(100);
  });

  it('a wrong accusation yields a miscarriage ending', () => {
    let p = createArchiveProgress(sampleArchiveCase);
    p = accuse(p, { culpritEntityId: 's_mara' });
    expect(checkAccusation(sampleArchiveCase, p).ending.id).toBe('end_miscarriage');
  });

  it('an empty suspicion (record in no contradiction) costs points', () => {
    let p = createArchiveProgress(sampleArchiveCase);
    p = markSuspicion(p, 'r_report');
    expect(checkAccusation(sampleArchiveCase, p).result.emptySuspicions).toBe(1);
  });
});
