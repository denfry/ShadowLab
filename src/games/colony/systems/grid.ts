import type { Biome, NodeKind, Pt, ResourceNode, Tile, ColonyMap } from '../domain/types';

/** Alias for ColonyMap (maintains Grid type for compatibility). */
export type Grid = ColonyMap;

export { ColonyMap } from '../domain/types';

export const idx = (x: number, y: number, w: number): number => y * w + x;

export const inBounds = (x: number, y: number, m: ColonyMap): boolean =>
  x >= 0 && y >= 0 && x < m.w && y < m.h;

export const tileAt = (x: number, y: number, m: ColonyMap): Tile | undefined =>
  inBounds(x, y, m) ? m.tiles[idx(x, y, m.w)] : undefined;

// --- Чтения ---
export const biomeAt = (m: ColonyMap, x: number, y: number): Biome | undefined => tileAt(x, y, m)?.biome;
export const elevationAt = (m: ColonyMap, x: number, y: number): number => tileAt(x, y, m)?.elevation ?? 0;
export const fertilityAt = (m: ColonyMap, x: number, y: number): number => tileAt(x, y, m)?.fertility ?? 0;
export const passableAt = (m: ColonyMap, x: number, y: number): boolean => tileAt(x, y, m)?.passable ?? false;
export const tempAt = (m: ColonyMap, x: number, y: number): number => tileAt(x, y, m)?.temp ?? 0;
export const roomIdAt = (m: ColonyMap, x: number, y: number): number => tileAt(x, y, m)?.roomId ?? 0;
export const buildingIdAt = (m: ColonyMap, x: number, y: number): string | undefined => tileAt(x, y, m)?.buildingId;
export const nodeAt = (m: ColonyMap, x: number, y: number): ResourceNode | undefined => tileAt(x, y, m)?.node;

// --- Мутации (точечные) ---
export const setPassable = (m: ColonyMap, x: number, y: number, v: boolean): void => { const t = tileAt(x, y, m); if (t) t.passable = v; };
export const setTemp = (m: ColonyMap, x: number, y: number, v: number): void => { const t = tileAt(x, y, m); if (t) t.temp = v; };
export const setRoomId = (m: ColonyMap, x: number, y: number, v: number): void => { const t = tileAt(x, y, m); if (t) t.roomId = v; };
export const setBuildingId = (m: ColonyMap, x: number, y: number, id?: string): void => { const t = tileAt(x, y, m); if (t) t.buildingId = id; };
export const setBiome = (m: ColonyMap, x: number, y: number, b: Biome): void => { const t = tileAt(x, y, m); if (t) t.biome = b; };
export const setNode = (m: ColonyMap, x: number, y: number, n?: ResourceNode): void => { const t = tileAt(x, y, m); if (t) t.node = n; };

/** Уменьшает узел на `amt` (не больше остатка); очищает узел при <=0. Возвращает взятое. */
export function depleteNode(m: ColonyMap, x: number, y: number, amt: number): number {
  const t = tileAt(x, y, m);
  if (!t || !t.node) return 0;
  const take = Math.min(t.node.amount, amt);
  t.node.amount -= take;
  if (t.node.amount <= 0) t.node = undefined;
  return take;
}

const DIRS: Pt[] = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
export function neighbors4(x: number, y: number, m: ColonyMap): Pt[] {
  const out: Pt[] = [];
  for (const d of DIRS) {
    const nx = x + d.x;
    const ny = y + d.y;
    if (inBounds(nx, ny, m)) out.push({ x: nx, y: ny });
  }
  return out;
}

export function forEachTile(m: ColonyMap, fn: (i: number, x: number, y: number) => void): void {
  for (let i = 0; i < m.tiles.length; i++) fn(i, i % m.w, Math.floor(i / m.w));
}

/** Ближайший (манхэттен) тайл с узлом нужного вида. План A — линейный скан;
 *  План B заменит реализацию на спатиал-индекс (сигнатура неизменна). */
export function findNearestNode(m: ColonyMap, from: Pt, kind: NodeKind): Pt | undefined {
  let best: Pt | undefined;
  let bestD = Infinity;
  for (const t of m.tiles) {
    if (t.node?.kind !== kind || t.node.amount <= 0) continue;
    const d = Math.abs(t.x - from.x) + Math.abs(t.y - from.y);
    if (d < bestD) { bestD = d; best = { x: t.x, y: t.y }; }
  }
  return best;
}
