import { useState } from 'react';
import { makeRoomCode, isValidRoomCode } from '@/games/lodge/net';

export interface LobbyResult {
  name: string;
  code: string;
  isHost: boolean;
}

export function LobbyScreen({ onStart }: { onStart: (r: LobbyResult) => void }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const ready = name.trim().length > 0;

  const create = () => onStart({ name: name.trim(), code: makeRoomCode(Math.random), isHost: true });
  const join = () => {
    const c = code.trim().toUpperCase();
    if (isValidRoomCode(c)) onStart({ name: name.trim(), code: c, isHost: false });
  };

  return (
    <div style={{ maxWidth: 420, margin: '60px auto', color: '#e8e0ff', font: '14px monospace' }}>
      <h2>Зеркальная Ложа — лобби</h2>
      <label style={{ display: 'block', margin: '12px 0 4px' }}>Имя</label>
      <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%' }} />
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button disabled={!ready} onClick={create}>Создать комнату</button>
      </div>
      <div style={{ marginTop: 16 }}>
        <label style={{ display: 'block', marginBottom: 4 }}>Код комнаты</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="ABCDEF" style={{ flex: 1 }} />
          <button disabled={!ready || !isValidRoomCode(code.trim().toUpperCase())} onClick={join}>Войти</button>
        </div>
      </div>
      <p style={{ color: '#8a86a6', marginTop: 16 }}>Подсказка: открой эту страницу в двух вкладках — создай комнату в одной, войди по коду в другой (транспорт BroadcastChannel). Seed выберет хост.</p>
    </div>
  );
}
