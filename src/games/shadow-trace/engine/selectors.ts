import type { CaseV2, CaseProgressV2, LeadNode, Choice } from './types';
import { evaluateCondition } from './conditions';

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
