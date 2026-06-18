import { describe, expect, it } from 'vitest';
import { scoreCase } from '@/games/shadow-trace/systems/ScoringSystem';
import type { CaseProgress, DetectiveCase } from '@/games/shadow-trace/domain/types';

const caseData: DetectiveCase = {
  id: 'c',
  title: 'T',
  difficulty: 'normal',
  synopsis: '',
  intro: [],
  suspects: [{ id: 'eron', name: 'Eron', role: '', alibi: '' }],
  evidence: [{ id: 'msg_01', title: '', kind: 'message', summary: '', content: '', relatedSuspectIds: [], isFake: true }],
  questions: [
    { id: 'q1', text: '', options: [], correctOptionId: 'a', weight: 1 },
    { id: 'q2', text: '', options: [], correctOptionId: 'b', weight: 2 },
  ],
  validConnections: [{ fromId: 'log_01', toId: 'eron', relation: 'x' }],
  terminal: [],
  solution: { culpritId: 'eron', fakeEvidenceId: 'msg_01', whatHappened: '' },
};

const base: CaseProgress = {
  caseId: 'c',
  phase: 'result',
  discovered: [],
  connections: [],
  answers: {},
};

describe('scoreCase', () => {
  it('gives a perfect S for a flawless solve', () => {
    const r = scoreCase(caseData, {
      ...base,
      answers: { q1: 'a', q2: 'b' },
      connections: [{ fromId: 'log_01', toId: 'eron' }],
      accusation: { culpritId: 'eron', fakeEvidenceId: 'msg_01' },
    });
    expect(r.score).toBe(100);
    expect(r.rank).toBe('S');
    expect(r.accusedCorrectly).toBe(true);
    expect(r.foundFake).toBe(true);
  });

  it('penalises a wrong accusation', () => {
    const r = scoreCase(caseData, {
      ...base,
      answers: { q1: 'a', q2: 'b' },
      accusation: { culpritId: 'someone', fakeEvidenceId: 'msg_01' },
    });
    expect(r.accusedCorrectly).toBe(false);
    expect(r.score).toBeLessThan(100);
  });

  it('matches connections regardless of direction', () => {
    const r = scoreCase(caseData, {
      ...base,
      connections: [{ fromId: 'eron', toId: 'log_01' }],
    });
    expect(r.correctConnections).toBe(1);
  });
});
