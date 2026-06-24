import type { GameDefinition } from '@/types/game-module';

/** Shared per-theme presentation constants for portal surfaces (cards, hero). */
export const GENRE: Record<GameDefinition['theme'], string> = {
  colony: 'стратегия',
  shadow: 'детектив',
};

export const EMBLEM: Record<GameDefinition['theme'], string> = {
  colony: '◣',
  shadow: '◈',
};
