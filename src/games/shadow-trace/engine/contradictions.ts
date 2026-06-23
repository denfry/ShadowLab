import type { CaseV2, CaseProgressV2, Contradiction, FactRef, PlayerLink } from './types';
import { applyEffects } from './state';

const sameRef = (a: FactRef, b: FactRef): boolean => a.type === b.type && a.refId === b.refId;

const samePair = (pair: readonly [FactRef, FactRef], a: FactRef, b: FactRef): boolean =>
  (sameRef(pair[0], a) && sameRef(pair[1], b)) || (sameRef(pair[0], b) && sameRef(pair[1], a));

const sameLink = (a: PlayerLink, b: PlayerLink): boolean =>
  a.relation === b.relation && samePair([a.fromRef, a.toRef], b.fromRef, b.toRef);

/** The authored contradiction a `contradicts` link maps to, or null. Order-independent. */
export function matchContradiction(caseData: CaseV2, a: FactRef, b: FactRef): Contradiction | null {
  if (sameRef(a, b)) return null;
  return caseData.contradictions.find((c) => samePair(c.between, a, b)) ?? null;
}

/** Mark a contradiction found and apply its unlocks. No-op if already found or unknown. */
export function discoverContradiction(
  caseData: CaseV2,
  state: CaseProgressV2,
  contradictionId: string,
): CaseProgressV2 {
  if (state.foundContradictions.includes(contradictionId)) return state;
  const c = caseData.contradictions.find((x) => x.id === contradictionId);
  if (!c) return state;
  const withFound: CaseProgressV2 = {
    ...state,
    foundContradictions: [...state.foundContradictions, contradictionId],
  };
  return applyEffects(withFound, c.unlocks);
}

/** Record a board link; a correct `contradicts` link auto-discovers its contradiction. */
export function addLink(caseData: CaseV2, state: CaseProgressV2, link: PlayerLink): CaseProgressV2 {
  if (state.links.some((l) => sameLink(l, link))) return state;
  const withLink: CaseProgressV2 = { ...state, links: [...state.links, link] };
  if (link.relation !== 'contradicts') return withLink;
  const matched = matchContradiction(caseData, link.fromRef, link.toRef);
  if (!matched) return withLink;
  return discoverContradiction(caseData, withLink, matched.id);
}
