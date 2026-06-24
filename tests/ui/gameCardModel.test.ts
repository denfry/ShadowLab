import { describe, it, expect } from 'vitest';
import { buildGameCardModel } from '@/ui/game/gameCardModel';
import type { GameDefinition } from '@/types/game-module';
import type { GameSave } from '@/types/save';

const shadowDef = {
  id: 'shadow-trace', title: 'Shadow Trace', tagline: 'Расследуй.',
  theme: 'shadow', status: 'available', tags: ['detective', 'logic'],
} as unknown as GameDefinition;

const colonyDef = {
  id: 'colony', title: 'Colony Evolution', tagline: 'Построй колонию.',
  theme: 'colony', status: 'available', tags: ['strategy', 'survival'],
} as unknown as GameDefinition;

const save = (label: string) => ({ slot: 0, label, updatedAt: '2026-06-18T00:00:00Z' } as unknown as GameSave);

describe('buildGameCardModel', () => {
  it('maps genre + emblem by theme', () => {
    expect(buildGameCardModel({ def: shadowDef, lastSave: null, records: {} }).genre).toBe('детектив');
    expect(buildGameCardModel({ def: colonyDef, lastSave: null, records: {} }).genre).toBe('стратегия');
    expect(buildGameCardModel({ def: shadowDef, lastSave: null, records: {} }).emblem).toBe('◈');
  });

  it('is "fresh" with a single status chip when no save', () => {
    const m = buildGameCardModel({ def: colonyDef, lastSave: null, records: {} });
    expect(m.state).toBe('fresh');
    expect(m.ctaLabel).toBe('Открыть');
    expect(m.stats).toEqual([{ icon: '✦', label: 'ещё не играл', tone: 'muted' }]);
  });

  it('is "soon" for soon status regardless of save', () => {
    const soon = { ...colonyDef, status: 'soon' } as GameDefinition;
    const m = buildGameCardModel({ def: soon, lastSave: save('x'), records: {} });
    expect(m.state).toBe('soon');
    expect(m.stats[0].label).toBe('скоро');
  });

  it('is "in-progress" with CTA "Продолжить" and themed stats from records', () => {
    const m = buildGameCardModel({
      def: colonyDef, lastSave: save('Поселение'),
      records: { 'colony.bestDay': 14, 'colony.victories': 1 },
    });
    expect(m.state).toBe('in-progress');
    expect(m.ctaLabel).toBe('Продолжить');
    expect(m.stats).toEqual([
      { icon: '⌬', label: 'день 14', tone: 'accent' },
      { icon: '⚑', label: '1 побед', tone: 'warn' },
    ]);
  });

  it('omits absent record-based stats, falling back to the save label', () => {
    const m = buildGameCardModel({ def: shadowDef, lastSave: save('Дело 2'), records: {} });
    expect(m.state).toBe('in-progress');
    expect(m.stats).toEqual([{ icon: '◷', label: 'Дело 2', tone: 'accent' }]);
  });
});
