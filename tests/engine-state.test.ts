import { describe, expect, it } from 'vitest';
import {
  createCaseProgress,
  applyEffects,
  visitNode,
  chooseOption,
} from '@/games/shadow-trace/engine/state';
import { sampleCase } from './fixtures/sample-case-v2';
import type { CaseV2 } from '@/games/shadow-trace/engine/types';

describe('createCaseProgress', () => {
  it('opens the start nodes and starts empty', () => {
    const p = createCaseProgress(sampleCase);
    expect(p.openNodes).toEqual(['n_scene', 'n_interview']);
    expect(p.discoveredEvidence).toEqual([]);
    expect(p.foundContradictions).toEqual([]);
  });

  it('seeds an empty inspectedHotspots list', () => {
    expect(createCaseProgress(sampleCase).inspectedHotspots).toEqual([]);
  });
});

describe('applyEffects', () => {
  it('is immutable and idempotent for set-like effects', () => {
    const p = createCaseProgress(sampleCase);
    const next = applyEffects(p, [{ addEvidence: 'e_photo' }, { setFlag: 'lab_done' }]);
    expect(next).not.toBe(p);
    expect(p.discoveredEvidence).toEqual([]); // original untouched
    expect(next.discoveredEvidence).toEqual(['e_photo']);
    expect(next.flags.lab_done).toBe(true);
    const again = applyEffects(next, [{ addEvidence: 'e_photo' }]);
    expect(again.discoveredEvidence).toEqual(['e_photo']); // no duplicate
  });

  it('lockNode removes an open node', () => {
    const p = createCaseProgress(sampleCase);
    const next = applyEffects(p, [{ lockNode: 'n_scene' }]);
    expect(next.openNodes).toEqual(['n_interview']);
  });
});

describe('visitNode', () => {
  it('grants a node payload and marks it visited', () => {
    const p = createCaseProgress(sampleCase);
    const next = visitNode(sampleCase, p, 'n_scene');
    expect(next.discoveredEvidence).toContain('e_photo');
    expect(next.visitedNodes).toContain('n_scene');
    expect(p.visitedNodes).toEqual([]); // original untouched
  });

  it('refuses to visit a locked or gated node', () => {
    const p = createCaseProgress(sampleCase);
    const next = visitNode(sampleCase, p, 'n_lab'); // not open, requires contradiction
    expect(next).toBe(p);
  });
});

describe('chooseOption', () => {
  it('applies choice effects and records the choice', () => {
    const withChoice: CaseV2 = {
      ...sampleCase,
      nodes: sampleCase.nodes.map((n) =>
        n.id === 'n_interview'
          ? { ...n, choices: [{ id: 'press', label: 'Надавить', effects: [{ setFlag: 'pressed' }] }] }
          : n,
      ),
    };
    const p = createCaseProgress(withChoice);
    const next = chooseOption(withChoice, p, 'n_interview', 'press');
    expect(next.flags.pressed).toBe(true);
    expect(next.choicesMade.n_interview).toBe('press');
  });

  it('refuses a gated choice whose requires is unmet', () => {
    const gated: CaseV2 = {
      ...sampleCase,
      nodes: sampleCase.nodes.map((n) =>
        n.id === 'n_interview'
          ? { ...n, choices: [{ id: 'locked', label: 'Заперто', requires: { hasFlag: 'never' }, effects: [{ setFlag: 'should_not_set' }] }] }
          : n,
      ),
    };
    const p = createCaseProgress(gated);
    const next = chooseOption(gated, p, 'n_interview', 'locked');
    expect(next).toBe(p);
    expect(next.flags.should_not_set).toBeUndefined();
  });
});
