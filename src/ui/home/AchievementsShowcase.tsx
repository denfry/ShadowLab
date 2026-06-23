import { useAchievementStore } from '@/stores/useAchievementStore';
import { AchievementManager } from '@/services/achievements/AchievementManager';
import { AchievementBadge } from '@/ui/profile/AchievementBadge';

export function AchievementsShowcase() {
  const progress = useAchievementStore((s) => s.progress);
  const byId = new Map(AchievementManager.getDefinitions().map((d) => [d.id, d]));

  const recent = Object.values(progress)
    .filter((p) => p.unlocked)
    .sort((a, b) => (b.unlockedAt ?? '').localeCompare(a.unlockedAt ?? ''))
    .slice(0, 4);

  if (recent.length === 0) {
    return (
      <p className="panel p-5 text-sm text-muted">
        Пока нет достижений — сыграйте, чтобы открыть первое.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {recent.map((p) => {
        const def = byId.get(p.id);
        return def ? <AchievementBadge key={p.id} def={def} progress={p} /> : null;
      })}
    </div>
  );
}
