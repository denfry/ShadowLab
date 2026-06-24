import type { GameDefinition } from '@/types/game-module';

export const LODGE_DEFINITION: GameDefinition = {
  id: 'lodge',
  title: 'Зеркальная Ложа',
  tagline: 'Кооп-побег на двоих. Опиши, что видишь — и выберитесь вместе.',
  description:
    'Реалтайм кооп-эскейп на двоих в 3D: вы в зеркальных крыльях оккультной ложи. ' +
    'Подсказки к твоим механизмам спрятаны у напарника — говорите голосом, ' +
    'проворачивайте ритуальные пазлы и выберитесь вместе.',
  theme: 'shadow',
  status: 'available',
  tags: ['co-op', 'multiplayer', 'puzzle', '3d'],
  bootHint: 'Зажигаем свечи…',
};
