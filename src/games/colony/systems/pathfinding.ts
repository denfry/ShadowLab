import type { Pt } from '../domain/types';
import { type Grid, idx, neighbors4, passableAt } from './grid';

const key = (x: number, y: number) => y * 100000 + x;
const manhattan = (ax: number, ay: number, bx: number, by: number) =>
  Math.abs(ax - bx) + Math.abs(ay - by);

/**
 * A* по 4-связной сетке. Возвращает список путевых точек БЕЗ стартовой клетки
 * (включая цель), пустой массив если старт == цель, или null если пути нет.
 * Целевая клетка может быть непроходимой (чтобы можно было дойти «к» зданию):
 * соседи цели проверяются на проходимость, сама цель — допустима как финал.
 */
export function findPath(g: Grid, start: Pt, goal: Pt): Pt[] | null {
  if (start.x === goal.x && start.y === goal.y) return [];

  const open: { x: number; y: number; f: number }[] = [{ x: start.x, y: start.y, f: 0 }];
  const came = new Map<number, number>();
  const gScore = new Map<number, number>([[key(start.x, start.y), 0]]);

  while (open.length) {
    // Извлечь узел с минимальным f (линейный поиск — сетка мала).
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];

    if (cur.x === goal.x && cur.y === goal.y) return reconstruct(came, start, goal);

    const cg = gScore.get(key(cur.x, cur.y)) ?? Infinity;
    for (const n of neighbors4(cur.x, cur.y, g)) {
      const isGoal = n.x === goal.x && n.y === goal.y;
      if (!isGoal && !passableAt(g, n.x, n.y)) continue; // в цель можно войти даже если непроходима
      const nk = key(n.x, n.y);
      const tentative = cg + 1;
      if (tentative < (gScore.get(nk) ?? Infinity)) {
        came.set(nk, key(cur.x, cur.y));
        gScore.set(nk, tentative);
        const f = tentative + manhattan(n.x, n.y, goal.x, goal.y);
        const existing = open.find((o) => o.x === n.x && o.y === n.y);
        if (existing) existing.f = Math.min(existing.f, f);
        else open.push({ x: n.x, y: n.y, f });
      }
    }
  }
  return null;
}

function reconstruct(came: Map<number, number>, start: Pt, goal: Pt): Pt[] {
  const path: Pt[] = [];
  let ck = key(goal.x, goal.y);
  const startK = key(start.x, start.y);
  while (ck !== startK) {
    path.push({ x: ck % 100000, y: Math.floor(ck / 100000) });
    const prev = came.get(ck);
    if (prev === undefined) break;
    ck = prev;
  }
  path.reverse();
  return path;
}

export { idx } from './grid';
