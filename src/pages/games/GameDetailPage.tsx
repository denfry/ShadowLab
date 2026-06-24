import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { GameRegistry } from '@/services/games/GameRegistry';
import { SaveManager } from '@/services/save/SaveManager';
import { AchievementManager } from '@/services/achievements/AchievementManager';
import { useAchievementStore } from '@/stores/useAchievementStore';
import { usePageTheme } from '@/ui/hooks/usePageTheme';
import type { GameId } from '@/types/game-module';
import type { GameSave } from '@/types/save';
import { Button } from '@/ui/primitives/Button';
import { SaveSlotCard } from '@/ui/game/SaveSlotCard';
import { AchievementBadge } from '@/ui/profile/AchievementBadge';
import { SectionTitle } from '@/ui/primitives/SectionTitle';
import { Tag } from '@/ui/primitives/Tag';
import { StatChip } from '@/ui/primitives/StatChip';
import { CaseBrowser } from './CaseBrowser';
import { IconPlay } from '@/ui/icons';

const MANUAL_SLOTS = [1, 2, 3];

export function GameDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const def = id && GameRegistry.has(id) ? GameRegistry.getDefinition(id as GameId)! : null;
  usePageTheme(def?.theme ?? 'portal');

  const [tick, setTick] = useState(0);
  const progress = useAchievementStore((s) => s.progress);

  if (!def) {
    return (
      <div className="panel p-8 text-center">
        <p className="text-muted">Игра не найдена.</p>
        <Link to="/games" className="mt-3 inline-block text-accent hover:underline">
          ← к каталогу
        </Link>
      </div>
    );
  }

  const scope = def.theme; // 'colony' | 'shadow'
  const achievements = AchievementManager.forScope(scope);
  const autosave = SaveManager.getSlot(def.id, 0);
  const slots: { slot: number; save: GameSave | null }[] = [
    { slot: 0, save: autosave },
    ...MANUAL_SLOTS.map((slot) => ({ slot, save: SaveManager.getSlot(def.id, slot) })),
  ];

  const deleteSlot = (slot: number) => {
    void SaveManager.removeSlot(def.id, slot).then(() => setTick((t) => t + 1));
  };

  return (
    <div className="space-y-12" key={tick}>
      {/* Hero */}
      <section className="hero-surface scanlines p-8 md:p-10">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent/15 blur-3xl" />
        <div className="relative">
          <span className="mb-4 inline-flex">
            <Tag tone={scope === 'colony' ? 'good' : 'accent2'}>
              {scope === 'colony' ? 'стратегия · sim' : 'детектив · logic'}
            </Tag>
          </span>
          <h1 className="font-display text-4xl font-bold tracking-wide text-ink neon-text md:text-5xl">
            {def.title}
          </h1>
          <p className="mt-2 font-display text-lg text-accent">{def.tagline}</p>
          <p className="mt-4 max-w-2xl text-muted">{def.description}</p>
          {scope === 'colony' && (
            <div className="mt-6 flex flex-wrap gap-3">
              <Button size="lg" variant="solid" icon={<IconPlay width={18} height={18} />} onClick={() => navigate(`/play/${def.id}?new=1`)}>
                Новая игра
              </Button>
              {autosave && (
                <Button size="lg" variant="ghost" onClick={() => navigate(`/play/${def.id}?slot=0`)}>
                  Продолжить (auto)
                </Button>
              )}
            </div>
          )}

          {/* Records strip */}
          {scope === 'colony' ? (
            <div className="mt-6 flex flex-wrap gap-2">
              <StatChip icon="⌬" label={`день ${SaveManager.getRecord('colony.bestDay') || '—'}`} />
              <StatChip icon="◆" label={`насел. ${SaveManager.getRecord('colony.bestPop') || '—'}`} tone="accent2" />
              <StatChip icon="⚑" label={`${SaveManager.getRecord('colony.victories')} побед`} tone="warn" />
            </div>
          ) : (
            <p className="mt-5 max-w-2xl rounded-lg border border-edge/60 bg-bg-2/60 p-3 font-mono text-[0.7rem] text-muted">
              ⚠ Все данные в игре вымышлены. Shadow Trace — головоломка, а не инструмент реальной
              слежки, взлома или OSINT по реальным людям.
            </p>
          )}
        </div>
      </section>

      {/* Cases (shadow) or save slots (colony) */}
      {scope === 'shadow' ? (
        <section>
          <SectionTitle eyebrow="материалы" title="Дела" />
          <CaseBrowser />
        </section>
      ) : (
        <section>
          <SectionTitle eyebrow="сохранения" title="Слоты" />
          <div className="grid gap-3">
            {slots.map(({ slot, save }) => (
              <SaveSlotCard
                key={slot}
                slot={slot}
                save={save}
                onLoad={() => navigate(`/play/${def.id}?slot=${slot}`)}
                onDelete={save ? () => deleteSlot(slot) : undefined}
              />
            ))}
          </div>
        </section>
      )}

      {/* Achievements */}
      <section>
        <SectionTitle
          eyebrow="прогресс"
          title="Достижения игры"
          action={
            <Link to="/achievements" className="font-display text-sm text-accent hover:underline">
              Все →
            </Link>
          }
        />
        <div className="grid gap-3 md:grid-cols-2">
          {achievements.map((a) => (
            <AchievementBadge key={a.id} def={a} progress={progress[a.id]} />
          ))}
        </div>
      </section>
    </div>
  );
}
