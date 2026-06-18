import type { GameDefinition } from '@/types/game-module';

export const COLONY_DEFINITION: GameDefinition = {
  id: 'colony',
  title: 'Colony Survival',
  tagline: 'Выживи. Веди своих людей сквозь зиму, болезни и набеги.',
  description:
    'Симулятор выживания колонии: колонисты-личности с чертами, навыками и нуждами ходят ' +
    'по миру, работают и борются за жизнь. Управляй приоритетами, стройся, готовься к зиме.',
  theme: 'colony',
  status: 'available',
  tags: ['strategy', 'colony-sim', 'survival'],
  bootHint: 'Генерируем мир…',
};
