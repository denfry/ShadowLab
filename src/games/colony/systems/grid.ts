import type { Pt, Tile } from '../domain/types';

export type Grid = { w: number; h: number; tiles: Tile[] };

export const idx = (x: number, y: number, w: number): number => y * w + x;

export const inBounds = (x: number, y: number, g: Grid): boolean =>
  x >= 0 && y >= 0 && x < g.w && y < g.h;

export const tileAt = (x: number, y: number, g: Grid): Tile | undefined =>
  inBounds(x, y, g) ? g.tiles[idx(x, y, g.w)] : undefined;

const DIRS: Pt[] = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

export function neighbors4(x: number, y: number, g: Grid): Pt[] {
  const out: Pt[] = [];
  for (const d of DIRS) {
    const nx = x + d.x;
    const ny = y + d.y;
    if (inBounds(nx, ny, g)) out.push({ x: nx, y: ny });
  }
  return out;
}
