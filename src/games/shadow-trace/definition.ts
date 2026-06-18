import type { GameDefinition } from '@/types/game-module';

export const SHADOW_TRACE_DEFINITION: GameDefinition = {
  id: 'shadow-trace',
  title: 'Shadow Trace',
  tagline: 'Расследуй. Связывай. Обвиняй.',
  description:
    'Детективная головоломка: изучай улики, документы и логи, строй связи на доске и найди, ' +
    'кто стоит за исчезновением. Одна улика — фальшивая. Все данные вымышлены.',
  theme: 'shadow',
  status: 'available',
  tags: ['detective', 'logic', 'investigation'],
  bootHint: 'Открываем материалы дела…',
};
