import type { CaseProgress, DeductionResult, DetectiveCase, PlayerConnection, Rank } from '../domain/types';

const samePair = (a: PlayerConnection, b: { fromId: string; toId: string }): boolean =>
  (a.fromId === b.fromId && a.toId === b.toId) || (a.fromId === b.toId && a.toId === b.fromId);

function rankFor(score: number): Rank {
  if (score >= 95) return 'S';
  if (score >= 80) return 'A';
  if (score >= 65) return 'B';
  if (score >= 45) return 'C';
  return 'F';
}

/**
 * Pure deduction scoring. Weighting (out of 100):
 *   accuse culprit 40 · spot fake 20 · questions 30 (weighted) · connections 10.
 */
export function scoreCase(caseData: DetectiveCase, progress: CaseProgress): DeductionResult {
  const accusedCorrectly = progress.accusation?.culpritId === caseData.solution.culpritId;
  const foundFake = progress.accusation?.fakeEvidenceId === caseData.solution.fakeEvidenceId;

  const totalQuestions = caseData.questions.length;
  let correctAnswers = 0;
  let weightSum = 0;
  let weightHit = 0;
  for (const q of caseData.questions) {
    weightSum += q.weight;
    if (progress.answers[q.id] === q.correctOptionId) {
      correctAnswers += 1;
      weightHit += q.weight;
    }
  }

  const totalConnections = caseData.validConnections.length;
  const correctConnections = caseData.validConnections.filter((rule) =>
    progress.connections.some((c) => samePair(c, rule)),
  ).length;

  const score = Math.round(
    (accusedCorrectly ? 40 : 0) +
      (foundFake ? 20 : 0) +
      (weightSum ? (weightHit / weightSum) * 30 : 0) +
      (totalConnections ? (correctConnections / totalConnections) * 10 : 0),
  );

  return {
    score,
    rank: rankFor(score),
    correctConnections,
    totalConnections,
    correctAnswers,
    totalQuestions,
    foundFake,
    accusedCorrectly,
  };
}
