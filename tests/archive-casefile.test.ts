import { describe, expect, it } from 'vitest';
import { createArchiveProgress } from '@/games/shadow-trace/archive/state';
import {
  pinRecord,
  unpinRecord,
  pinEntity,
  unpinEntity,
  markSuspicion,
  clearSuspicion,
  addNote,
} from '@/games/shadow-trace/archive/casefile';
import { sampleArchiveCase } from './fixtures/sample-archive-case';

describe('case file', () => {
  it('pins and unpins records and entities (immutable, deduped)', () => {
    const p0 = createArchiveProgress(sampleArchiveCase);
    const p1 = pinRecord(pinRecord(p0, 'r_eron'), 'r_eron');
    expect(p1.pinnedRecords).toEqual(['r_eron']);
    expect(p0.pinnedRecords).toEqual([]);
    expect(unpinRecord(p1, 'r_eron').pinnedRecords).toEqual([]);

    const p2 = pinEntity(p0, 's_eron');
    expect(p2.pinnedEntities).toEqual(['s_eron']);
    expect(unpinEntity(p2, 's_eron').pinnedEntities).toEqual([]);
  });

  it('marks one suspicion per record and clears it', () => {
    const p0 = createArchiveProgress(sampleArchiveCase);
    const p1 = markSuspicion(p0, 'r_eron', 'врёт про 22:00');
    expect(p1.suspicions).toEqual([{ recordId: 'r_eron', note: 'врёт про 22:00' }]);
    const p2 = markSuspicion(p1, 'r_eron', 'дубль');
    expect(p2).toBe(p1); // one suspicion per record
    expect(clearSuspicion(p1, 'r_eron').suspicions).toEqual([]);
  });

  it('appends free notes', () => {
    const p0 = createArchiveProgress(sampleArchiveCase);
    expect(addNote(p0, 'проверить алиби').notes).toEqual(['проверить алиби']);
  });
});
