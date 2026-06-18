import { describe, expect, it } from 'vitest';
import { createArchiveProgress } from '@/games/shadow-trace/archive/state';
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
