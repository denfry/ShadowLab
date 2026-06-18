export const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value;

export const round = (value: number, digits = 0): number => {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
};

let counter = 0;
/** Short non-cryptographic id, deterministic within a session run order. */
export const makeId = (prefix = 'id'): string => `${prefix}_${(counter++).toString(36)}_${Date.now().toString(36)}`;

export const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

export const avg = (xs: number[]): number => (xs.length ? sum(xs) / xs.length : 0);

export const nowIso = (): string => new Date().toISOString();

export const cx = (...parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(' ');

/** Lightweight debounce returning a callable with a flush() method. */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, wait: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: A | null = null;
  const debounced = (...args: A) => {
    lastArgs = args;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (lastArgs) fn(...lastArgs);
    }, wait);
  };
  debounced.flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
      if (lastArgs) fn(...lastArgs);
    }
  };
  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return debounced;
}
