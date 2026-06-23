import '@react-three/fiber';
import type { PuzzleEvent } from '@/games/lodge/engine';
import { candleProps } from '@/games/lodge/ui/adapters/candle';
import type { StationProps } from './types';

export function CandelabraStation({ puzzle, dispatch }: StationProps) {
  const view = puzzle.views[puzzle.lockOwner];
  const state = puzzle.state;
  if (view.kind !== 'candelabra' || state.kind !== 'candle') return null;

  const { lit, positions } = candleProps(view, state);
  const send = (event: PuzzleEvent) => dispatch(puzzle.id, puzzle.lockOwner, event);

  return (
    <group>
      {positions.map((x, i) => (
        <group key={i} position={[x * 0.5, 0, 0]} onClick={() => send({ type: 'candle.light', index: i })}>
          <mesh>
            <cylinderGeometry args={[0.08, 0.08, 0.6, 12]} />
            <meshStandardMaterial color="#e8e0c8" />
          </mesh>
          {lit[i] && (
            <mesh position={[0, 0.45, 0]}>
              <sphereGeometry args={[0.07, 12, 12]} />
              <meshStandardMaterial color="#ffb060" emissive="#ff8000" emissiveIntensity={2} />
            </mesh>
          )}
        </group>
      ))}
      <mesh position={[0, -0.6, 0]} onClick={() => send({ type: 'candle.reset' })}>
        <boxGeometry args={[0.4, 0.2, 0.2]} />
        <meshStandardMaterial color="#7a4a4a" />
      </mesh>
    </group>
  );
}
