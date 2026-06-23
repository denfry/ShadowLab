import { SaveManager } from '@/services/save/SaveManager';
import { useAchievementStore } from '@/stores/useAchievementStore';
import { buildProgressTiles } from './progressModel';

export function ProgressSummary() {
  const progress = useAchievementStore((s) => s.progress);
  const defs = useAchievementStore((s) => s.defs);
  const unlocked = Object.values(progress).filter((p) => p.unlocked).length;
  const tiles = buildProgressTiles(SaveManager.getFile(), unlocked, defs.length, SaveManager.getRecords());

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="panel p-4">
          <p className="font-display text-2xl text-ink neon-text">{t.value}</p>
          <p className="mt-1 text-xs text-muted">{t.label}</p>
        </div>
      ))}
    </div>
  );
}
