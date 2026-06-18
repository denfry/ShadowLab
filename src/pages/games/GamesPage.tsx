import { useState } from 'react';
import { GameRegistry } from '@/services/games/GameRegistry';
import { availableGenres, filterByGenre } from '@/pages/games/genreFilter';
import { GameCard } from '@/ui/game/GameCard';
import { SectionTitle } from '@/ui/primitives/SectionTitle';
import { cx } from '@/core/utils';

export function GamesPage() {
  const games = GameRegistry.getAll();
  const genres = availableGenres(games);
  const [genre, setGenre] = useState('все');
  const visible = filterByGenre(games, genre);

  return (
    <div>
      <SectionTitle eyebrow="каталог" title="Все игры" />
      <div className="mb-6 flex flex-wrap gap-2">
        {genres.map((gname) => (
          <button
            key={gname}
            onClick={() => setGenre(gname)}
            className={cx(
              'rounded-xl border px-4 py-2 font-display text-sm capitalize tracking-wide transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
              genre === gname
                ? 'border-accent/50 bg-accent/10 text-accent'
                : 'border-edge/60 text-muted hover:text-ink',
            )}
          >
            {gname}
          </button>
        ))}
      </div>
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((def, i) => (
          <GameCard key={def.id} def={def} index={i} />
        ))}
      </div>
    </div>
  );
}
