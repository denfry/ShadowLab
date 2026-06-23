import type { CaseArchive, Contradiction, FactRef } from './types';

export function sameRef(a: FactRef, b: FactRef): boolean {
  if (a.kind === 'entity' && b.kind === 'entity') return a.entityId === b.entityId;
  if (a.kind === 'record' && b.kind === 'record') return a.recordId === b.recordId;
  if (a.kind === 'recordClaim' && b.kind === 'recordClaim')
    return a.recordId === b.recordId && a.claimId === b.claimId;
  if (a.kind === 'metadata' && b.kind === 'metadata')
    return a.recordId === b.recordId && a.field === b.field;
  return false;
}

const samePair = (pair: readonly [FactRef, FactRef], a: FactRef, b: FactRef): boolean =>
  (sameRef(pair[0], a) && sameRef(pair[1], b)) || (sameRef(pair[0], b) && sameRef(pair[1], a));

/** The authored contradiction this fact pair maps to, or null. Order-independent. */
export function matchContradiction(caseData: CaseArchive, a: FactRef, b: FactRef): Contradiction | null {
  if (sameRef(a, b)) return null;
  return caseData.contradictions.find((c) => samePair(c.between, a, b)) ?? null;
}
