import type { Biome, NodeKind, Pt, ResourceNode, Tile } from '../domain/types';

/** SoA-хранилище карты (План B). Сигнатуры аксессоров неизменны с Плана A. */
export type ColonyMap = {
  w: number; h: number;
  biome: Uint8Array;
  elevation: Float32Array;
  fertility: Float32Array;
  passable: Uint8Array;
  roomId: Uint16Array;
  temp: Float32Array;
  buildingId: Map<number, string>;
  nodes: Map<number, ResourceNode>;
};
export type Grid = ColonyMap;

const BIOMES: Biome[] = ['water', 'marsh', 'meadow', 'grass', 'forest', 'rock', 'mountain'];
const BIOME_CODE: Record<Biome, number> = {
  water: 0, marsh: 1, meadow: 2, grass: 3, forest: 4, rock: 5, mountain: 6,
};
const GRASS = BIOME_CODE.grass;

export const idx = (x: number, y: number, w: number): number => y * w + x;
export const inBounds = (x: number, y: number, m: ColonyMap): boolean =>
  x >= 0 && y >= 0 && x < m.w && y < m.h;

/** Пустая карта с дефолтами: всё трава, проходимо, temp=16. */
export function createMap(w: number, h: number): ColonyMap {
  const n = w * h;
  const biome = new Uint8Array(n).fill(GRASS);
  const passable = new Uint8Array(n).fill(1);
  const temp = new Float32Array(n).fill(16);
  return {
    w, h, biome,
    elevation: new Float32Array(n),
    fertility: new Float32Array(n),
    passable,
    roomId: new Uint16Array(n),
    temp,
    buildingId: new Map(),
    nodes: new Map(),
  };
}

// --- Чтения ---
export const biomeAt = (m: ColonyMap, x: number, y: number): Biome | undefined =>
  inBounds(x, y, m) ? BIOMES[m.biome[idx(x, y, m.w)]] : undefined;
export const elevationAt = (m: ColonyMap, x: number, y: number): number =>
  inBounds(x, y, m) ? m.elevation[idx(x, y, m.w)] : 0;
export const fertilityAt = (m: ColonyMap, x: number, y: number): number =>
  inBounds(x, y, m) ? m.fertility[idx(x, y, m.w)] : 0;
export const passableAt = (m: ColonyMap, x: number, y: number): boolean =>
  inBounds(x, y, m) ? m.passable[idx(x, y, m.w)] === 1 : false;
export const tempAt = (m: ColonyMap, x: number, y: number): number =>
  inBounds(x, y, m) ? m.temp[idx(x, y, m.w)] : 0;
export const roomIdAt = (m: ColonyMap, x: number, y: number): number =>
  inBounds(x, y, m) ? m.roomId[idx(x, y, m.w)] : 0;
export const buildingIdAt = (m: ColonyMap, x: number, y: number): string | undefined =>
  inBounds(x, y, m) ? m.buildingId.get(idx(x, y, m.w)) : undefined;
export const nodeAt = (m: ColonyMap, x: number, y: number): ResourceNode | undefined =>
  inBounds(x, y, m) ? m.nodes.get(idx(x, y, m.w)) : undefined;

/** Транзитный Tile-view для холодных путей (инспектор/тесты). Изменения НЕ пишутся назад. */
export function tileAt(x: number, y: number, m: ColonyMap): Tile | undefined {
  if (!inBounds(x, y, m)) return undefined;
  const i = idx(x, y, m.w);
  const node = m.nodes.get(i);
  const buildingId = m.buildingId.get(i);
  return {
    x, y,
    biome: BIOMES[m.biome[i]],
    elevation: m.elevation[i],
    fertility: m.fertility[i],
    passable: m.passable[i] === 1,
    roomId: m.roomId[i],
    temp: m.temp[i],
    ...(node ? { node: { ...node } } : {}),
    ...(buildingId ? { buildingId } : {}),
  };
}

// --- Мутации (точечные) ---
export const setPassable = (m: ColonyMap, x: number, y: number, v: boolean): void => {
  if (inBounds(x, y, m)) m.passable[idx(x, y, m.w)] = v ? 1 : 0;
};
export const setTemp = (m: ColonyMap, x: number, y: number, v: number): void => {
  if (inBounds(x, y, m)) m.temp[idx(x, y, m.w)] = v;
};
export const setRoomId = (m: ColonyMap, x: number, y: number, v: number): void => {
  if (inBounds(x, y, m)) m.roomId[idx(x, y, m.w)] = v;
};
export const setBuildingId = (m: ColonyMap, x: number, y: number, id?: string): void => {
  if (!inBounds(x, y, m)) return;
  const i = idx(x, y, m.w);
  if (id === undefined) m.buildingId.delete(i); else m.buildingId.set(i, id);
};
export const setBiome = (m: ColonyMap, x: number, y: number, b: Biome): void => {
  if (inBounds(x, y, m)) m.biome[idx(x, y, m.w)] = BIOME_CODE[b];
};
export const setNode = (m: ColonyMap, x: number, y: number, n?: ResourceNode): void => {
  if (!inBounds(x, y, m)) return;
  const i = idx(x, y, m.w);
  if (n === undefined) m.nodes.delete(i); else m.nodes.set(i, n);
};

/** Уменьшает узел на `amt` (не больше остатка); очищает узел при <=0. Возвращает взятое. */
export function depleteNode(m: ColonyMap, x: number, y: number, amt: number): number {
  if (!inBounds(x, y, m)) return 0;
  const i = idx(x, y, m.w);
  const node = m.nodes.get(i);
  if (!node) return 0;
  const take = Math.min(node.amount, amt);
  node.amount -= take;
  if (node.amount <= 0) m.nodes.delete(i);
  return take;
}

const DIRS: Pt[] = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
export function neighbors4(x: number, y: number, m: ColonyMap): Pt[] {
  const out: Pt[] = [];
  for (const d of DIRS) {
    const nx = x + d.x, ny = y + d.y;
    if (inBounds(nx, ny, m)) out.push({ x: nx, y: ny });
  }
  return out;
}

export function forEachTile(m: ColonyMap, fn: (i: number, x: number, y: number) => void): void {
  const { w, h } = m;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) fn(y * w + x, x, y);
}

/** Ближайший (манхэттен) тайл с узлом нужного вида — скан РАЗРЕЖЕННОЙ карты узлов
 *  (План B: спатиал-индекс заменит горячие вызовы; сигнатура неизменна). */
export function findNearestNode(m: ColonyMap, from: Pt, kind: NodeKind): Pt | undefined {
  let best: Pt | undefined;
  let bestD = Infinity;
  for (const [i, node] of m.nodes) {
    if (node.kind !== kind || node.amount <= 0) continue;
    const x = i % m.w, y = Math.floor(i / m.w);
    const d = Math.abs(x - from.x) + Math.abs(y - from.y);
    if (d < bestD) { bestD = d; best = { x, y }; }
  }
  return best;
}
