import { useState } from 'react';
import { useProfileStore } from '@/stores/useProfileStore';
import { useAchievementStore } from '@/stores/useAchievementStore';
import { SaveManager } from '@/services/save/SaveManager';
import { GameRegistry } from '@/services/games/GameRegistry';
import { Avatar } from '@/ui/profile/ProfileWidget';
import { Button } from '@/ui/primitives/Button';
import { SectionTitle } from '@/ui/primitives/SectionTitle';
import { AchievementBadge } from '@/ui/profile/AchievementBadge';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel-inset p-4">
      <p className="font-display text-2xl text-ink">{value}</p>
      <p className="label-mono mt-1">{label}</p>
    </div>
  );
}

export function ProfilePage() {
  const profile = useProfileStore((s) => s.profile);
  const setDisplayName = useProfileStore((s) => s.setDisplayName);
  const defs = useAchievementStore((s) => s.defs);
  const progress = useAchievementStore((s) => s.progress);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.displayName);

  const stats = SaveManager.getProfile().stats;
  const playMin = Math.round(stats.totalPlaytimeSec / 60);
  const recent = defs
    .filter((d) => progress[d.id]?.unlocked)
    .sort((a, b) => (progress[b.id].unlockedAt ?? '').localeCompare(progress[a.id].unlockedAt ?? ''))
    .slice(0, 4);

  return (
    <div className="space-y-12">
      <section className="panel flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
        <Avatar name={profile.displayName} size={72} />
        <div className="flex-1">
          {editing ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={24}
                className="rounded-lg border border-edge/70 bg-bg-2 px-3 py-2 font-display text-ink outline-none focus:border-accent/60"
              />
              <Button
                size="sm"
                onClick={() => {
                  setDisplayName(name.trim() || 'Investigator');
                  setEditing(false);
                }}
              >
                Сохранить
              </Button>
              <Button size="sm" variant="subtle" onClick={() => setEditing(false)}>
                Отмена
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <h1 className="font-display text-3xl font-bold text-ink">{profile.displayName}</h1>
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                Изменить
              </Button>
            </div>
          )}
          <p className="mt-1 font-mono text-xs text-muted">
            id {profile.id} · с {profile.createdAt.slice(0, 10)}
          </p>
          <p className="mt-2 chip">
            {profile.cloudLinked ? 'облако подключено' : 'локальный профиль · облако в v1.0'}
          </p>
        </div>
      </section>

      <section>
        <SectionTitle eyebrow="статистика" title="Сводка" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="время в игре" value={`${playMin} мин`} />
          <Stat label="запусков всего" value={String(Object.values(stats.gamesPlayed).reduce((a, b) => a + b, 0))} />
          {GameRegistry.getAll().map((g) => (
            <Stat key={g.id} label={g.title} value={`${stats.gamesPlayed[g.id] ?? 0} зап.`} />
          ))}
        </div>
      </section>

      <section>
        <SectionTitle eyebrow="последнее" title="Недавние достижения" />
        {recent.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {recent.map((d) => (
              <AchievementBadge key={d.id} def={d} progress={progress[d.id]} />
            ))}
          </div>
        ) : (
          <p className="panel p-6 text-sm text-muted">
            Пока нет достижений. Запусти игру, чтобы открыть первое.
          </p>
        )}
      </section>
    </div>
  );
}
