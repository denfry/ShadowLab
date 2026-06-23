import type { ColonyState, Room } from '../domain/types';
import { idx, roomIdAt, setRoomId } from './grid';

/** Сигнатура набора построенных стен/дверей — меняется только при их изменении. */
export function wallsDoorsSig(s: ColonyState): string {
  return s.buildings
    .filter((b) => b.built && (b.type === 'wall' || b.type === 'door'))
    .map((b) => `${b.tile.x},${b.tile.y}`)
    .sort()
    .join('|');
}

/** Пересчёт комнат flood-fill'ом. Тайлы стен/дверей — барьеры; всё, до чего
 *  дотягивается заливка от границы карты, — улица (roomId 0); замкнутые
 *  внутренние области нумеруются как комнаты. */
export function recomputeRooms(s: ColonyState): void {
  const { w, h } = s.map;
  const barrier = new Uint8Array(w * h);
  for (const b of s.buildings) {
    if (b.built && (b.type === 'wall' || b.type === 'door')) barrier[idx(b.tile.x, b.tile.y, w)] = 1;
  }

  const outside = new Uint8Array(w * h);
  const stack: number[] = [];
  const seed = (x: number, y: number) => {
    const i = idx(x, y, w);
    if (!barrier[i] && !outside[i]) { outside[i] = 1; stack.push(i); }
  };
  for (let x = 0; x < w; x++) { seed(x, 0); seed(x, h - 1); }
  for (let y = 0; y < h; y++) { seed(0, y); seed(w - 1, y); }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w, y = Math.floor(i / w);
    const push = (nx: number, ny: number) => {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) return;
      const ni = idx(nx, ny, w);
      if (!barrier[ni] && !outside[ni]) { outside[ni] = 1; stack.push(ni); }
    };
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }

  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) setRoomId(s.map, x, y, 0);
  const rooms: Room[] = [];
  let nextId = 1;
  for (let i = 0; i < w * h; i++) {
    const ix = i % w, iy = Math.floor(i / w);
    if (barrier[i] || outside[i] || roomIdAt(s.map, ix, iy) !== 0) continue;
    // Новая комната: BFS по не-барьерным внутренним тайлам.
    const comp: number[] = [];
    const q = [i];
    setRoomId(s.map, ix, iy, nextId);
    while (q.length) {
      const j = q.pop()!;
      comp.push(j);
      const x = j % w, y = Math.floor(j / w);
      const visit = (nx: number, ny: number) => {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) return;
        const nj = idx(nx, ny, w);
        if (barrier[nj] || outside[nj] || roomIdAt(s.map, nx, ny) !== 0) return;
        setRoomId(s.map, nx, ny, nextId);
        q.push(nj);
      };
      visit(x + 1, y); visit(x - 1, y); visit(x, y + 1); visit(x, y - 1);
    }
    rooms.push({ id: nextId, tiles: comp, temp: s.env.outdoorTemp, area: comp.length });
    nextId += 1;
  }
  s.rooms = rooms;
}
