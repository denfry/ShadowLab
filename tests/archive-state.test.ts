import { describe, expect, it } from 'vitest';
import { createArchiveProgress, openRecord, grantKey, accuse } from '@/games/shadow-trace/archive/state';
import { sampleArchiveCase } from './fixtures/sample-archive-case';

describe('createArchiveProgress', () => {
  it('discovers seed entities, grants no keys, and opens reachable unsealed records', () => {
    const p = createArchiveProgress(sampleArchiveCase);
    expect(p.caseId).toBe('sample-archive');
    // seed mentions discovered
    expect(p.discoveredEntities).toEqual(
      expect.arrayContaining(['t_2200', 'p_office', 's_eron', 's_mara', 'ev_cctv']),
    );
    // seeds are open; the CCTV photo is reachable via the discovered ev_cctv entity
    expect(p.openRecords).toEqual(expect.arrayContaining(['r_report', 'r_eron', 'r_cctv_photo']));
    // the access log is sealed -> NOT open; the admin chat needs s_admin (not yet discovered)
    expect(p.openRecords).not.toContain('r_access_log');
    expect(p.openRecords).not.toContain('r_chat_admin');
    expect(p.keys).toEqual([]);
    expect(p.seenRecords).toEqual([]);
  });
});

describe('openRecord', () => {
  it('reading the CCTV photo discovers the admin, making the admin chat reachable', () => {
    const p0 = createArchiveProgress(sampleArchiveCase);
    const p1 = openRecord(sampleArchiveCase, p0, 'r_cctv_photo');
    expect(p1).not.toBe(p0); // immutable
    expect(p1.seenRecords).toContain('r_cctv_photo');
    expect(p1.discoveredEntities).toContain('s_admin');
    expect(p1.openRecords).toContain('r_chat_admin');
  });

  it('reading the admin chat grants the archive key and unseals the access log', () => {
    let p = createArchiveProgress(sampleArchiveCase);
    p = openRecord(sampleArchiveCase, p, 'r_cctv_photo');
    p = openRecord(sampleArchiveCase, p, 'r_chat_admin');
    expect(p.keys).toContain('k_archive');
    expect(p.openRecords).toContain('r_access_log');
  });

  it('refuses to open a sealed record while its key is missing', () => {
    const p0 = createArchiveProgress(sampleArchiveCase);
    // r_access_log mentions s_eron (discovered) so it is reachable, but it is sealed
    const p1 = openRecord(sampleArchiveCase, p0, 'r_access_log');
    expect(p1).toBe(p0);
  });

  it('refuses to open an unreachable record', () => {
    const p0 = createArchiveProgress(sampleArchiveCase);
    const p1 = openRecord(sampleArchiveCase, p0, 'r_chat_admin'); // s_admin not yet discovered
    expect(p1).toBe(p0);
  });
});

describe('grantKey', () => {
  it('granting the key directly unseals the access log (idempotent)', () => {
    const p0 = createArchiveProgress(sampleArchiveCase);
    const p1 = grantKey(sampleArchiveCase, p0, 'k_archive');
    expect(p1.keys).toContain('k_archive');
    expect(p1.openRecords).toContain('r_access_log');
    const p2 = grantKey(sampleArchiveCase, p1, 'k_archive');
    expect(p2).toBe(p1); // already held -> no-op
  });
});

describe('accuse', () => {
  it('stores the accusation immutably', () => {
    const p0 = createArchiveProgress(sampleArchiveCase);
    const p1 = accuse(p0, { culpritEntityId: 's_eron' });
    expect(p1.accusation).toEqual({ culpritEntityId: 's_eron' });
    expect(p0.accusation).toBeUndefined();
  });
});
