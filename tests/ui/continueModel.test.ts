import { describe, it, expect } from 'vitest';
import { pickContinue } from '@/pages/home/continueModel';
import type { GameDefinition } from '@/types/game-module';
import type { GameSave } from '@/types/save';

const def = (id: string) => ({ id, theme: 'colony' } as unknown as GameDefinition);
const save = (updatedAt: string) => ({ slot: 0, label: 'slot', updatedAt } as unknown as GameSave);

describe('pickContinue', () => {
  it('returns null when nothing is saved', () => {
    expect(pickContinue([def('a'), def('b')], () => null)).toBeNull();
  });
  it('returns the most-recently-updated save', () => {
    const map: Record<string, GameSave> = { a: save('2026-06-10'), b: save('2026-06-17') };
    const r = pickContinue([def('a'), def('b')], (id) => map[id] ?? null);
    expect(r?.def.id).toBe('b');
  });
  it('ignores games with no save', () => {
    const map: Record<string, GameSave> = { a: save('2026-06-10') };
    const r = pickContinue([def('a'), def('b')], (id) => map[id] ?? null);
    expect(r?.def.id).toBe('a');
  });
});
