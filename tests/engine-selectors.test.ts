import { describe, expect, it } from 'vitest';
import {
  getOpenNodes,
  getAvailableChoices,
  getVisibleHotspots,
  getDetectedArtifacts,
  inspectHotspot,
} from '@/games/shadow-trace/engine/selectors';
import { createCaseProgress } from '@/games/shadow-trace/engine/state';
import { sampleCase } from './fixtures/sample-case-v2';
import type { CaseProgressV2, LeadNode } from '@/games/shadow-trace/engine/types';
import type { CaseV2 } from '@/games/shadow-trace/engine/types';

describe('getOpenNodes', () => {
  it('returns the open nodes flagged enterable', () => {
    const open = getOpenNodes(sampleCase, createCaseProgress(sampleCase));
    expect(open.map((o) => o.node.id)).toEqual(['n_scene', 'n_interview']);
    expect(open.every((o) => o.enterable)).toBe(true);
  });

  it('marks an open node whose requires is unmet as not enterable', () => {
    const state: CaseProgressV2 = { ...createCaseProgress(sampleCase), openNodes: ['n_lab'] };
    const open = getOpenNodes(sampleCase, state);
    expect(open).toHaveLength(1);
    expect(open[0].node.id).toBe('n_lab');
    expect(open[0].enterable).toBe(false); // requires foundContradiction c_time, not found
  });
});

describe('getAvailableChoices', () => {
  const node: LeadNode = {
    id: 'n_x',
    type: 'interrogation',
    title: 'X',
    body: [],
    choices: [
      { id: 'open', label: 'Open', effects: [] },
      { id: 'gated', label: 'Gated', requires: { hasFlag: 'never' }, effects: [] },
    ],
  };

  it('returns only choices whose requires passes', () => {
    const choices = getAvailableChoices(node, createCaseProgress(sampleCase));
    expect(choices.map((c) => c.id)).toEqual(['open']);
  });

  it('returns [] for a node with no choices', () => {
    expect(getAvailableChoices({ ...node, choices: undefined }, createCaseProgress(sampleCase))).toEqual([]);
  });
});

describe('getVisibleHotspots', () => {
  const photo = sampleCase.evidence.find((e) => e.id === 'e_photo')!;

  it('returns hotspots with no reveal condition', () => {
    const hs = getVisibleHotspots(photo, createCaseProgress(sampleCase));
    expect(hs.map((h) => h.id)).toEqual(['h_clock']);
  });

  it('hides a hotspot whose revealRequires is unmet', () => {
    const gated = {
      ...photo,
      media: { ...photo.media!, hotspots: [{ ...photo.media!.hotspots[0], revealRequires: { hasFlag: 'never' } }] },
    };
    expect(getVisibleHotspots(gated, createCaseProgress(sampleCase))).toEqual([]);
  });

  it('returns [] for evidence with no media', () => {
    const log = sampleCase.evidence.find((e) => e.id === 'e_log')!;
    expect(getVisibleHotspots(log, createCaseProgress(sampleCase))).toEqual([]);
  });
});

describe('getDetectedArtifacts', () => {
  const photo = sampleCase.evidence.find((e) => e.id === 'e_photo')!;

  it('returns artifacts with no detect condition', () => {
    const arts = getDetectedArtifacts(photo, createCaseProgress(sampleCase));
    expect(arts.map((a) => a.id)).toEqual(['a_clock']);
  });

  it('hides an artifact whose detectRequires is unmet', () => {
    const gated = {
      ...photo,
      media: { ...photo.media!, artifacts: [{ ...photo.media!.artifacts![0], detectRequires: { hasFlag: 'never' } }] },
    };
    expect(getDetectedArtifacts(gated, createCaseProgress(sampleCase))).toEqual([]);
  });

  it('returns [] for evidence with no media', () => {
    const log = sampleCase.evidence.find((e) => e.id === 'e_log')!;
    expect(getDetectedArtifacts(log, createCaseProgress(sampleCase))).toEqual([]);
  });
});

function caseWithHotspotGrant(): CaseV2 {
  const photo = sampleCase.evidence.find((e) => e.id === 'e_photo')!;
  return {
    ...sampleCase,
    evidence: sampleCase.evidence.map((e) =>
      e.id === 'e_photo'
        ? { ...e, media: { ...photo.media!, hotspots: [{ ...photo.media!.hotspots[0], grants: [{ setFlag: 'saw_clock' }] }] } }
        : e,
    ),
  };
}

describe('inspectHotspot', () => {
  it('applies the hotspot grants and records it inspected', () => {
    const cd = caseWithHotspotGrant();
    const next = inspectHotspot(cd, createCaseProgress(cd), 'h_clock');
    expect(next.inspectedHotspots).toContain('h_clock');
    expect(next.flags.saw_clock).toBe(true);
  });

  it('is a no-op when already inspected', () => {
    const cd = caseWithHotspotGrant();
    const once = inspectHotspot(cd, createCaseProgress(cd), 'h_clock');
    const twice = inspectHotspot(cd, once, 'h_clock');
    expect(twice).toBe(once);
  });

  it('is a no-op for an unknown or hidden hotspot', () => {
    const cd = caseWithHotspotGrant();
    const p = createCaseProgress(cd);
    expect(inspectHotspot(cd, p, 'nope')).toBe(p);
  });
});
