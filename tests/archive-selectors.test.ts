import { describe, expect, it } from 'vitest';
import {
  getRecordView,
  getEntityPage,
  getDiscoveredIndex,
  getCaseFile,
  getAccusableSuspects,
} from '@/games/shadow-trace/archive/selectors';
import { createArchiveProgress, openRecord } from '@/games/shadow-trace/archive/state';
import { pinRecord, markSuspicion, addNote } from '@/games/shadow-trace/archive/casefile';
import { sampleArchiveCase } from './fixtures/sample-archive-case';

describe('getRecordView', () => {
  it('resolves entity spans to clickable links and attaches media', () => {
    const p = createArchiveProgress(sampleArchiveCase);
    const view = getRecordView(sampleArchiveCase, p, 'r_cctv_photo')!;
    expect(view.sealed).toBe(false);
    expect(view.media?.style).toBe('cctv');
    const linked = view.spans.filter((s) => s.entity);
    expect(linked.map((s) => s.entity!.id)).toEqual(expect.arrayContaining(['ev_cctv', 'p_office', 't_2130', 's_admin']));
  });

  it('hides the body and media of a sealed record but exposes the hint', () => {
    const p = createArchiveProgress(sampleArchiveCase);
    const view = getRecordView(sampleArchiveCase, p, 'r_access_log')!;
    expect(view.sealed).toBe(true);
    expect(view.spans).toEqual([]);
    expect(view.media).toBeUndefined();
    expect(view.sealHint).toContain('архив');
  });
});

describe('getEntityPage', () => {
  it('lists records mentioning the entity with their sealed flag', () => {
    let p = createArchiveProgress(sampleArchiveCase);
    p = openRecord(sampleArchiveCase, p, 'r_cctv_photo'); // discover s_admin
    const page = getEntityPage(sampleArchiveCase, p, 'p_office')!;
    expect(page.entity.id).toBe('p_office');
    const ids = page.records.map((r) => r.record.id);
    expect(ids).toEqual(expect.arrayContaining(['r_report', 'r_eron', 'r_cctv_photo', 'r_access_log']));
    const log = page.records.find((r) => r.record.id === 'r_access_log')!;
    expect(log.sealed).toBe(true);
  });

  it('returns null for an undiscovered entity', () => {
    const p = createArchiveProgress(sampleArchiveCase);
    expect(getEntityPage(sampleArchiveCase, p, 's_admin')).toBeNull();
  });
});

describe('getDiscoveredIndex', () => {
  it('groups discovered entities by type with reachable-record counts', () => {
    const p = createArchiveProgress(sampleArchiveCase);
    const groups = getDiscoveredIndex(sampleArchiveCase, p);
    const persons = groups.find((g) => g.type === 'person')!;
    expect(persons.entities.map((e) => e.entity.id)).toEqual(expect.arrayContaining(['s_eron', 's_mara']));
    const place = groups.find((g) => g.type === 'place')!.entities.find((e) => e.entity.id === 'p_office')!;
    expect(place.recordCount).toBeGreaterThanOrEqual(3);
    // s_admin is not discovered yet -> absent
    expect(persons.entities.map((e) => e.entity.id)).not.toContain('s_admin');
  });
});

describe('getCaseFile', () => {
  it('resolves pinned records, suspicions, and notes', () => {
    let p = createArchiveProgress(sampleArchiveCase);
    p = pinRecord(p, 'r_eron');
    p = markSuspicion(p, 'r_eron', 'врёт');
    p = addNote(p, 'сверить время');
    const cf = getCaseFile(sampleArchiveCase, p);
    expect(cf.pinnedRecords.map((r) => r.id)).toEqual(['r_eron']);
    expect(cf.suspicions[0].record.id).toBe('r_eron');
    expect(cf.suspicions[0].note).toBe('врёт');
    expect(cf.notes).toEqual(['сверить время']);
  });
});

describe('getAccusableSuspects', () => {
  it('returns discovered person entities flagged as suspects', () => {
    const p = createArchiveProgress(sampleArchiveCase);
    expect(getAccusableSuspects(sampleArchiveCase, p).map((e) => e.id)).toEqual(
      expect.arrayContaining(['s_eron', 's_mara']),
    );
  });
});
