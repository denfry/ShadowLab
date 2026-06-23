import type { Pt } from '../domain/types';
import { type Grid, idx, neighbors4, passableAt } from './grid';

const manhattan = (ax: number, ay: number, bx: number, by: number) =>
  Math.abs(ax - bx) + Math.abs(ay - by);

/** Минимальная бинарная куча по f (число). Хранит ключи тайлов (y*w+x). */
class MinHeap {
  private keys: number[] = [];
  private fs: number[] = [];
  get size() { return this.keys.length; }
  push(key: number, f: number) {
    this.keys.push(key); this.fs.push(f);
    let i = this.keys.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.fs[p] <= this.fs[i]) break;
      this.swap(p, i); i = p;
    }
  }
  pop(): number {
    const top = this.keys[0];
    const lastK = this.keys.pop()!, lastF = this.fs.pop()!;
    if (this.keys.length) {
      this.keys[0] = lastK; this.fs[0] = lastF;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = 2 * i + 2; let s = i;
        if (l < this.keys.length && this.fs[l] < this.fs[s]) s = l;
        if (r < this.keys.length && this.fs[r] < this.fs[s]) s = r;
        if (s === i) break;
        this.swap(s, i); i = s;
      }
    }
    return top;
  }
  private swap(a: number, b: number) {
    [this.keys[a], this.keys[b]] = [this.keys[b], this.keys[a]];
    [this.fs[a], this.fs[b]] = [this.fs[b], this.fs[a]];
  }
}

/**
 * Оптимальный A* по 4-связной сетке. Возвращает путевые точки БЕЗ старта (включая цель),
 * [] если старт==цель, или null если пути нет. Цель может быть непроходимой (вход «к» зданию).
 */
export function findPath(g: Grid, start: Pt, goal: Pt): Pt[] | null {
  if (start.x === goal.x && start.y === goal.y) return [];
  const w = g.w;
  const key = (x: number, y: number) => y * w + x;
  const startK = key(start.x, start.y), goalK = key(goal.x, goal.y);

  const open = new MinHeap();
  const gScore = new Map<number, number>([[startK, 0]]);
  const came = new Map<number, number>();
  const closed = new Set<number>();
  open.push(startK, manhattan(start.x, start.y, goal.x, goal.y));

  while (open.size) {
    const cur = open.pop();
    if (cur === goalK) return reconstruct(came, startK, goalK, w);
    if (closed.has(cur)) continue;
    closed.add(cur);
    const cx = cur % w, cy = (cur - cx) / w;
    const cg = gScore.get(cur)!;
    for (const n of neighbors4(cx, cy, g)) {
      const isGoal = n.x === goal.x && n.y === goal.y;
      if (!isGoal && !passableAt(g, n.x, n.y)) continue;
      const nk = key(n.x, n.y);
      if (closed.has(nk)) continue;
      const tentative = cg + 1;
      if (tentative < (gScore.get(nk) ?? Infinity)) {
        came.set(nk, cur);
        gScore.set(nk, tentative);
        open.push(nk, tentative + manhattan(n.x, n.y, goal.x, goal.y));
      }
    }
  }
  return null;
}

function reconstruct(came: Map<number, number>, startK: number, goalK: number, w: number): Pt[] {
  const path: Pt[] = [];
  let ck = goalK;
  while (ck !== startK) {
    path.push({ x: ck % w, y: Math.floor(ck / w) });
    const prev = came.get(ck);
    if (prev === undefined) break;
    ck = prev;
  }
  path.reverse();
  return path;
}

export { idx } from './grid';
