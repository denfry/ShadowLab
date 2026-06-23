import type { GameDefinition } from '@/types/game-module';
import { GENRE } from '@/ui/game/genre';

/** ['все', ...each distinct genre present in the catalog]. */
export function availableGenres(games: GameDefinition[]): string[] {
  const seen: string[] = [];
  for (const g of games) {
    const genre = GENRE[g.theme];
    if (!seen.includes(genre)) seen.push(genre);
  }
  return ['все', ...seen];
}

export function filterByGenre(games: GameDefinition[], genre: string): GameDefinition[] {
  if (genre === 'все') return games;
  return games.filter((g) => GENRE[g.theme] === genre);
}
