// src/games/lodge/dev/DevPanel.tsx
import { useState } from 'react';
import { useLodgeStore } from '@/games/lodge/ui/store/useLodgeStore';
import { randomSeed } from '@/core/utils/rng';
import type { Difficulty } from '@/games/lodge/engine';

const DIFFICULTIES: Difficulty[] = ['gentle', 'standard', 'devious'];

export function DevPanel() {
  const runState = useLodgeStore((s) => s.runState);
  const difficulty = useLodgeStore((s) => s.difficulty);
  const selectedPuzzleId = useLodgeStore((s) => s.selectedPuzzleId);
  const seed = useLodgeStore((s) => s.seed);
  const regenerate = useLodgeStore((s) => s.regenerate);
  const autoSolve = useLodgeStore((s) => s.autoSolve);
  const select = useLodgeStore((s) => s.select);
  const [seedInput, setSeedInput] = useState(String(seed));

  const regen = (d: Difficulty) => {
    const n = Number.parseInt(seedInput, 10);
    regenerate(Number.isFinite(n) ? n : randomSeed(), d);
  };

  return (
    <div
      style={{
        position: 'absolute', top: 12, right: 12, width: 300, maxHeight: '92vh', overflow: 'auto',
        background: 'rgba(10,8,18,0.88)', color: '#e8e0ff', font: '12px monospace',
        padding: 12, borderRadius: 8,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>DEV · Зеркальная Ложа</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <input value={seedInput} onChange={(e) => setSeedInput(e.target.value)} style={{ width: 110 }} />
        <button
          onClick={() => {
            const s = randomSeed();
            setSeedInput(String(s));
            regenerate(s, difficulty);
          }}
        >
          rnd
        </button>
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {DIFFICULTIES.map((d) => (
          <button key={d} onClick={() => regen(d)} style={{ fontWeight: d === difficulty ? 700 : 400 }}>
            {d}
          </button>
        ))}
      </div>
      {runState.run.puzzles.map((p) => (
        <div
          key={p.id}
          style={{ borderTop: '1px solid #332c44', paddingTop: 6, marginTop: 6, opacity: p.id === selectedPuzzleId ? 1 : 0.6 }}
        >
          <div>
            <button onClick={() => select(p.id)}>{p.id}</button> {p.archetypeId} {p.solved ? '✓' : ''}
          </div>
          <div style={{ color: '#9fd0ff', wordBreak: 'break-all' }}>
            clue({p.clueOwner}): {JSON.stringify(p.views[p.clueOwner])}
          </div>
          <button onClick={() => autoSolve(p.id)}>auto-solve</button>
        </div>
      ))}
      {runState.escaped && <div style={{ color: '#7CFC9A', marginTop: 8 }}>ESCAPED</div>}
    </div>
  );
}
