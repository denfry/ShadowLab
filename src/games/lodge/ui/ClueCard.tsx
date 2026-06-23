import type { PuzzleInstance } from '@/games/lodge/engine';

export function ClueCard({ puzzle }: { puzzle: PuzzleInstance }) {
  const clue = puzzle.views[puzzle.clueOwner];
  return (
    <div style={{ border: '1px solid #332c44', borderRadius: 8, padding: 10, margin: 6, color: '#e8e0ff', font: '12px monospace', background: 'rgba(10,8,18,0.7)' }}>
      <div style={{ color: '#9fd0ff', marginBottom: 4 }}>
        Подсказка · {puzzle.archetypeId} {puzzle.solved ? '✓' : ''}
      </div>
      <div style={{ wordBreak: 'break-all' }}>{JSON.stringify(clue)}</div>
      <div style={{ color: '#8a86a6', marginTop: 4 }}>Опиши это напарнику голосом.</div>
    </div>
  );
}
