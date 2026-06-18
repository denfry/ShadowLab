import { describe, expect, it } from 'vitest';
import { validateArchiveCase } from '@/games/shadow-trace/archive/validator';
import { sampleArchiveCase } from './fixtures/sample-archive-case';
import type { CaseArchive } from '@/games/shadow-trace/archive/types';

const clone = (c: CaseArchive): CaseArchive => JSON.parse(JSON.stringify(c));

describe('validateArchiveCase', () => {
  it('accepts the valid sample case', () => {
    const res = validateArchiveCase(sampleArchiveCase);
    expect(res.ok).toBe(true);
    expect(res.issues).toEqual([]);
  });

  it('flags an unreachable record (no path of entity mentions reaches it)', () => {
    const c = clone(sampleArchiveCase);
    c.records.push({ id: 'r_orphan', kind: 'note', title: 'Сирота', body: [{ text: 'нет связей' }], mentions: [] });
    const res = validateArchiveCase(c);
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.code === 'unreachable_record')).toBe(true);
  });

  it('flags a sealed record whose key can never be obtained', () => {
    const c = clone(sampleArchiveCase);
    c.keysSchema.push({ id: 'k_ghost', label: 'Призрак' });
    c.records.find((r) => r.id === 'r_access_log')!.seal = { keyId: 'k_ghost', hint: 'нет ключа' };
    const res = validateArchiveCase(c);
    expect(res.issues.some((i) => i.code === 'unobtainable_key' || i.code === 'unopenable_seal')).toBe(true);
  });

  it('flags a dangling mention, a bad media ref, and a bad factref', () => {
    const c = clone(sampleArchiveCase);
    c.records[0].mentions.push('e_ghost');
    c.records[0].mediaId = 'm_ghost';
    c.contradictions[0].between[1] = { kind: 'metadata', recordId: 'r_ghost', field: 'time' };
    const res = validateArchiveCase(c);
    const codes = res.issues.map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(['bad_mention', 'bad_media_ref', 'bad_factref']));
  });

  it('flags a duplicate id and a missing truth path', () => {
    const c = clone(sampleArchiveCase);
    c.entities.push({ id: 's_eron', type: 'person', label: 'Дубль' });
    c.endings = c.endings.filter((e) => e.quality !== 'truth');
    const res = validateArchiveCase(c);
    const codes = res.issues.map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(['duplicate_id', 'no_truth_path']));
  });

  it('flags a hotspot out of scene bounds', () => {
    const c = clone(sampleArchiveCase);
    c.media![0].media.hotspots[0].at = { x: 90, y: 90, w: 50, h: 50 };
    const res = validateArchiveCase(c);
    expect(res.issues.some((i) => i.code === 'hotspot_oob')).toBe(true);
  });
});
