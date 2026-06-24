// Crockford-ish: no 0/O/1/I to avoid read-aloud ambiguity over voice.
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function makeRoomCode(rng: () => number, len = 6): string {
  let out = '';
  for (let i = 0; i < len; i++) {
    out += ROOM_CODE_ALPHABET[Math.floor(rng() * ROOM_CODE_ALPHABET.length)];
  }
  return out;
}

export function isValidRoomCode(code: string): boolean {
  return (
    typeof code === 'string' &&
    code.length === 6 &&
    [...code].every((c) => ROOM_CODE_ALPHABET.includes(c))
  );
}
