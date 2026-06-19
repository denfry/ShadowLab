import type { ColonyState } from '../domain/types';
import { idx } from './grid';
import { AREA_NORM, HEATER_FUEL_PER_TICK, HEATER_OUTPUT, TEMP_LERP } from '../data/balance';

/** По-комнатная температура + сжигание дерева обогревателями. Без RNG. */
export function runTemperature(s: ColonyState): void {
  const outdoor = s.env.outdoorTemp;

  // Активные обогреватели по комнатам (жгут дерево).
  const activeByRoom = new Map<number, number>();
  for (const b of s.buildings) {
    if (b.type !== 'heater' || !b.built) continue;
    const t = s.map.tiles[idx(b.tile.x, b.tile.y, s.map.w)];
    const rid = t ? t.roomId : 0;
    if (rid === 0) continue; // уличный обогреватель бесполезен
    if (s.resources.wood.amount >= HEATER_FUEL_PER_TICK) {
      s.resources.wood.amount -= HEATER_FUEL_PER_TICK;
      activeByRoom.set(rid, (activeByRoom.get(rid) ?? 0) + 1);
    }
  }

  for (const room of s.rooms) {
    const active = activeByRoom.get(room.id) ?? 0;
    const heatPower = active * HEATER_OUTPUT * (AREA_NORM / Math.max(AREA_NORM, room.area));
    const target = outdoor + heatPower;
    room.temp += (target - room.temp) * TEMP_LERP;
  }

  // Запись температуры в тайлы.
  const roomTemp = new Map<number, number>();
  for (const room of s.rooms) roomTemp.set(room.id, room.temp);
  for (const t of s.map.tiles) {
    t.temp = t.roomId === 0 ? outdoor : roomTemp.get(t.roomId) ?? outdoor;
  }
}
