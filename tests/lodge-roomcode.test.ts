import { describe, expect, it } from 'vitest';
import { makeRoomCode, isValidRoomCode, ROOM_CODE_ALPHABET } from '@/games/lodge/net/roomCode';
import { makeRng } from '@/games/lodge/engine';

describe('roomCode', () => {
  it('makeRoomCode is deterministic for a given rng and valid', () => {
    const a = makeRoomCode(makeRng(7));
    const b = makeRoomCode(makeRng(7));
    expect(a).toBe(b);
    expect(a).toHaveLength(6);
    expect(isValidRoomCode(a)).toBe(true);
    expect([...a].every((c) => ROOM_CODE_ALPHABET.includes(c))).toBe(true);
  });

  it('isValidRoomCode rejects wrong length, lowercase, and ambiguous chars', () => {
    expect(isValidRoomCode('ABC')).toBe(false);
    expect(isValidRoomCode('abcdef')).toBe(false);
    expect(isValidRoomCode('ABCDE0')).toBe(false); // 0 is not in the alphabet
    expect(isValidRoomCode('ABCDEF')).toBe(true);
  });
});
