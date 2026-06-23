import type { Rng } from './seed';
import type { Role } from './types';

export function arrEq(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function normEdge(a: number, b: number): [number, number] {
  return a <= b ? [a, b] : [b, a];
}

export function edgeSetEq(x: [number, number][], y: [number, number][]): boolean {
  if (x.length !== y.length) return false;
  const key = (e: [number, number]) => normEdge(e[0], e[1]).join('-');
  const sx = new Set(x.map(key));
  return y.every((e) => sx.has(key(e))) && sx.size === new Set(y.map(key)).size;
}

export function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function chooseOwners(rng: Rng): { clueOwner: Role; lockOwner: Role } {
  return rng() < 0.5
    ? { clueOwner: 'B', lockOwner: 'A' }
    : { clueOwner: 'A', lockOwner: 'B' };
}
