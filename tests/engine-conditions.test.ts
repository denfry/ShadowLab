import { describe, expect, it } from 'vitest';
import { evaluateCondition } from '@/games/shadow-trace/engine/conditions';
import type { CaseProgressV2, Condition } from '@/games/shadow-trace/engine/types';

const state: CaseProgressV2 = {
  caseId: 'sample',
  openNodes: [],
  visitedNodes: [],
  inspectedHotspots: [],
  discoveredEvidence: ['e_photo'],
  discoveredStatements: ['st_eron_home'],
  flags: { lab_done: true },
  foundContradictions: ['c_time'],
  links: [],
  notes: [],
  choicesMade: {},
  accusation: { culpritId: 's_eron', fakeEvidenceIds: [], keyContradictionIds: [] },
};

describe('evaluateCondition', () => {
  it('matches hasEvidence / hasFlag / foundContradiction / accuse', () => {
    expect(evaluateCondition({ hasEvidence: 'e_photo' }, state)).toBe(true);
    expect(evaluateCondition({ hasEvidence: 'e_log' }, state)).toBe(false);
    expect(evaluateCondition({ hasFlag: 'lab_done' }, state)).toBe(true);
    expect(evaluateCondition({ hasFlag: 'nope' }, state)).toBe(false);
    expect(evaluateCondition({ foundContradiction: 'c_time' }, state)).toBe(true);
    expect(evaluateCondition({ accuse: 's_eron' }, state)).toBe(true);
    expect(evaluateCondition({ accuse: 's_mara' }, state)).toBe(false);
    expect(evaluateCondition({ accuse: 's_eron' }, { ...state, accusation: undefined })).toBe(false);
  });

  it('composes all / any / not', () => {
    const cond: Condition = {
      all: [{ hasFlag: 'lab_done' }, { not: { hasEvidence: 'e_log' } }, { any: [{ accuse: 's_eron' }, { hasFlag: 'x' }] }],
    };
    expect(evaluateCondition(cond, state)).toBe(true);
    expect(evaluateCondition({ all: [{ hasFlag: 'lab_done' }, { hasEvidence: 'e_log' }] }, state)).toBe(false);
  });

  it('treats empty all as true and empty any as false', () => {
    expect(evaluateCondition({ all: [] }, state)).toBe(true);
    expect(evaluateCondition({ any: [] }, state)).toBe(false);
  });
});
