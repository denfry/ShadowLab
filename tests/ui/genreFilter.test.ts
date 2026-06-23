import { describe, it, expect } from 'vitest';
import { availableGenres, filterByGenre } from '@/pages/games/genreFilter';
import type { GameDefinition } from '@/types/game-module';

const g = (id: string, theme: 'colony' | 'shadow') => ({ id, theme } as unknown as GameDefinition);
const games = [g('colony', 'colony'), g('shadow-trace', 'shadow')];

describe('genreFilter', () => {
  it('lists "все" plus each genre present', () => {
    expect(availableGenres(games)).toEqual(['все', 'стратегия', 'детектив']);
  });
  it('returns all for "все"', () => {
    expect(filterByGenre(games, 'все')).toHaveLength(2);
  });
  it('filters by genre', () => {
    expect(filterByGenre(games, 'детектив').map((x) => x.id)).toEqual(['shadow-trace']);
  });
});
