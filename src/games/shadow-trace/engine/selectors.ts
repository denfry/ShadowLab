import type { CaseV2, CaseProgressV2, LeadNode, Choice, Evidence } from './types';
import type { Hotspot, Artifact } from './media-types';
import { evaluateCondition } from './conditions';
import { applyEffects } from './state';

export interface OpenNode {
  node: LeadNode;
  enterable: boolean;
}

/** Nodes currently in the open set, each flagged by whether its entry condition is met. */
export function getOpenNodes(caseData: CaseV2, state: CaseProgressV2): OpenNode[] {
  return state.openNodes
    .map((id) => caseData.nodes.find((n) => n.id === id))
    .filter((n): n is LeadNode => Boolean(n))
    .map((node) => ({ node, enterable: !node.requires || evaluateCondition(node.requires, state) }));
}

/** Choices on a node whose `requires` currently passes. */
export function getAvailableChoices(node: LeadNode, state: CaseProgressV2): Choice[] {
  return (node.choices ?? []).filter((c) => !c.requires || evaluateCondition(c.requires, state));
}

/** Hotspots on the evidence's media whose reveal condition currently passes. */
export function getVisibleHotspots(evidence: Evidence, state: CaseProgressV2): Hotspot[] {
  return (evidence.media?.hotspots ?? []).filter(
    (h) => !h.revealRequires || evaluateCondition(h.revealRequires, state),
  );
}

/** Forgery artifacts on the evidence's media the player can currently detect. */
export function getDetectedArtifacts(evidence: Evidence, state: CaseProgressV2): Artifact[] {
  return (evidence.media?.artifacts ?? []).filter(
    (a) => !a.detectRequires || evaluateCondition(a.detectRequires, state),
  );
}

/** Inspect a (visible) hotspot: mark it inspected and route its grants through applyEffects. */
export function inspectHotspot(caseData: CaseV2, state: CaseProgressV2, hotspotId: string): CaseProgressV2 {
  if (state.inspectedHotspots.includes(hotspotId)) return state;
  let hotspot: Hotspot | undefined;
  for (const e of caseData.evidence) {
    const found = e.media?.hotspots.find((h) => h.id === hotspotId);
    if (found) {
      hotspot = found;
      break;
    }
  }
  if (!hotspot) return state;
  if (hotspot.revealRequires && !evaluateCondition(hotspot.revealRequires, state)) return state;
  const granted = applyEffects(state, hotspot.grants);
  return { ...granted, inspectedHotspots: [...granted.inspectedHotspots, hotspotId] };
}
