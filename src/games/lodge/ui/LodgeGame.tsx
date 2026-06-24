import { useState } from 'react';
import type { GameContext } from '@/types/game-module';
import { LobbyScreen, type LobbyResult } from '@/games/lodge/dev/LobbyScreen';
import { NetGameView } from '@/games/lodge/dev/NetGameView';

type Screen = { s: 'lobby' } | { s: 'net'; lobby: LobbyResult };

export function LodgeGame({ ctx }: { ctx: GameContext }) {
  const [screen, setScreen] = useState<Screen>({ s: 'lobby' });

  if (screen.s === 'net') {
    return <NetGameView lobby={screen.lobby} onExit={() => setScreen({ s: 'lobby' })} />;
  }
  return (
    <LobbyScreen
      initialCode={ctx.params.room}
      onExitToPortal={() => ctx.exit()}
      onStart={(lobby) => setScreen({ s: 'net', lobby })}
    />
  );
}
