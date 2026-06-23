import type { Pt } from '../domain/types';

export interface SpatialIndex {
  clusterSize: number;
  clustersW: number;
  buckets: Map<string, Map<number, Pt[]>>;
}

/** Internal extension — carries insertion index for deterministic tie-breaking. */
type IndexedPt = Pt & { _idx: number };

const clusterIdOf = (x: number, y: number, cs: number, cw: number) =>
  Math.floor(y / cs) * cw + Math.floor(x / cs);

export function buildIndex(
  w: number, h: number, clusterSize: number,
  points: Array<{ x: number; y: number; cat: string }>,
): SpatialIndex {
  const clustersW = Math.ceil(w / clusterSize);
  const buckets = new Map<string, Map<number, Pt[]>>();
  let idx = 0;
  for (const p of points) {
    let byCluster = buckets.get(p.cat);
    if (!byCluster) { byCluster = new Map(); buckets.set(p.cat, byCluster); }
    const cid = clusterIdOf(p.x, p.y, clusterSize, clustersW);
    let arr = byCluster.get(cid);
    if (!arr) { arr = []; byCluster.set(cid, arr); }
    const entry: IndexedPt = { x: p.x, y: p.y, _idx: idx++ };
    arr.push(entry);
  }
  return { clusterSize, clustersW, buckets };
}

/**
 * Ближайшая (манхэттен) точка категории `cat` от `from`, опционально проходящая `accept`.
 * Расширяющийся поиск по кольцам кластеров; кольцо k гарантирует, что любая точка ближе
 * лежит в уже просмотренных кластерах при достаточном расширении (см. ниже про границу).
 *
 * Tie-break: among equal-distance points, the one with the lowest insertion index wins
 * (matches brute-force iteration over the original input array).
 */
export function nearest(
  ix: SpatialIndex, w: number, h: number,
  from: Pt, cat: string, accept?: (p: Pt) => boolean,
): Pt | undefined {
  const byCluster = ix.buckets.get(cat);
  if (!byCluster) return undefined;
  const cs = ix.clusterSize, cw = ix.clustersW;
  const ch = Math.ceil(h / cs);
  const fcx = Math.floor(from.x / cs), fcy = Math.floor(from.y / cs);
  const maxRing = Math.max(cw, ch);

  let best: Pt | undefined; let bestD = Infinity; let bestIdx = Infinity;
  const consider = (p: IndexedPt) => {
    if (accept && !accept(p)) return;
    const d = Math.abs(p.x - from.x) + Math.abs(p.y - from.y);
    if (d < bestD || (d === bestD && p._idx < bestIdx)) {
      bestD = d; bestIdx = p._idx; best = { x: p.x, y: p.y };
    }
  };
  for (let ring = 0; ring <= maxRing; ring++) {
    for (let cy = fcy - ring; cy <= fcy + ring; cy++) {
      for (let cx = fcx - ring; cx <= fcx + ring; cx++) {
        if (Math.max(Math.abs(cx - fcx), Math.abs(cy - fcy)) !== ring) continue; // ring shell only
        if (cx < 0 || cy < 0 || cx >= cw || cy >= ch) continue;
        const arr = byCluster.get(cy * cw + cx);
        if (arr) for (const p of arr as IndexedPt[]) consider(p);
      }
    }
    // Останов: ближайшая найденная точка ближе, чем минимально возможная точка
    // в следующем непросмотренном кольце (его ближняя граница на расстоянии ring*cs тайлов).
    if (best && bestD <= ring * cs) break;
  }
  return best;
}
