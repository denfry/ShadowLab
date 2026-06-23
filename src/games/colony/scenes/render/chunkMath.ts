export const chunkIdOf = (cx: number, cy: number, chunksW: number): number => cy * chunksW + cx;

export const chunkCounts = (w: number, h: number, chunk: number): { cw: number; ch: number } => ({
  cw: Math.ceil(w / chunk),
  ch: Math.ceil(h / chunk),
});

export interface ChunkRange { cx0: number; cy0: number; cx1: number; cy1: number; }

export function visibleChunkRange(
  scrollX: number, scrollY: number, zoom: number,
  viewW: number, viewH: number, tile: number, chunk: number, mapW: number, mapH: number,
): ChunkRange {
  const chunkPx = chunk * tile;
  const worldW = viewW / zoom, worldH = viewH / zoom;
  const { cw, ch } = chunkCounts(mapW, mapH, chunk);
  const cx0 = Math.max(0, Math.floor(scrollX / chunkPx) - 1);
  const cy0 = Math.max(0, Math.floor(scrollY / chunkPx) - 1);
  const cx1 = Math.min(cw - 1, Math.floor((scrollX + worldW) / chunkPx) + 1);
  const cy1 = Math.min(ch - 1, Math.floor((scrollY + worldH) / chunkPx) + 1);
  return { cx0, cy0, cx1, cy1 };
}

export function chunkTileBounds(
  cx: number, cy: number, chunk: number, mapW: number, mapH: number,
): { x0: number; y0: number; x1: number; y1: number } {
  return {
    x0: cx * chunk,
    y0: cy * chunk,
    x1: Math.min(mapW - 1, cx * chunk + chunk - 1),
    y1: Math.min(mapH - 1, cy * chunk + chunk - 1),
  };
}

export type Lod = 'near' | 'far';
export const lodForZoom = (zoom: number, farBelow: number): Lod => (zoom < farBelow ? 'far' : 'near');

export function worldToMinimap(
  wx: number, wy: number, mapPxW: number, mapPxH: number, miniW: number, miniH: number,
): { x: number; y: number } {
  return { x: (wx / mapPxW) * miniW, y: (wy / mapPxH) * miniH };
}

export function minimapToWorldTile(
  mx: number, my: number, miniW: number, miniH: number, mapW: number, mapH: number, _tile: number,
): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(mapW - 1, Math.floor((mx / miniW) * mapW))),
    y: Math.max(0, Math.min(mapH - 1, Math.floor((my / miniH) * mapH))),
  };
}

export function minimapViewportRect(
  scrollX: number, scrollY: number, zoom: number, viewW: number, viewH: number,
  mapPxW: number, mapPxH: number, miniW: number, miniH: number,
): { x: number; y: number; w: number; h: number } {
  const worldW = viewW / zoom, worldH = viewH / zoom;
  const tl = worldToMinimap(scrollX, scrollY, mapPxW, mapPxH, miniW, miniH);
  return { x: tl.x, y: tl.y, w: (worldW / mapPxW) * miniW, h: (worldH / mapPxH) * miniH };
}
