import type {
  CaseArchive,
  ArchiveProgress,
  Ending,
  DeductionResultArchive,
  Rank,
  EndingQuality,
  Contradiction,
} from './types';
import { evaluateArchiveCondition, isContradictionNoticed } from './conditions';
import { matchContradiction } from './contradictions';

const COLD_CASE_FALLBACK: Ending = {
  id: 'cold_case_default',
  title: 'Дело закрыто без ответа',
  requires: { all: [] },
  quality: 'cold_case',
  epilogue: ['Улик не хватило. Дело отправлено в архив.'],
};

/** First ending whose `requires` holds, top-down. Synthetic cold_case if none match. */
export function resolveEnding(caseData: CaseArchive, state: ArchiveProgress): Ending {
  return caseData.endings.find((e) => evaluateArchiveCondition(e.requires, caseData, state)) ?? COLD_CASE_FALLBACK;
}

/** The decisive (highest-weight) authored contradiction; ties resolved by array order. */
export function decisiveContradiction(caseData: CaseArchive): Contradiction | null {
  if (caseData.contradictions.length === 0) return null;
  return caseData.contradictions.reduce((best, c) => (c.weight > best.weight ? c : best));
}

function rankFor(score: number): Rank {
  if (score >= 95) return 'S';
  if (score >= 80) return 'A';
  if (score >= 65) return 'B';
  if (score >= 45) return 'C';
  return 'F';
}

/**
 * Deterministic scoring out of 100 against an already-resolved ending:
 *   noticed contradictions 40 · decisive lie 30 · seals opened 15 · accusation quality 15
 *   minus 5 per empty suspicion (one in no contradiction), capped at 20.
 */
function buildResult(caseData: CaseArchive, state: ArchiveProgress, ending: Ending): DeductionResultArchive {
  const contradictionsTotal = caseData.contradictions.length;
  const contradictionsNoticed = caseData.contradictions.filter((c) => isContradictionNoticed(c, state)).length;

  const decisive = decisiveContradiction(caseData);
  const lie = state.accusation?.decisiveLie;
  const decisiveLieCorrect = Boolean(
    decisive && lie && matchContradiction(caseData, lie[0], lie[1])?.id === decisive.id,
  );

  const sealedRecords = caseData.records.filter((r) => r.seal);
  const sealsTotal = sealedRecords.length;
  // "opened" = the seal is broken and the file is now readable (in openRecords),
  // which in practice requires having read the key-granting record. A1 may switch to
  // seenRecords if it needs "player actually read it" rather than "now readable".
  const sealsOpened = sealedRecords.filter((r) => state.openRecords.includes(r.id)).length;

  const contradictionRecordIds = new Set<string>();
  for (const c of caseData.contradictions) {
    for (const ref of c.between) {
      if (ref.kind !== 'entity') contradictionRecordIds.add(ref.recordId);
    }
  }
  const emptySuspicions = state.suspicions.filter((s) => !contradictionRecordIds.has(s.recordId)).length;

  const accusationQuality: EndingQuality = ending.quality;

  const noticedScore = contradictionsTotal ? (contradictionsNoticed / contradictionsTotal) * 40 : 40;
  const decisiveScore = decisiveLieCorrect ? 30 : 0;
  const sealScore = sealsTotal ? (sealsOpened / sealsTotal) * 15 : 15;
  const qualityScore = accusationQuality === 'truth' ? 15 : accusationQuality === 'partial' ? 7 : 0;
  const penalty = Math.min(emptySuspicions * 5, 20); // cap penalty at 20
  const score = Math.max(0, Math.round(noticedScore + decisiveScore + sealScore + qualityScore - penalty));

  return {
    rank: rankFor(score),
    score,
    decisiveLieCorrect,
    contradictionsNoticed,
    contradictionsTotal,
    sealsOpened,
    sealsTotal,
    emptySuspicions,
    accusationQuality,
    flagsForCampaign: ending.campaignFlags ?? [],
  };
}

/** Score the case; resolves the ending internally for the accusation-quality component. */
export function scoreCaseArchive(caseData: CaseArchive, state: ArchiveProgress): DeductionResultArchive {
  return buildResult(caseData, state, resolveEnding(caseData, state));
}

export interface AccusationOutcome {
  ending: Ending;
  result: DeductionResultArchive;
}

/** Resolve the ending and compute the score together (ending resolved once). */
export function checkAccusation(caseData: CaseArchive, state: ArchiveProgress): AccusationOutcome {
  const ending = resolveEnding(caseData, state);
  return { ending, result: buildResult(caseData, state, ending) };
}
