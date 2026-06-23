import type { AchievementDefinition, AchievementProgress } from '@/types/achievements';
import { ProgressBar } from '@/ui/primitives/ProgressBar';
import { cx } from '@/core/utils';

interface AchievementBadgeProps {
  def: AchievementDefinition;
  progress: AchievementProgress;
}

export function AchievementBadge({ def, progress }: AchievementBadgeProps) {
  const locked = !progress.unlocked;
  const isHidden = def.hidden && locked;
  const showCounter = def.type === 'counter' && !progress.unlocked;

  return (
    <div
      className={cx(
        'panel relative flex gap-3 p-4 shadow-e1 transition-all',
        progress.unlocked ? 'border-accent/40 shadow-glow' : 'opacity-90 hover:opacity-100',
      )}
    >
      <span
        className={cx(
          'grid h-12 w-12 shrink-0 place-items-center rounded-xl text-2xl',
          progress.unlocked ? 'bg-accent/15' : 'bg-bg-2 grayscale',
        )}
      >
        {isHidden ? '❔' : def.icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-display text-sm font-medium text-ink">
            {isHidden ? 'Секретное достижение' : def.title}
          </p>
          <span className="ml-auto font-mono text-[0.65rem] text-muted">{def.points}p</span>
        </div>
        <p className="mt-0.5 text-xs text-muted">
          {isHidden ? 'Условие скрыто — откройте, чтобы узнать.' : def.description}
        </p>
        {showCounter && (
          <div className="mt-2.5">
            <div className="mb-1 flex justify-between font-mono text-[0.65rem] text-muted">
              <span>прогресс</span>
              <span>
                {progress.current}/{progress.target}
              </span>
            </div>
            <ProgressBar value={progress.target ? progress.current / progress.target : 0} />
          </div>
        )}
        {progress.unlocked && (
          <p className="mt-2 font-mono text-[0.65rem] text-accent">
            ✓ получено{progress.unlockedAt ? ` · ${progress.unlockedAt.slice(0, 10)}` : ''}
          </p>
        )}
      </div>
    </div>
  );
}
