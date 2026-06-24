import { useState } from 'react';
import LodgeDevHarness from './LodgeDevHarness';
import { LobbyScreen, type LobbyResult } from './LobbyScreen';
import { NetGameView } from './NetGameView';

type Screen = { s: 'menu' } | { s: 'solo' } | { s: 'lobby' } | { s: 'net'; lobby: LobbyResult };

export default function LodgeDevEntry() {
  const [screen, setScreen] = useState<Screen>({ s: 'menu' });

  if (screen.s === 'solo') return <LodgeDevHarness />;
  if (screen.s === 'lobby') return <LobbyScreen onStart={(lobby) => setScreen({ s: 'net', lobby })} />;
  if (screen.s === 'net') return <NetGameView lobby={screen.lobby} onExit={() => setScreen({ s: 'menu' })} />;

  return (
    <div style={{ maxWidth: 420, margin: '80px auto', color: '#e8e0ff', font: '15px monospace', textAlign: 'center' }}>
      <h1>Зеркальная Ложа · DEV</h1>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24 }}>
        <button onClick={() => setScreen({ s: 'solo' })}>Соло (Этап 1)</button>
        <button onClick={() => setScreen({ s: 'lobby' })}>Мультиплеер</button>
      </div>
    </div>
  );
}
