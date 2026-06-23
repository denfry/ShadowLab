import type { Pt } from '../domain/types';
import { type ColonyMap, passableAt, neighbors4 } from './grid';
import { findPath } from './pathfinding';

export interface Portal { id: number; x: number; y: number; cluster: number; }
export interface Nav {
  clusterSize: number; clustersW: number; clustersH: number;
  portals: Portal[];
  portalsByCluster: Map<number, Portal[]>;
  interEdges: Map<number, Array<{ to: number; cost: number }>>;
  intraEdges: Map<number, Array<{ to: number; cost: number }>>;
  pathCache: Map<string, Pt[] | null>;
  dirty: Set<number>;
}

export const clusterIdOf = (
  x: number, y: number, nav: { clusterSize: number; clustersW: number },
): number => Math.floor(y / nav.clusterSize) * nav.clustersW + Math.floor(x / nav.clusterSize);

export function detectPortals(m: ColonyMap, clusterSize: number) {
  const clustersW = Math.ceil(m.w / clusterSize);
  const clustersH = Math.ceil(m.h / clusterSize);
  const portals: Portal[] = [];
  const portalsByCluster = new Map<number, Portal[]>();
  const interEdges = new Map<number, Array<{ to: number; cost: number }>>();
  let nextId = 0;
  const addPortal = (x: number, y: number, cluster: number): Portal => {
    const p: Portal = { id: nextId++, x, y, cluster };
    portals.push(p);
    let arr = portalsByCluster.get(cluster); if (!arr) { arr = []; portalsByCluster.set(cluster, arr); }
    arr.push(p);
    return p;
  };
  const link = (a: Portal, b: Portal) => {
    const ea = interEdges.get(a.id) ?? []; ea.push({ to: b.id, cost: 1 }); interEdges.set(a.id, ea);
    const eb = interEdges.get(b.id) ?? []; eb.push({ to: a.id, cost: 1 }); interEdges.set(b.id, eb);
  };
  const cid = (cx: number, cy: number) => cy * clustersW + cx;

  // Вертикальные границы между (cx,cy) и (cx+1,cy): столбец xb=(cx+1)*cs-1 | xb+1.
  for (let cy = 0; cy < clustersH; cy++) {
    for (let cx = 0; cx < clustersW - 1; cx++) {
      const xb = (cx + 1) * clusterSize - 1;
      const y0 = cy * clusterSize, y1 = Math.min(m.h, y0 + clusterSize);
      segmentize(y0, y1, (y) => passableAt(m, xb, y) && passableAt(m, xb + 1, y), (ym) => {
        const a = addPortal(xb, ym, cid(cx, cy));
        const b = addPortal(xb + 1, ym, cid(cx + 1, cy));
        link(a, b);
      });
    }
  }
  // Горизонтальные границы между (cx,cy) и (cx,cy+1): строка yb=(cy+1)*cs-1 | yb+1.
  for (let cx = 0; cx < clustersW; cx++) {
    for (let cy = 0; cy < clustersH - 1; cy++) {
      const yb = (cy + 1) * clusterSize - 1;
      const x0 = cx * clusterSize, x1 = Math.min(m.w, x0 + clusterSize);
      segmentize(x0, x1, (x) => passableAt(m, x, yb) && passableAt(m, x, yb + 1), (xm) => {
        const a = addPortal(xm, yb, cid(cx, cy));
        const b = addPortal(xm, yb + 1, cid(cx, cy + 1));
        link(a, b);
      });
    }
  }
  return { portals, portalsByCluster, interEdges, clustersW, clustersH };
}

/** A* в пределах окна кластера; возвращает длину пути в шагах или null. */
export function localDistance(
  m: ColonyMap, cluster: number, clusterSize: number, clustersW: number, a: Pt, b: Pt,
): number | null {
  if (a.x === b.x && a.y === b.y) return 0;
  const cx = (cluster % clustersW) * clusterSize, cy = Math.floor(cluster / clustersW) * clusterSize;
  const x1 = Math.min(m.w, cx + clusterSize), y1 = Math.min(m.h, cy + clusterSize);
  const inWin = (x: number, y: number) => x >= cx && y >= cy && x < x1 && y < y1;
  const key = (x: number, y: number) => y * m.w + x;
  const h = (x: number, y: number) => Math.abs(x - b.x) + Math.abs(y - b.y);
  const open: Array<{ k: number; x: number; y: number; f: number }> = [{ k: key(a.x, a.y), x: a.x, y: a.y, f: h(a.x, a.y) }];
  const g = new Map<number, number>([[key(a.x, a.y), 0]]);
  const closed = new Set<number>();
  while (open.length) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    if (cur.x === b.x && cur.y === b.y) return g.get(cur.k)!;
    if (closed.has(cur.k)) continue; closed.add(cur.k);
    const cg = g.get(cur.k)!;
    for (const n of neighbors4(cur.x, cur.y, m)) {
      if (!inWin(n.x, n.y)) continue;
      const isTarget = n.x === b.x && n.y === b.y;
      if (!isTarget && !passableAt(m, n.x, n.y)) continue;
      const nk = key(n.x, n.y);
      const t = cg + 1;
      if (t < (g.get(nk) ?? Infinity)) {
        g.set(nk, t);
        open.push({ k: nk, x: n.x, y: n.y, f: t + h(n.x, n.y) });
      }
    }
  }
  return null;
}

export function buildNav(m: ColonyMap, clusterSize: number): Nav {
  const { portals, portalsByCluster, interEdges, clustersW, clustersH } = detectPortals(m, clusterSize);
  const intraEdges = new Map<number, Array<{ to: number; cost: number }>>();
  for (const [cluster, ps] of portalsByCluster) {
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const d = localDistance(m, cluster, clusterSize, clustersW, ps[i], ps[j]);
        if (d === null) continue;
        (intraEdges.get(ps[i].id) ?? setGet(intraEdges, ps[i].id)).push({ to: ps[j].id, cost: d });
        (intraEdges.get(ps[j].id) ?? setGet(intraEdges, ps[j].id)).push({ to: ps[i].id, cost: d });
      }
    }
  }
  return {
    clusterSize, clustersW, clustersH,
    portals, portalsByCluster, interEdges, intraEdges,
    pathCache: new Map(), dirty: new Set(),
  };
}
function setGet(map: Map<number, Array<{ to: number; cost: number }>>, k: number) {
  const a: Array<{ to: number; cost: number }> = []; map.set(k, a); return a;
}

/** Локальный A* в окне кластера, возвращает путевые точки БЕЗ старта (включая b) или null. */
function localPath(m: ColonyMap, cluster: number, clusterSize: number, clustersW: number, a: Pt, b: Pt): Pt[] | null {
  if (a.x === b.x && a.y === b.y) return [];
  const cx = (cluster % clustersW) * clusterSize, cy = Math.floor(cluster / clustersW) * clusterSize;
  const x1 = Math.min(m.w, cx + clusterSize), y1 = Math.min(m.h, cy + clusterSize);
  const inWin = (x: number, y: number) => x >= cx && y >= cy && x < x1 && y < y1;
  const key = (x: number, y: number) => y * m.w + x;
  const open: Array<{ k: number; x: number; y: number; f: number }> = [{ k: key(a.x, a.y), x: a.x, y: a.y, f: 0 }];
  const g = new Map<number, number>([[key(a.x, a.y), 0]]);
  const came = new Map<number, number>();
  const closed = new Set<number>();
  while (open.length) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    if (cur.x === b.x && cur.y === b.y) {
      const path: Pt[] = []; let ck = cur.k;
      while (ck !== key(a.x, a.y)) { path.push({ x: ck % m.w, y: Math.floor(ck / m.w) }); ck = came.get(ck)!; }
      return path.reverse();
    }
    if (closed.has(cur.k)) continue; closed.add(cur.k);
    const cg = g.get(cur.k)!;
    for (const n of neighbors4(cur.x, cur.y, m)) {
      if (!inWin(n.x, n.y)) continue;
      const isTarget = n.x === b.x && n.y === b.y;
      if (!isTarget && !passableAt(m, n.x, n.y)) continue;
      const nk = key(n.x, n.y); const t = cg + 1;
      if (t < (g.get(nk) ?? Infinity)) {
        g.set(nk, t); came.set(nk, cur.k);
        open.push({ k: nk, x: n.x, y: n.y, f: t + Math.abs(n.x - b.x) + Math.abs(n.y - b.y) });
      }
    }
  }
  return null;
}

export function findPathHier(m: ColonyMap, nav: Nav, start: Pt, goal: Pt): Pt[] | null {
  if (start.x === goal.x && start.y === goal.y) return [];
  const cs = nav.clusterSize, cw = nav.clustersW;
  const startC = clusterIdOf(start.x, start.y, nav), goalC = clusterIdOf(goal.x, goal.y, nav);

  // Однокластерный случай: прямой локальный путь (если есть), иначе общий A*.
  if (startC === goalC) {
    const lp = localPath(m, startC, cs, cw, start, goal);
    return lp ?? findPath(m, start, goal);
  }

  // Абстрактный граф: вершины = id порталов; плюс виртуальные START(-1)/GOAL(-2).
  const START = -1, GOAL = -2;
  const adj = (id: number): Array<{ to: number; cost: number }> => {
    if (id === START) {
      const out: Array<{ to: number; cost: number }> = [];
      for (const p of nav.portalsByCluster.get(startC) ?? []) {
        const d = localDistance(m, startC, cs, cw, start, p);
        if (d !== null) out.push({ to: p.id, cost: d });
      }
      return out;
    }
    const base = [...(nav.intraEdges.get(id) ?? []), ...(nav.interEdges.get(id) ?? [])];
    // если этот портал в кластере цели — добавить ребро к GOAL
    const p = nav.portals[id];
    if (p && clusterIdOf(p.x, p.y, nav) === goalC) {
      const d = localDistance(m, goalC, cs, cw, p, goal);
      if (d !== null) base.push({ to: GOAL, cost: d });
    }
    return base;
  };

  // A* по абстрактному графу (эвристика 0 -> Дейкстра; граф мал).
  const dist = new Map<number, number>([[START, 0]]);
  const prev = new Map<number, number>();
  const visited = new Set<number>();
  const pq: Array<{ id: number; d: number }> = [{ id: START, d: 0 }];
  let reached = false;
  while (pq.length) {
    let bi = 0; for (let i = 1; i < pq.length; i++) if (pq[i].d < pq[bi].d) bi = i;
    const cur = pq.splice(bi, 1)[0];
    if (cur.id === GOAL) { reached = true; break; }
    if (visited.has(cur.id)) continue; visited.add(cur.id);
    for (const e of adj(cur.id)) {
      const nd = cur.d + e.cost;
      if (nd < (dist.get(e.to) ?? Infinity)) { dist.set(e.to, nd); prev.set(e.to, cur.id); pq.push({ id: e.to, d: nd }); }
    }
  }
  if (!reached) return findPath(m, start, goal); // абстракт не нашёл — точный фолбэк (полнота)

  // Восстановить абстрактную цепочку START -> ... -> GOAL и уточнить в конкретные тайлы.
  const chain: number[] = []; let c = GOAL;
  while (c !== START) { chain.push(c); c = prev.get(c)!; }
  chain.push(START); chain.reverse(); // [START, p_i, p_j, ..., GOAL]

  const out: Pt[] = [];
  let curPt = start;
  for (let k = 1; k < chain.length; k++) {
    const node = chain[k];
    const target: Pt = node === GOAL ? goal : nav.portals[node];
    const curClusterId = clusterIdOf(curPt.x, curPt.y, nav);
    const tgtClusterId = clusterIdOf(target.x, target.y, nav);
    if (curClusterId === tgtClusterId) {
      const seg = localPath(m, curClusterId, cs, cw, curPt, target);
      if (seg === null) return findPath(m, start, goal);
      out.push(...seg);
    } else {
      // межкластерный шаг между смежными порталами: один шаг (соседние тайлы).
      out.push({ x: target.x, y: target.y });
    }
    curPt = target;
  }
  return out;
}

/** Находит макс. сегменты, где open(i)==true на [lo,hi); вызывает emit(середина сегмента). */
function segmentize(lo: number, hi: number, open: (i: number) => boolean, emit: (mid: number) => void): void {
  let segStart = -1;
  for (let i = lo; i <= hi; i++) {
    const isOpen = i < hi && open(i);
    if (isOpen && segStart < 0) segStart = i;
    if (!isOpen && segStart >= 0) {
      emit((segStart + (i - 1)) >> 1); // midpoint of [segStart, i-1]
      segStart = -1;
    }
  }
}
