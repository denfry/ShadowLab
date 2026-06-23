import type { RoomView, PuzzleState } from '@/games/lodge/engine';

export interface ConstellationProps {
  nodePositions: [number, number][];
  edges: [number, number][];
}

export function constellationProps(
  view: Extract<RoomView, { kind: 'constellation' }>,
  state: Omit<Extract<PuzzleState, { kind: 'constellation' }>, 'edges'> & { edges: readonly (readonly [number, number])[] },
): ConstellationProps {
  const n = view.nodes;
  const nodePositions: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    nodePositions.push([Math.cos(a), Math.sin(a)]);
  }
  return { nodePositions, edges: state.edges.map((e) => [e[0], e[1]]) };
}
