import type { CaseV2, CaseProgressV2, LeadNode, Choice, Evidence, Fact } from './types';
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

/** Inspect a (visible) hotspot: mark it inspected and route its grants through applyEffects.
 *  Hotspot ids are assumed unique across all evidence; the first match wins. */
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

function metadataText(e: Evidence): string {
  const m = e.metadata ?? {};
  const parts: string[] = [];
  if (m.time) parts.push(`время ${m.time}`);
  if (m.geo) parts.push(`место ${m.geo}`);
  if (m.device) parts.push(m.device);
  return `Метаданные «${e.title}»: ${parts.join(', ')}`;
}

function speakerName(caseData: CaseV2, speakerId: string): string {
  return caseData.suspects.find((s) => s.id === speakerId)?.name ?? speakerId;
}

/** Derive the dossier: a Fact card per discovered evidence, its metadata, each
 *  discovered statement, and each inspected hotspot. Each fact's `source` is the
 *  FactRef the board's addLink consumes. */
export function buildDossier(caseData: CaseV2, state: CaseProgressV2): Fact[] {
  const facts: Fact[] = [];

  for (const e of caseData.evidence) {
    if (!state.discoveredEvidence.includes(e.id)) continue;
    facts.push({
      id: `f_ev_${e.id}`,
      source: { type: 'evidence', refId: e.id },
      text: e.summary,
      subjectIds: e.relatedSuspectIds,
    });
    if (e.metadata && (e.metadata.time || e.metadata.geo || e.metadata.device)) {
      facts.push({
        id: `f_meta_${e.id}`,
        source: { type: 'metadata', refId: e.id },
        text: metadataText(e),
        subjectIds: e.relatedSuspectIds,
        time: e.metadata.time ? { start: e.metadata.time } : undefined,
        place: e.metadata.geo,
      });
    }
  }

  for (const st of caseData.statements) {
    if (!state.discoveredStatements.includes(st.id)) continue;
    facts.push({
      id: `f_st_${st.id}`,
      source: { type: 'statement', refId: st.id },
      text: `${speakerName(caseData, st.speakerId)}: «${st.claim}»`,
      subjectIds: [st.asserts.subjectId],
      time: st.asserts.timeStart ? { start: st.asserts.timeStart, end: st.asserts.timeEnd } : undefined,
      place: st.asserts.place,
    });
  }

  for (const e of caseData.evidence) {
    for (const h of e.media?.hotspots ?? []) {
      if (!state.inspectedHotspots.includes(h.id)) continue;
      facts.push({
        id: `f_hs_${h.id}`,
        source: { type: 'hotspot', refId: h.id },
        text: h.label,
        subjectIds: e.relatedSuspectIds,
      });
    }
  }

  return facts;
}
