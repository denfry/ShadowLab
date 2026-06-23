import type { TraitId } from './types';

export interface TraitDef {
  id: TraitId;
  name: string;
  desc: string;
  /** Множитель скорости любой работы. */
  workSpeed: number;
  /** Сдвиг к стартовому здоровью. */
  healthMod: number;
}

export const TRAITS: Record<TraitId, TraitDef> = {
  hardworker: { id: 'hardworker', name: 'Трудоголик', desc: '+20% к скорости работы', workSpeed: 1.2, healthMod: 0 },
  lazy:       { id: 'lazy',       name: 'Ленивый',    desc: '−20% к скорости работы', workSpeed: 0.8, healthMod: 0 },
  frail:      { id: 'frail',      name: 'Хрупкий',    desc: 'Слабое здоровье',        workSpeed: 1.0, healthMod: -20 },
  optimist:   { id: 'optimist',   name: 'Оптимист',   desc: 'Крепкое здоровье',       workSpeed: 1.0, healthMod: +10 },
  bloodlust:  { id: 'bloodlust',  name: 'Кровожадный', desc: 'Силён в бою (Фаза 3)',  workSpeed: 1.0, healthMod: 0 },
  clumsy:     { id: 'clumsy',     name: 'Неуклюжий',  desc: '−10% к скорости работы', workSpeed: 0.9, healthMod: 0 },
};

export const TRAIT_IDS = Object.keys(TRAITS) as TraitId[];
