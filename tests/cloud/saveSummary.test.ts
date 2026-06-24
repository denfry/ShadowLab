import { describe, it, expect } from 'vitest';
import { summarizeSave, formatPlaytime } from '@/services/cloud/saveSummary';
import { defaultSaveFile } from '@/services/save/defaults';

describe('formatPlaytime', () => {
  it('formats sub-minute, minutes and hours', () => {
    expect(formatPlaytime(0)).toBe('меньше минуты');
    expect(formatPlaytime(90)).toBe('1 мин');
    expect(formatPlaytime(3700)).toBe('1 ч 1 мин');
  });
});

describe('summarizeSave', () => {
  it('summarizes a default save as empty', () => {
    const s = summarizeSave(defaultSaveFile());
    expect(s).toEqual({ playtimeSec: 0, achievementsUnlocked: 0, totalSlots: 0 });
  });
  it('counts unlocked achievements and slots', () => {
    const f = defaultSaveFile();
    f.achievements.unlocked['global.first_launch'] = '2026-06-19T00:00:00.000Z';
    f.games['colony'] = [{ gameId: 'colony', slot: 0, version: 1, createdAt: 'x', updatedAt: 'x', label: 'l', payload: {} }];
    const s = summarizeSave(f);
    expect(s.achievementsUnlocked).toBe(1);
    expect(s.totalSlots).toBe(1);
  });
});
