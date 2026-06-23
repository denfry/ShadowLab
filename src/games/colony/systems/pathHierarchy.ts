import type { Pt } from '../domain/types';
import { type ColonyMap, passableAt } from './grid';

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
