/** Диапазон видимых тайлов (с запасом в 1 тайл), отсечённый по карте. */
export function visibleTileRange(
  scrollX: number, scrollY: number, zoom: number,
  viewW: number, viewH: number, tile: number, mapW: number, mapH: number,
): { x0: number; y0: number; x1: number; y1: number } {
  const worldW = viewW / zoom, worldH = viewH / zoom;
  const x0 = Math.max(0, Math.floor(scrollX / tile) - 1);
  const y0 = Math.max(0, Math.floor(scrollY / tile) - 1);
  const x1 = Math.min(mapW - 1, Math.floor((scrollX + worldW) / tile) + 1);
  const y1 = Math.min(mapH - 1, Math.floor((scrollY + worldH) / tile) + 1);
  return { x0, y0, x1, y1 };
}

/** Ограничивает прокрутку, чтобы вьюпорт не выходил за мир. */
export function clampScroll(
  scrollX: number, scrollY: number, zoom: number,
  viewW: number, viewH: number, worldW: number, worldH: number,
): { x: number; y: number } {
  const visW = viewW / zoom, visH = viewH / zoom;
  const maxX = Math.max(0, worldW - visW), maxY = Math.max(0, worldH - visH);
  return {
    x: Math.min(Math.max(0, scrollX), maxX),
    y: Math.min(Math.max(0, scrollY), maxY),
  };
}
