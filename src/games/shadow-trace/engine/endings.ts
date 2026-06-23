import type { CaseV2, CaseProgressV2, Ending, DeductionResultV2, Rank, EndingQuality } from './types';
import { evaluateCondition } from './conditions';
import { matchContradiction } from './contradictions';

const COLD_CASE_FALLBACK: Ending = {
  id: 'cold_case_default',
  title: 'Дело закрыто без ответа',
  requires: { all: [] }, // never evaluated; only returned from the ?? fallback path
  quality: 'cold_case',
  epilogue: ['Улик не хватило. Дело отправлено в архив.'],
};

/** First ending whose `requires` holds, top-down. Synthetic cold_case if none match. */
export function resolveEnding(caseData: CaseV2, state: CaseProgressV2): Ending {
  return caseData.endings.find((e) => evaluateCondition(e.requires, state)) ?? COLD_CASE_FALLBACK;
}

function rankFor(score: number): Rank {
  if (score >= 95) return 'S';
  if (score >= 80) return 'A';
  if (score >= 65) return 'B';
  if (score >= 45) return 'C';
  return 'F';
}

/**
 * Deterministic scoring out of 100:
 *   contradictions 50 · fakes 25 · accusation quality 25 · minus 10 per false link (cap 30).
 */
export function scoreCaseV2(caseData: CaseV2, state: CaseProgressV2): DeductionResultV2 {
  const contradictionsTotal = caseData.contradictions.length;
  const contradictionsFound = state.foundContradictions.length;

  let correctLinks = 0;
  let falseLinks = 0;
  for (const link of state.links) {
    if (link.relation !== 'contradicts') continue;
    if (matchContradiction(caseData, link.fromRef, link.toRef)) correctLinks += 1;
    else falseLinks += 1;
  }

  const fakeEvidence = caseData.evidence.filter((e) => e.authenticity === 'fake');
  const fakesTotal = fakeEvidence.length;
  const accusedFakes = new Set(state.accusation?.fakeEvidenceIds ?? []);
  const fakesIdentified = fakeEvidence.filter((e) => accusedFakes.has(e.id)).length;

  const ending = resolveEnding(caseData, state);
  const accusationQuality: EndingQuality = ending.quality;

  const contradictionScore = contradictionsTotal ? (contradictionsFound / contradictionsTotal) * 50 : 50;
  const fakeScore = fakesTotal ? (fakesIdentified / fakesTotal) * 25 : 25;
  const qualityScore = accusationQuality === 'truth' ? 25 : accusationQuality === 'partial' ? 12 : 0;
  const penalty = Math.min(falseLinks * 10, 30);
  const score = Math.max(0, Math.round(contradictionScore + fakeScore + qualityScore - penalty));

  const flagsForCampaign = (ending.campaignEffects ?? [])
    .map((e) => e.setFlag)
    .filter((f): f is string => Boolean(f));

  return {
    rank: rankFor(score),
    score,
    contradictionsFound,
    contradictionsTotal,
    correctLinks,
    falseLinks,
    fakesIdentified,
    fakesTotal,
    accusationQuality,
    flagsForCampaign,
  };
}
