import { Text } from '@react-three/drei';
import type { PuzzleEvent } from '@/games/lodge/engine';
import { dialProps } from '@/games/lodge/ui/adapters/dial';
import type { StationProps } from './types';

export function DialStation({ puzzle, dispatch }: StationProps) {
  const view = puzzle.views[puzzle.lockOwner];
  const state = puzzle.state;
  if (view.kind !== 'dial' || state.kind !== 'dial') return null;

  const { ringLabels, pointerAngleRad, enteredLabels } = dialProps(view, state);
  const n = ringLabels.length;
  const send = (event: PuzzleEvent) => dispatch(puzzle.id, puzzle.lockOwner, event);

  return (
    <group>
      <group rotation={[0, 0, -pointerAngleRad]}>
        <mesh>
          <circleGeometry args={[1, 48]} />
          <meshStandardMaterial color={puzzle.solved ? '#caa24a' : '#3a3550'} />
        </mesh>
        {ringLabels.map((label, i) => {
          const a = (i / n) * Math.PI * 2;
          return (
            <Text
              key={i}
              position={[Math.sin(a) * 0.78, Math.cos(a) * 0.78, 0.02]}
              fontSize={0.16}
              color="#f0e6c8"
              anchorX="center"
              anchorY="middle"
            >
              {label}
            </Text>
          );
        })}
      </group>

      <mesh position={[0, 1.18, 0.05]}>
        <coneGeometry args={[0.1, 0.25, 8]} />
        <meshStandardMaterial color="#e0c050" />
      </mesh>

      <mesh position={[-1.5, 0, 0]} onClick={() => send({ type: 'dial.set', value: (state.pos - 1 + n) % n })}>
        <boxGeometry args={[0.3, 0.3, 0.3]} />
        <meshStandardMaterial color="#5a4a7a" />
      </mesh>
      <mesh position={[1.5, 0, 0]} onClick={() => send({ type: 'dial.set', value: (state.pos + 1) % n })}>
        <boxGeometry args={[0.3, 0.3, 0.3]} />
        <meshStandardMaterial color="#5a4a7a" />
      </mesh>
      <mesh position={[0, -1.5, 0]} onClick={() => send({ type: 'dial.commit' })}>
        <boxGeometry args={[0.5, 0.3, 0.3]} />
        <meshStandardMaterial color="#4a7a5a" />
      </mesh>
      <mesh position={[1.5, -1.5, 0]} onClick={() => send({ type: 'dial.clear' })}>
        <boxGeometry args={[0.3, 0.3, 0.3]} />
        <meshStandardMaterial color="#7a4a4a" />
      </mesh>

      <Text position={[0, -1.05, 0.05]} fontSize={0.14} color="#bdb6d6" anchorX="center">
        {`entered: ${enteredLabels.join(' ') || '—'}`}
      </Text>
    </group>
  );
}
