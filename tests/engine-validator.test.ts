import { describe, expect, it } from 'vitest';
import { validateCase } from '@/games/shadow-trace/engine/validator';
import { sampleCase } from './fixtures/sample-case-v2';
import type { CaseV2 } from '@/games/shadow-trace/engine/types';

describe('validateCase', () => {
  it('passes the valid sample case', () => {
    const r = validateCase(sampleCase);
    expect(r.ok).toBe(true);
    expect(r.issues).toEqual([]);
  });

  it('flags an unreachable node', () => {
    const broken: CaseV2 = {
      ...sampleCase,
      nodes: [...sampleCase.nodes, { id: 'n_orphan', type: 'location', title: 'Сирота', body: [], requires: { hasFlag: 'never_set' } }],
    };
    const r = validateCase(broken);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'unreachable_node')).toBe(true);
  });

  it('flags an unreachable contradiction', () => {
    const broken: CaseV2 = {
      ...sampleCase,
      contradictions: [
        ...sampleCase.contradictions,
        {
          id: 'c_ghost',
          between: [{ type: 'statement', refId: 'st_eron_home' }, { type: 'evidence', refId: 'e_missing' }],
          rule: 'mutual_exclusive',
          weight: 1,
        },
      ],
    };
    const r = validateCase(broken);
    expect(r.ok).toBe(false);
    // e_missing does not exist -> bad_factref, and the contradiction is never findable
    expect(r.issues.some((i) => i.code === 'bad_factref')).toBe(true);
    expect(r.issues.some((i) => i.code === 'unreachable_contradiction')).toBe(true);
  });

  it('flags a hotspot out of bounds', () => {
    const broken: CaseV2 = {
      ...sampleCase,
      evidence: sampleCase.evidence.map((e) =>
        e.id === 'e_photo' && e.media
          ? { ...e, media: { ...e.media, hotspots: [{ id: 'bad', at: { x: 90, y: 90, w: 30, h: 30 }, label: '' }] } }
          : e,
      ),
    };
    const r = validateCase(broken);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'hotspot_oob')).toBe(true);
  });

  it('flags a case with no reachable truth ending', () => {
    const broken: CaseV2 = {
      ...sampleCase,
      endings: sampleCase.endings.map((e) => (e.quality === 'truth' ? { ...e, quality: 'partial' as const } : e)),
    };
    const r = validateCase(broken);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'no_truth_path')).toBe(true);
  });

  it('fixpoint: removing the contradiction unlock makes the gated node unreachable', () => {
    const broken: CaseV2 = { ...sampleCase, contradictions: [] };
    const r = validateCase(broken);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'unreachable_node' && i.message.includes('n_lab'))).toBe(true);
  });

  it('flags duplicate ids across collections', () => {
    const broken: CaseV2 = { ...sampleCase, evidence: [...sampleCase.evidence, { ...sampleCase.evidence[0] }] };
    const r = validateCase(broken);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'duplicate_id')).toBe(true);
  });

  it('flags an effect pointing at a missing target', () => {
    const broken: CaseV2 = {
      ...sampleCase,
      nodes: sampleCase.nodes.map((n) => (n.id === 'n_scene' ? { ...n, grants: [{ addEvidence: 'e_ghost' }] } : n)),
    };
    const r = validateCase(broken);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'bad_effect_target')).toBe(true);
  });

  it('flags an unknown suspect referenced by an accuse ending', () => {
    const broken: CaseV2 = {
      ...sampleCase,
      endings: sampleCase.endings.map((e) => (e.id === 'end_partial' ? { ...e, requires: { accuse: 's_ghost' } } : e)),
    };
    const r = validateCase(broken);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'bad_suspect_ref')).toBe(true);
  });

  it('flags a statement whose speaker is not a suspect', () => {
    const broken: CaseV2 = {
      ...sampleCase,
      statements: sampleCase.statements.map((s) => ({ ...s, speakerId: 's_ghost' })),
    };
    const r = validateCase(broken);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'bad_suspect_ref')).toBe(true);
  });
});
