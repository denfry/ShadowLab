import { GameRegistry } from '@/services/games/GameRegistry';
import { GameCard } from '@/ui/game/GameCard';
import { SectionTitle } from '@/ui/primitives/SectionTitle';

export function GamesPage() {
  const games = GameRegistry.getAll();
  return (
    <div>
      <SectionTitle eyebrow="каталог" title="Все игры" />
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {games.map((def, i) => (
          <GameCard key={def.id} def={def} index={i} />
        ))}
      </div>
    </div>
  );
}
