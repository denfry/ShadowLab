import type { CaseArchive, ArchiveProgress, ArchiveCondition, Contradiction, FactRef } from './types';
import { matchContradiction } from './contradictions';

function refRecordId(ref: FactRef): string | null {
  if (ref.kind === 'record' || ref.kind === 'recordClaim' || ref.kind === 'metadata') return ref.recordId;
  return null;
}

/** Has the player "marked" this fact — pinned/suspected its record, or pinned its entity? */
function isRefMarked(ref: FactRef, state: ArchiveProgress): boolean {
  const rid = refRecordId(ref);
  if (rid) return state.pinnedRecords.includes(rid) || state.suspicions.some((s) => s.recordId === rid);
  if (ref.kind === 'entity') return state.pinnedEntities.includes(ref.entityId);
  return false;
}

/** A contradiction is "noticed" when both of its facts are marked in the case file. */
export function isContradictionNoticed(c: Contradiction, state: ArchiveProgress): boolean {
  return c.between.every((ref) => isRefMarked(ref, state));
}

export function evaluateArchiveCondition(
  cond: ArchiveCondition,
  caseData: CaseArchive,
  state: ArchiveProgress,
): boolean {
  if ('accuse' in cond) return state.accusation?.culpritEntityId === cond.accuse;
  if ('decisiveLie' in cond) {
    const lie = state.accusation?.decisiveLie;
    if (!lie) return false;
    return matchContradiction(caseData, lie[0], lie[1])?.id === cond.decisiveLie;
  }
  if ('noticedContradiction' in cond) {
    const c = caseData.contradictions.find((x) => x.id === cond.noticedContradiction);
    return c ? isContradictionNoticed(c, state) : false;
  }
  if ('hasKey' in cond) return state.keys.includes(cond.hasKey);
  if ('all' in cond) return cond.all.every((c) => evaluateArchiveCondition(c, caseData, state));
  if ('any' in cond) return cond.any.some((c) => evaluateArchiveCondition(c, caseData, state));
  if ('not' in cond) return !evaluateArchiveCondition(cond.not, caseData, state);
  return false;
}
