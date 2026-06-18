import type { GameDefinition } from '@/types/game-module';

export const COLONY_DEFINITION: GameDefinition = {
  id: 'colony',
  title: 'Colony Evolution',
  tagline: 'Построй колонию. Переживи мир.',
  description:
    'Динамическая стратегия выживания: управляй ресурсами, жителями и зданиями. ' +
    'Мир реагирует на твои решения — еда, мораль, погода, болезни и события каждый день.',
  theme: 'colony',
  status: 'available',
  tags: ['strategy', 'colony-sim', 'survival'],
  bootHint: 'Генерируем мир…',
};
