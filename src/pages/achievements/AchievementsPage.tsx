import { useState } from 'react';
import type { AchievementScope } from '@/types/achievements';
import { useAchievementStore } from '@/stores/useAchievementStore';
import { AchievementBadge } from '@/ui/profile/AchievementBadge';
import { SectionTitle } from '@/ui/primitives/SectionTitle';
import { ProgressBar } from '@/ui/primitives/ProgressBar';
import { cx } from '@/core/utils';

type Tab = 'all' | AchievementScope;

const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'global', label: 'Портал' },
  { key: 'colony', label: 'Colony' },
  { key: 'shadow', label: 'Shadow Trace' },
];

export function AchievementsPage() {
  const [tab, setTab] = useState<Tab>('all');
  const defs = useAchievementStore((s) => s.defs);
  const progress = useAchievementStore((s) => s.progress);
  const points = useAchievementStore((s) => s.points);

  const visible = defs.filter((d) => tab === 'all' || d.scope === tab);
  const unlockedCount = visible.filter((d) => progress[d.id]?.unlocked).length;

  return (
    <div>
      <SectionTitle eyebrow="прогресс" title="Достижения" />

      <div className="panel-glass mb-6 flex flex-wrap items-center gap-6 p-5">
        <div>
          <p className="font-display text-3xl text-ink">
            {points.earned}
            <span className="text-base text-muted">/{points.total}</span>
          </p>
          <p className="label-mono mt-1">очков опыта</p>
        </div>
        <div className="min-w-[200px] flex-1">
          <div className="mb-1.5 flex justify-between font-mono text-xs text-muted">
            <span>открыто {unlockedCount}</span>
            <span>{visible.length} всего</span>
          </div>
          <ProgressBar value={points.total ? points.earned / points.total : 0} />
        </div>
      </div>

      <div className="mb-5 inline-flex flex-wrap gap-1 rounded-xl border border-edge/60 bg-panel/40 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            aria-pressed={tab === t.key}
            className={cx(
              'rounded-lg px-4 py-1.5 font-display text-sm tracking-wide transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
              tab === t.key ? 'bg-accent/15 text-accent shadow-e1' : 'text-muted hover:text-ink',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {visible.map((d) => (
          <AchievementBadge key={d.id} def={d} progress={progress[d.id]} />
        ))}
      </div>
    </div>
  );
}
