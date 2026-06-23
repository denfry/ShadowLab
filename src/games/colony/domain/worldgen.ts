// src/games/colony/domain/worldgen.ts
import { fbm } from '@/core/utils/noise';
import type { Biome, NodeKind, Pt, ResourceNode } from './types';
import { GEN, BIOME_FERTILITY, MAP_W, MAP_H } from '../data/balance';
import type { ColonyMap } from '../systems/grid';
import { createMap, idx, setBiome, setNode, passableAt, biomeAt } from '../systems/grid';

/** Биом по высоте/влажности. */
function classify(elev: number, moist: number): Biome {
  if (elev < GEN.waterLevel) return 'water';
  if (elev < GEN.marshMax) return moist > 0.55 ? 'marsh' : 'grass';
  if (elev > GEN.mountainMin) return 'mountain';
  if (elev > GEN.rockMin) return 'rock';
  if (moist > GEN.forestMoist) return 'forest';
  if (moist > GEN.meadowMoist) return 'meadow';
  return 'grass';
}

/** Узел ресурса для тайла (детерминированно от сид-шума), либо undefined. */
function nodeFor(seed: number, x: number, y: number, biome: Biome): ResourceNode | undefined {
  const q = fbm(seed + 9001, x * 1.7, y * 1.7, 2); // отдельный поток шума под залежи
  const span = (min: number, max: number) => Math.floor(min + fbm(seed + 5, x, y, 2) * (max - min));
  const node = (kind: NodeKind, amount: number): ResourceNode => ({ kind, amount, max: amount });
  if (biome === 'forest') return node('wood', span(GEN.woodMin, GEN.woodMax));
  if (biome === 'rock' || biome === 'mountain') {
    if (q < GEN.pGold) return node('gold', span(GEN.oreMin, GEN.oreMax));
    if (q < GEN.pGold + GEN.pIron) return node('iron', span(GEN.oreMin, GEN.oreMax));
    if (q < GEN.pGold + GEN.pIron + GEN.pStone) return node('stone', span(GEN.oreMin, GEN.oreMax));
  }
  if (biome === 'marsh' && q < GEN.pClay) return node('clay', span(GEN.oreMin, GEN.oreMax));
  if (biome === 'meadow' && q > 1 - GEN.pBerries) return node('berries', span(10, 25));
  if (biome === 'water' && q < GEN.pFish) return node('fish', span(10, 25));
  return undefined;
}

/** Прорезает реки: из высоких точек спуск по градиенту высоты к воде. */
function carveRivers(seed: number, w: number, h: number, elev: Float64Array, isWater: Uint8Array): void {
  for (let r = 0; r < GEN.riverCount; r++) {
    // Детерминированный выбор истока из сид-шума.
    let x = 1 + Math.floor(fbm(seed + 100 + r, r * 13.3, 1.1, 2) * (w - 2));
    let y = 1 + Math.floor(fbm(seed + 200 + r, 2.2, r * 7.7, 2) * (h - 2));
    for (let step = 0; step < GEN.riverMaxSteps; step++) {
      isWater[idx(x, y, w)] = 1;
      let bx = x, by = y, be = elev[idx(x, y, w)];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const e = elev[idx(nx, ny, w)];
        if (e < be) { be = e; bx = nx; by = ny; }
      }
      if (bx === x && by === y) break;       // локальный минимум
      x = bx; y = by;
      if (elev[idx(x, y, w)] < GEN.waterLevel) break; // дошли до воды
    }
  }
}

export function regenerateWorld(seed: number): ColonyMap {
  const w = MAP_W, h = MAP_H;
  const m = createMap(w, h);
  const elev = new Float64Array(w * h);
  const isWater = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const e = fbm(seed * 7 + 1, x / GEN.elevScale, y / GEN.elevScale, 5);
    elev[idx(x, y, w)] = e;
    if (e < GEN.waterLevel) isWater[idx(x, y, w)] = 1;
  }
  carveRivers(seed, w, h, elev, isWater);

  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = idx(x, y, w);
    const e = elev[i];
    const moist = fbm(seed * 13 + 99, x / GEN.moistScale, y / GEN.moistScale, 4);
    const biome: Biome = isWater[i] ? 'water' : classify(e, moist);
    m.elevation[i] = e;
    m.fertility[i] = BIOME_FERTILITY[biome];
    setBiome(m, x, y, biome);
    m.passable[i] = (biome !== 'water' && biome !== 'mountain') ? 1 : 0;
    const node = nodeFor(seed, x, y, biome);
    if (node) setNode(m, x, y, node);
  }
  return m;
}

/** Стартовая площадка: проходимый луг/трава ближе к центру, рядом — вода и лес. */
export function pickStartSite(m: ColonyMap): Pt {
  const cx = m.w / 2, cy = m.h / 2;
  const near = (x: number, y: number, biome: Biome, rad: number): boolean => {
    for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
      const nx = x + dx, ny = y + dy;
      if (biomeAt(m, nx, ny) === biome) return true;
    }
    return false;
  };
  let best: Pt | undefined; let bestScore = -Infinity;
  for (let y = 2; y < m.h - 2; y++) for (let x = 2; x < m.w - 2; x++) {
    const b = biomeAt(m, x, y);
    if ((b !== 'meadow' && b !== 'grass') || !passableAt(m, x, y)) continue;
    let score = -(Math.abs(x - cx) + Math.abs(y - cy));
    if (near(x, y, 'water', 6)) score += 5;
    if (near(x, y, 'forest', 8)) score += 5;
    if (score > bestScore) { bestScore = score; best = { x, y }; }
  }
  if (!best) {
    for (let y = 0; y < m.h && !best; y++) for (let x = 0; x < m.w && !best; x++) {
      if (passableAt(m, x, y)) best = { x, y };
    }
  }
  return best ?? { x: Math.floor(cx), y: Math.floor(cy) };
}
