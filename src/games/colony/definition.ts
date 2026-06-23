import type { GameDefinition } from '@/types/game-module';

export const COLONY_DEFINITION: GameDefinition = {
  id: 'colony',
  title: 'Colony Survival',
  tagline: 'Построй город в процедурном мире 256×256 — и удержи его живым.',
  description:
    'Градостроительный симулятор в духе Farthest Frontier: огромная процедурная карта 256×256, ' +
    'до 200+ жителей с характерами, навыками и нуждами, иерархическая навигация и сезонное ' +
    'выживание. Управляй приоритетами, стройся, готовься к зиме.',
  theme: 'colony',
  status: 'available',
  tags: ['strategy', 'colony-sim', 'survival'],
  bootHint: 'Генерируем мир…',
};
