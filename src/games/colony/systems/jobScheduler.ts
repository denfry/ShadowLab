import type { Building, Colonist, ColonyState, JobType, Pt, Tile } from '../domain/types';
import { findPath } from './pathfinding';
import { tileAt } from './grid';

const tileOf = (c: Colonist): Pt => ({ x: Math.round(c.pos.x), y: Math.round(c.pos.y) });
const dist = (a: Pt, b: Pt) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** Сколько колонистов уже закреплено за зданием (идут или работают). */
function workersOn(s: ColonyState, buildingId: string): number {
  return s.colonists.filter(
    (c) => c.alive && c.targetBuildingId === buildingId && (c.task === 'goto_work' || c.task === 'work'),
  ).length;
}

/** Доступная цель для конкретного типа работы или null. */
function findTarget(s: ColonyState, from: Pt, job: JobType): { tile: Pt; buildingId?: string } | null {
  if (job === 'farm' || job === 'research' || job === 'tailor') {
    let best: Building | undefined;
    let bestD = Infinity;
    for (const b of s.buildings) {
      if (!b.built || b.jobType !== job) continue;
      if (workersOn(s, b.id) >= b.workSlots) continue;
      const d = dist(from, b.tile);
      if (d < bestD) { bestD = d; best = b; }
    }
    return best ? { tile: best.tile, buildingId: best.id } : null;
  }
  if (job === 'build') {
    let best: Building | undefined;
    let bestD = Infinity;
    for (const b of s.buildings) {
      if (b.built) continue;
      if (workersOn(s, b.id) >= 1) continue; // одно блюпринт — один строитель (Фаза 0)
      const d = dist(from, b.tile);
      if (d < bestD) { bestD = d; best = b; }
    }
    return best ? { tile: best.tile, buildingId: best.id } : null;
  }
  if (job === 'woodcut') {
    let best: Tile | undefined;
    let bestD = Infinity;
    for (const t of s.map.tiles) {
      if (t.terrain !== 'forest' || (t.wood ?? 0) <= 0) continue;
      const d = dist(from, t);
      if (d < bestD) { bestD = d; best = t; }
    }
    return best ? { tile: { x: best.x, y: best.y } } : null;
  }
  return null;
}

const JOB_ORDER: JobType[] = ['build', 'farm', 'woodcut', 'research', 'tailor'];

/** Назначает работу всем idle-колонистам по убыванию приоритета. Без RNG. */
export function runJobScheduler(s: ColonyState): void {
  for (const c of s.colonists) {
    if (!c.alive || c.task !== 'idle') continue;

    // Список типов работ, отсортированный по приоритету (выше — раньше),
    // при равенстве — фиксированный JOB_ORDER (детерминизм).
    const jobs = JOB_ORDER
      .filter((j) => (c.priorities[j] ?? 0) > 0)
      .sort((a, b) => (c.priorities[b] - c.priorities[a]) || (JOB_ORDER.indexOf(a) - JOB_ORDER.indexOf(b)));

    const from = tileOf(c);
    for (const job of jobs) {
      const target = findTarget(s, from, job);
      if (!target) continue;
      const path = findPath(s.map, from, target.tile);
      if (path === null) continue;
      c.targetTile = target.tile;
      c.targetBuildingId = target.buildingId;
      c.path = path;
      c.task = 'goto_work';
      break;
    }
  }
}

export { tileAt };
