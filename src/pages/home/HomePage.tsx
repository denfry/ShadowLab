import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GameRegistry } from '@/services/games/GameRegistry';
import { SaveManager } from '@/services/save/SaveManager';
import { NewsService, type NewsPost } from '@/services/news/NewsService';
import { pickContinue, type ContinueEntry } from '@/pages/home/continueModel';
import { GameCard } from '@/ui/game/GameCard';
import { ContinueHero } from '@/ui/home/ContinueHero';
import { SectionTitle } from '@/ui/primitives/SectionTitle';
import { Skeleton } from '@/ui/feedback/Skeleton';

export function HomePage() {
  const games = GameRegistry.getAll();
  const [news, setNews] = useState<NewsPost[] | null>(null);
  const [cont, setCont] = useState<ContinueEntry | null>(null);

  useEffect(() => {
    void NewsService.list().then((p) => setNews(p.slice(0, 3)));
    setCont(pickContinue(games, (id) => SaveManager.lastPlayed(id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fallback = games.find((g) => g.status !== 'soon') ?? games[0];

  return (
    <div className="space-y-14">
      <ContinueHero entry={cont} fallbackGame={fallback} />

      <section>
        <SectionTitle
          eyebrow={cont ? 'открыть новое' : 'каталог'}
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
          {news === null
            ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)
            : news.map((post) => (
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
