import { describe, expect, it } from 'vitest';
import { validateStation } from '@/games/among-the-quiet/engine/validator';
import { sampleStation } from './fixtures/sample-station';
import type { Station } from '@/games/among-the-quiet/engine/types';

describe('validateStation', () => {
  it('passes the valid sample station', () => {
    const r = validateStation(sampleStation);
    expect(r.ok).toBe(true);
    expect(r.issues).toEqual([]);
  });

  it('flags a routine pointing at a missing location', () => {
    const broken: Station = {
      ...sampleStation,
      crew: sampleStation.crew.map((n) => (n.id === 'mara' ? { ...n, routine: { ...n.routine, 0: [{ locationId: 'ghost', weight: 1 }] } } : n)),
    };
    const r = validateStation(broken);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'bad_ref')).toBe(true);
  });

  it('flags a readStyle with a missing band cue', () => {
    const broken: Station = {
      ...sampleStation,
      cueLibrary: sampleStation.cueLibrary.map((cs) =>
        cs.readStyle === 'soft_reader' ? { ...cs, bands: { ...cs.bands, cold: [] } } : cs,
      ),
    };
    const r = validateStation(broken);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'cue_gap')).toBe(true);
  });

  it('flags a risky step in a public room (no safe window)', () => {
    const broken: Station = {
      ...sampleStation,
      objectives: [{ id: 'o', title: 'X', steps: [{ id: 's', label: 'risk', locationId: 'commons', baseRisk: 1 }] }],
    };
    const r = validateStation(broken);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'no_safe_window')).toBe(true);
  });

  it('flags a cyclic requires DAG', () => {
    const broken: Station = {
      ...sampleStation,
      objectives: [{
        id: 'o', title: 'X',
        steps: [
          { id: 'a', label: 'a', locationId: 'vault', baseRisk: 1, requires: ['b'] },
          { id: 'b', label: 'b', locationId: 'vault', baseRisk: 1, requires: ['a'] },
        ],
      }],
    };
    const r = validateStation(broken);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'cyclic_requires')).toBe(true);
  });
});
