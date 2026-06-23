// src/games/lodge/dev/NetGameView.tsx
import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useLodgeStore } from '@/games/lodge/ui/store/useLodgeStore';
import { stationFor } from '@/games/lodge/ui/scene/stations/registry';
import { ClueCard } from '@/games/lodge/ui/ClueCard';
import { LodgeSession } from '@/games/lodge/net';
import type { PeerInfo, Transport } from '@/games/lodge/net';
import { BroadcastChannelTransport } from '@/games/lodge/net/transports/broadcastChannel';
import { SupabaseBroadcastTransport, supabaseConfigured } from '@/games/lodge/net/transports/supabase';
import type { LobbyResult } from './LobbyScreen';
import type { Role, PuzzleEvent } from '@/games/lodge/engine';

function makeId(): string {
  return 'p-' + Math.random().toString(36).slice(2, 10);
}

export function NetGameView({ lobby, onExit }: { lobby: LobbyResult; onExit: () => void }) {
  const runState = useLodgeStore((s) => s.runState);
  const applyServerEvent = useLodgeStore((s) => s.applyServerEvent);
  const setRunState = useLodgeStore((s) => s.setRunState);
  const [role, setRole] = useState<Role | null>(null);
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [hostLeft, setHostLeft] = useState(false);
  const sessionRef = useRef<LodgeSession | null>(null);

  useEffect(() => {
    const selfId = makeId();
    const transport: Transport = supabaseConfigured()
      ? new SupabaseBroadcastTransport(selfId, lobby.name, lobby.code)
      : new BroadcastChannelTransport(selfId, lobby.name, lobby.code);
    const session = new LodgeSession(transport, { name: lobby.name, isHost: lobby.isHost }, {
      applyServerEvent,
      setRunState,
      getRunState: () => useLodgeStore.getState().runState,
      onRoom: (r) => setRole(r),
      onPeers: (p) => setPeers(p),
      onHostLeft: () => setHostLeft(true),
    });
    sessionRef.current = session;
    void session.start();
    return () => session.dispose();
  }, [lobby, applyServerEvent, setRunState]);

  const session = sessionRef.current;
  const puzzles = runState.run.puzzles;
  const myLockPuzzles = role ? puzzles.filter((p) => p.lockOwner === role) : [];
  const myCluePuzzles = role ? puzzles.filter((p) => p.clueOwner === role) : [];
  const guest = peers.find((p) => p.id !== (session ? (session.hostId ?? '') : ''));
  const act = (puzzleId: string, _by: Role, event: PuzzleEvent) => session?.submit(puzzleId, event);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0a0712' }}>
      <Canvas camera={{ position: [0, 1.5, 7], fov: 50 }} style={{ position: 'absolute', inset: 0 }}>
        <color attach="background" args={['#0a0712']} />
        <ambientLight intensity={0.25} />
        <pointLight position={[0, 3, 4]} intensity={40} color="#ffd0a0" />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
          <planeGeometry args={[40, 40]} />
          <meshStandardMaterial color="#140e1e" />
        </mesh>
        {myLockPuzzles.map((puzzle, i) => {
          const Station = stationFor(puzzle.views[puzzle.lockOwner].kind);
          const x = (i - (myLockPuzzles.length - 1) / 2) * 3;
          return (
            <group key={puzzle.id} position={[x, 0, 0]}>
              {Station ? <Station puzzle={puzzle} dispatch={act} /> : null}
            </group>
          );
        })}
        <OrbitControls enablePan={false} makeDefault />
      </Canvas>

      <div style={{ position: 'absolute', top: 12, left: 12, color: '#e8e0ff', font: '13px monospace', pointerEvents: 'none' }}>
        <div>Код: {lobby.code} · Роль: {role ?? '—'} · Связь: {peers.length}/2</div>
        <div>Решено: {runState.solvedCount}/{puzzles.length}</div>
        {runState.escaped && <div style={{ color: '#7CFC9A', fontSize: 22 }}>ESCAPED ✓</div>}
        {hostLeft && <div style={{ color: '#ff8888' }}>Хост покинул комнату.</div>}
      </div>

      <div style={{ position: 'absolute', top: 12, right: 12, width: 300, maxHeight: '92vh', overflow: 'auto' }}>
        {lobby.isHost && role === null && (
          <button
            disabled={!guest}
            onClick={() => guest && session?.startRun(Math.floor(Math.random() * 0xffffffff), 'standard', guest.id)}
          >
            Старт (нужен второй игрок)
          </button>
        )}
        {myCluePuzzles.map((p) => <ClueCard key={p.id} puzzle={p} />)}
        <button style={{ marginTop: 8 }} onClick={onExit}>Выйти</button>
      </div>
    </div>
  );
}
