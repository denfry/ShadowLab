import { describe, it, expect } from 'vitest';
import { decideSync, isMeaningfulSave } from '@/services/cloud/mergeDecision';
import { defaultSaveFile } from '@/services/save/defaults';
import type { SaveFile } from '@/types/save';

function meaningful(): SaveFile {
  const f = defaultSaveFile();
  f.records['colony.bestDay'] = 5;
  return f;
}

describe('isMeaningfulSave', () => {
  it('is false for a default save', () => {
    expect(isMeaningfulSave(defaultSaveFile())).toBe(false);
  });
  it('is true once there is progress', () => {
    expect(isMeaningfulSave(meaningful())).toBe(true);
  });
});

describe('decideSync', () => {
  it('pushes a meaningful local with no cloud', () => {
    expect(decideSync(meaningful(), null)).toBe('push');
  });
  it('noops a default local with no cloud', () => {
    expect(decideSync(defaultSaveFile(), null)).toBe('noop');
  });
  it('pulls when local is default and cloud has data', () => {
    expect(decideSync(defaultSaveFile(), { data: meaningful() })).toBe('pull');
  });
  it('pushes when local has data and cloud is default', () => {
    expect(decideSync(meaningful(), { data: defaultSaveFile() })).toBe('push');
  });
  it('noops when both equal and meaningful', () => {
    const f = meaningful();
    expect(decideSync(f, { data: JSON.parse(JSON.stringify(f)) })).toBe('noop');
  });
  it('conflicts when both meaningful and different', () => {
    const a = meaningful();
    const b = meaningful();
    b.records['colony.bestDay'] = 99;
    expect(decideSync(a, { data: b })).toBe('conflict');
  });
  it('treats key-order differences as equal (no spurious conflict)', () => {
    const a = meaningful();
    a.records = { 'colony.bestDay': 5, 'shadow.bestScore': 9 };
    // b is a deep clone of a with keys inserted in a different order
    const b: SaveFile = JSON.parse(JSON.stringify(a));
    b.records = { 'shadow.bestScore': 9, 'colony.bestDay': 5 }; // same data, different order
    expect(decideSync(a, { data: b })).toBe('noop');
  });
});
