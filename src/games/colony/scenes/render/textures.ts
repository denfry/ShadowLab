import type { Biome } from '../../domain/types';

export const BIOME_BASE: Record<Biome, [number, number, number]> = {
  water:    [29, 66, 86],
  marsh:    [59, 74, 44],
  meadow:   [79, 125, 51],
  grass:    [52, 86, 36],
  forest:   [33, 56, 26],
  rock:     [74, 72, 64],
  mountain: [120, 118, 110],
};

export const clampByte = (n: number): number => Math.max(0, Math.min(255, Math.floor(n)));

/** Множитель яркости от высоты: низины темнее, возвышенности светлее. */
export function elevationShade(elev: number): number {
  // map elev 0..1 -> 0.72..1.18 (linear, gentle)
  return 0.72 + Math.max(0, Math.min(1, elev)) * 0.46;
}

/** Ambient occlusion на склонах: если сосед намного ниже (обрыв) — затемняем кромку. */
export function slopeAO(elevHere: number, elevNeighborMin: number): number {
  const drop = Math.max(0, elevHere - elevNeighborMin);
  // drop 0 -> 1 (flat); drop 0.3+ -> 0.6 (strong cliff darkening)
  return Math.max(0.6, 1 - drop * 1.33);
}

/** Финальный пиксель тайла: база биома × тень высоты × AO + шумовая деталь. */
export function biomePixel(
  biome: Biome, elev: number, detail: number, elevNeighborMin: number,
): [number, number, number] {
  const base = BIOME_BASE[biome];
  const shade = elevationShade(elev) * slopeAO(elev, elevNeighborMin);
  const d = 1 + detail; // detail in ~[-TEX_DETAIL, +TEX_DETAIL]
  return [
    clampByte(base[0] * shade * d),
    clampByte(base[1] * shade * d),
    clampByte(base[2] * shade * d),
  ];
}
