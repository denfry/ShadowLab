import type { CaseV2, CaseProgressV2, Effect } from './types';
import { evaluateCondition } from './conditions';

const addUnique = (arr: string[], v: string): string[] => (arr.includes(v) ? arr : [...arr, v]);

export function createCaseProgress(caseData: CaseV2): CaseProgressV2 {
  return {
    caseId: caseData.id,
    openNodes: [...caseData.startNodeIds],
    visitedNodes: [],
    inspectedHotspots: [],
    discoveredEvidence: [],
    discoveredStatements: [],
    flags: {},
    foundContradictions: [],
    links: [],
    notes: [],
    choicesMade: {},
  };
}

/**
 * Apply a list of effects immutably (the returned state shares no mutable array
 * with the input). addEvidence/addStatement/addNode use set semantics (idempotent);
 * setFlag overwrites unconditionally; lockNode removes.
 */
export function applyEffects(state: CaseProgressV2, effects: Effect[] | undefined): CaseProgressV2 {
  if (!effects || effects.length === 0) return state;
  const next: CaseProgressV2 = {
    ...state,
    openNodes: [...state.openNodes],
    inspectedHotspots: [...state.inspectedHotspots],
    discoveredEvidence: [...state.discoveredEvidence],
    discoveredStatements: [...state.discoveredStatements],
    foundContradictions: [...state.foundContradictions],
    links: [...state.links],
    notes: [...state.notes],
    flags: { ...state.flags },
  };
  for (const e of effects) {
    if (e.setFlag) next.flags[e.setFlag] = true;
    if (e.addNode) next.openNodes = addUnique(next.openNodes, e.addNode);
    if (e.lockNode) next.openNodes = next.openNodes.filter((id) => id !== e.lockNode);
    if (e.addEvidence) next.discoveredEvidence = addUnique(next.discoveredEvidence, e.addEvidence);
    if (e.addStatement) next.discoveredStatements = addUnique(next.discoveredStatements, e.addStatement);
  }
  return next;
}

/** Visit an open, unblocked node: apply its grants, mark visited. No-op otherwise. */
export function visitNode(caseData: CaseV2, state: CaseProgressV2, nodeId: string): CaseProgressV2 {
  const node = caseData.nodes.find((n) => n.id === nodeId);
  if (!node) return state;
  if (!state.openNodes.includes(nodeId)) return state;
  if (node.requires && !evaluateCondition(node.requires, state)) return state;
  const granted = applyEffects(state, node.grants);
  return { ...granted, visitedNodes: addUnique(granted.visitedNodes, nodeId) };
}

/** Make a choice at a node: apply its effects, record it. No-op if gated/missing. */
export function chooseOption(
  caseData: CaseV2,
  state: CaseProgressV2,
  nodeId: string,
  choiceId: string,
): CaseProgressV2 {
  const node = caseData.nodes.find((n) => n.id === nodeId);
  const choice = node?.choices?.find((c) => c.id === choiceId);
  if (!choice) return state;
  if (choice.requires && !evaluateCondition(choice.requires, state)) return state;
  const applied = applyEffects(state, choice.effects);
  return { ...applied, choicesMade: { ...applied.choicesMade, [nodeId]: choiceId } };
}
