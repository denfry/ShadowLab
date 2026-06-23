// src/games/lodge/ui/hud/LodgeHud.tsx
import { useLodgeStore } from '@/games/lodge/ui/store/useLodgeStore';

export function LodgeHud() {
  const runState = useLodgeStore((s) => s.runState);
  const total = runState.run.puzzles.length;
  return (
    <div
      style={{
        position: 'absolute', top: 12, left: 12, color: '#e8e0ff',
        font: '13px monospace', pointerEvents: 'none', lineHeight: 1.5,
      }}
    >
      <div>СВЯЗЬ: LOCAL · СВЕЧИ: —</div>
      <div>Оперируй замок по подсказке партнёра (панель справа).</div>
      <div>Решено: {runState.solvedCount}/{total}</div>
      {runState.escaped && <div style={{ color: '#7CFC9A', fontSize: 22 }}>ESCAPED ✓</div>}
    </div>
  );
}
