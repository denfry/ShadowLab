import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GameRegistry } from '@/services/games/GameRegistry';
import { SaveManager } from '@/services/save/SaveManager';
import { NewsService, type NewsPost } from '@/services/news/NewsService';
import type { GameDefinition } from '@/types/game-module';
import type { GameSave } from '@/types/save';
import { GameCard } from '@/ui/game/GameCard';
import { Button } from '@/ui/primitives/Button';
import { SectionTitle } from '@/ui/primitives/SectionTitle';
import { IconPlay, IconSpark } from '@/ui/icons';

interface Continue {
  def: GameDefinition;
  save: GameSave;
}

export function HomePage() {
  const games = GameRegistry.getAll();
  const [news, setNews] = useState<NewsPost[]>([]);
  const [cont, setCont] = useState<Continue | null>(null);

  useEffect(() => {
    void NewsService.list().then((p) => setNews(p.slice(0, 3)));
    // Most recent save across all games.
    let best: Continue | null = null;
    for (const def of games) {
      const save = SaveManager.lastPlayed(def.id);
      if (save && (!best || save.updatedAt > best.save.updatedAt)) best = { def, save };
    }
    setCont(best);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-14">
      {/* Hero */}
      <section className="scanlines relative overflow-hidden rounded-3xl border border-edge/60 bg-panel/40 p-8 md:p-12">
        <div className="absolute -right-24 -top-24 h-72 w-72 animate-float rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute -bottom-24 left-10 h-64 w-64 rounded-full bg-accent2/10 blur-3xl" />
        <motion.div
          className="relative max-w-2xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="chip mb-5">
            <IconSpark width={14} height={14} /> ShadowLab · игровой портал
          </span>
          <h1 className="font-display text-4xl font-bold leading-tight tracking-wide text-ink neon-text md:text-6xl">
            Запускай миры <br /> прямо в браузере
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted md:text-lg">
            Две игры, один профиль. Развивай живую колонию или раскрывай детективные дела —
            прогресс, достижения и сохранения общие для всего портала.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/games">
              <Button size="lg" icon={<IconPlay width={18} height={18} />}>
                Выбрать игру
              </Button>
            </Link>
            <Link to="/about">
              <Button size="lg" variant="ghost">
                О проекте
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Continue */}
      {cont && (
        <section>
          <SectionTitle eyebrow="продолжить" title="С того же места" />
          <div data-theme={cont.def.theme} className="panel flex flex-wrap items-center gap-4 p-5">
            <div className="grid h-14 w-14 place-items-center rounded-xl bg-accent/15 text-2xl text-accent">
              {cont.def.theme === 'colony' ? '◣' : '◈'}
            </div>
            <div className="min-w-0">
              <p className="font-display text-lg text-ink">{cont.def.title}</p>
              <p className="font-mono text-xs text-muted">{cont.save.label}</p>
            </div>
            <Link to={`/play/${cont.def.id}?slot=${cont.save.slot}`} className="ml-auto">
              <Button icon={<IconPlay width={16} height={16} />}>Продолжить</Button>
            </Link>
          </div>
        </section>
      )}

      {/* Games */}
      <section>
        <SectionTitle
          eyebrow="каталог"
          title="Игры"
          action={
            <Link to="/games" className="font-display text-sm text-accent hover:underline">
              Все игры →
            </Link>
          }
        />
        <div className="grid gap-6 sm:grid-cols-2">
          {games.map((def, i) => (
            <GameCard key={def.id} def={def} index={i} />
          ))}
        </div>
      </section>

      {/* News */}
      <section>
        <SectionTitle
          eyebrow="журнал"
          title="Новости"
          action={
            <Link to="/news" className="font-display text-sm text-accent hover:underline">
              Все новости →
            </Link>
          }
        />
        <div className="grid gap-3">
          {news.map((post) => (
            <Link
              key={post.slug}
              to={`/news/${post.slug}`}
              className="panel flex items-center gap-4 p-4 transition-all hover:border-accent/40"
            >
              <span className="chip shrink-0">{post.tag}</span>
              <div className="min-w-0">
                <p className="truncate font-display text-sm text-ink">{post.title}</p>
                <p className="truncate text-xs text-muted">{post.excerpt}</p>
              </div>
              <span className="ml-auto font-mono text-[0.65rem] text-muted">{post.date.slice(0, 10)}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
