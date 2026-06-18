import type { GameDefinition } from '@/types/game-module';
import type { GameSave } from '@/types/save';
import { GENRE, EMBLEM } from './genre';

export type CardState = 'in-progress' | 'fresh' | 'soon';
export interface CardStat { icon: string; label: string; tone: 'accent' | 'accent2' | 'good' | 'warn' | 'muted'; }

export interface GameCardInput {
  def: GameDefinition;
  lastSave: GameSave | null;
  records: Record<string, number | string | undefined>;
}

export interface GameCardModel {
  id: string; theme: GameDefinition['theme']; title: string; tagline: string;
  genre: string; emblem: string; metaTags: string[];
  state: CardState; stats: CardStat[]; ctaLabel: string;
}

function inProgressStats(input: GameCardInput): CardStat[] {
  const { def, lastSave, records } = input;
  const stats: CardStat[] = [];
  if (def.theme === 'colony') {
    const day = records['colony.bestDay'];
    const wins = records['colony.victories'];
    if (day != null && day !== '' && day !== 0) stats.push({ icon: '⌬', label: `день ${day}`, tone: 'accent' });
    if (typeof wins === 'number' && wins > 0) stats.push({ icon: '⚑', label: `${wins} побед`, tone: 'warn' });
  } else if (lastSave?.label) {
    // Shadow Trace has no numeric "record" to surface — the save label (e.g. "Дело 2") is the live stat.
    stats.push({ icon: '◷', label: lastSave.label, tone: 'accent' });
  }
  if (stats.length === 0 && lastSave?.label) stats.push({ icon: '◷', label: lastSave.label, tone: 'accent' });
  if (stats.length === 0) stats.push({ icon: '▸', label: 'в процессе', tone: 'muted' });
  return stats;
}

export function buildGameCardModel(input: GameCardInput): GameCardModel {
  const { def, lastSave } = input;
  const soon = def.status === 'soon';
  const state: CardState = soon ? 'soon' : lastSave ? 'in-progress' : 'fresh';

  const stats: CardStat[] =
    state === 'soon' ? [{ icon: '◷', label: 'скоро', tone: 'muted' }]
    : state === 'fresh' ? [{ icon: '✦', label: 'ещё не играл', tone: 'muted' }]
    : inProgressStats(input);

  return {
    id: def.id, theme: def.theme, title: def.title, tagline: def.tagline,
    genre: GENRE[def.theme], emblem: EMBLEM[def.theme], metaTags: def.tags.slice(0, 3),
    state, stats, ctaLabel: state === 'in-progress' ? 'Продолжить' : 'Открыть',
  };
}
