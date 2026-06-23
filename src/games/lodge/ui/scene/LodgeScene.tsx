import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import { useLodgeStore } from '@/games/lodge/ui/store/useLodgeStore';
import { stationFor } from './stations/registry';

const SLOT_X = [-3, 0, 3];

export function LodgeScene() {
  const runState = useLodgeStore((s) => s.runState);
  const selected = useLodgeStore((s) => s.selectedPuzzleId);
  const select = useLodgeStore((s) => s.select);
  const dispatch = useLodgeStore((s) => s.dispatch);
  const puzzles = runState.run.puzzles;

  const selectedIndex = puzzles.findIndex((p) => p.id === selected);
  const targetX = SLOT_X[selectedIndex] ?? 0;

  return (
    <Canvas camera={{ position: [0, 1.5, 7], fov: 50 }} style={{ position: 'absolute', inset: 0 }}>
      <color attach="background" args={['#0a0712']} />
      <ambientLight intensity={0.25} />
      <pointLight position={[0, 3, 4]} intensity={40} color="#ffd0a0" />
      <pointLight position={[-4, 2, 2]} intensity={15} color="#a0c0ff" />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#140e1e" />
      </mesh>

      {puzzles.map((puzzle, i) => {
        const lockView = puzzle.views[puzzle.lockOwner];
        const Station = stationFor(lockView.kind);
        const x = SLOT_X[i] ?? (i - (puzzles.length - 1) / 2) * 3;
        const isSel = puzzle.id === selected;
        return (
          <group key={puzzle.id} position={[x, 0, 0]} scale={isSel ? 1.1 : 0.9}>
            <mesh position={[0, -1.25, 0]} onClick={() => select(puzzle.id)}>
              <boxGeometry args={[2.4, 0.2, 1.2]} />
              <meshStandardMaterial color={isSel ? '#2a2440' : '#171323'} />
            </mesh>
            {Station ? (
              <Station puzzle={puzzle} dispatch={dispatch} />
            ) : (
              <Text fontSize={0.2} color="#ff8888">{`?${lockView.kind}`}</Text>
            )}
            {puzzle.solved && (
              <Text position={[0, 1.7, 0]} fontSize={0.4} color="#7CFC9A" anchorX="center">
                ✓
              </Text>
            )}
          </group>
        );
      })}

      <OrbitControls target={[targetX, 0, 0]} enablePan={false} makeDefault />
    </Canvas>
  );
}
