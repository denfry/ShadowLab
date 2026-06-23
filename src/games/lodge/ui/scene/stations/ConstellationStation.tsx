import { useState } from 'react';
import { Line } from '@react-three/drei';
import { constellationProps } from '@/games/lodge/ui/adapters/constellation';
import type { StationProps } from './types';

export function ConstellationStation({ puzzle, dispatch }: StationProps) {
  const view = puzzle.views[puzzle.lockOwner];
  const state = puzzle.state;
  const [pending, setPending] = useState<number | null>(null);
  if (view.kind !== 'constellation' || state.kind !== 'constellation') return null;

  const { nodePositions, edges } = constellationProps(view, state);
  const at = (i: number): [number, number, number] => [nodePositions[i][0], nodePositions[i][1], 0];

  const clickNode = (i: number) => {
    if (pending === null) return setPending(i);
    if (pending === i) return setPending(null);
    dispatch(puzzle.id, puzzle.lockOwner, { type: 'constellation.toggle', a: pending, b: i });
    setPending(null);
  };

  return (
    <group>
      {edges.map((e, k) => (
        <Line key={k} points={[at(e[0]), at(e[1])]} color="#9fd0ff" lineWidth={2} />
      ))}
      {nodePositions.map((_, i) => (
        <mesh key={i} position={at(i)} onClick={() => clickNode(i)}>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshStandardMaterial
            color={pending === i ? '#ffe08a' : '#dfe8ff'}
            emissive={pending === i ? '#806000' : '#0a1430'}
            emissiveIntensity={1}
          />
        </mesh>
      ))}
    </group>
  );
}
