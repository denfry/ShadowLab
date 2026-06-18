import type { CaseProgressV2, Condition } from './types';

/** Pure boolean evaluation of a Condition tree against current case state. */
export function evaluateCondition(cond: Condition, state: CaseProgressV2): boolean {
  if ('hasEvidence' in cond) return state.discoveredEvidence.includes(cond.hasEvidence);
  if ('hasFlag' in cond) return Boolean(state.flags[cond.hasFlag]);
  if ('foundContradiction' in cond) return state.foundContradictions.includes(cond.foundContradiction);
  if ('accuse' in cond) return state.accusation?.culpritId === cond.accuse;
  if ('all' in cond) return cond.all.every((c) => evaluateCondition(c, state));
  if ('any' in cond) return cond.any.some((c) => evaluateCondition(c, state));
  if ('not' in cond) return !evaluateCondition(cond.not, state);
  return false;
}
