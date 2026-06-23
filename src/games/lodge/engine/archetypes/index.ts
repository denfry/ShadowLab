import type { Archetype } from '../types';
import { dialArchetype } from './dial';
import { constellationArchetype } from './constellation';
import { candleArchetype } from './candle';

export const ARCHETYPES: Record<string, Archetype> = {
  dial: dialArchetype,
  constellation: constellationArchetype,
  candle: candleArchetype,
};

export const ARCHETYPE_IDS: string[] = Object.keys(ARCHETYPES);
