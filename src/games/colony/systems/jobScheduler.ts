import type { Building, Colonist, ColonyState, JobType, Pt } from '../domain/types';
import { findPath } from './pathfinding';
import { cachedFindPathHier } from './pathHierarchy';
import { tileAt } from './grid';
import { buildIndex, nearest, type SpatialIndex } from './spatialIndex';
import { CLUSTER, ASSIGN_BUDGET } from '../data/balance';

const tileOf = (c: Colonist): Pt => ({ x: Math.round(c.pos.x), y: Math.round(c.pos.y) });

/** Сколько колонистов уже закреплено за зданием (идут или работают). */
function workersOn(s: ColonyState, buildingId: string): number {
  return s.colonists.filter(
    (c) => c.alive && c.targetBuildingId === buildingId && (c.task === 'goto_work' || c.task === 'work'),
  ).length;
}

/** Индекс целей текущего тика: узлы по виду + здания по jobType + блюпринты как 'build'. */
function buildTargetIndex(s: ColonyState): { ix: SpatialIndex; byTile: Map<string, Building> } {
  const pts: Array<{ x: number; y: number; cat: string }> = [];
  const byTile = new Map<string, Building>();
  for (const b of s.buildings) {
    const cat = !b.built ? 'build' : b.jobType ? `job:${b.jobType}` : undefined;
    if (!cat) continue;
    pts.push({ x: b.tile.x, y: b.tile.y, cat });
    byTile.set(`${b.tile.x},${b.tile.y}`, b);
  }
  for (const [i, node] of s.map.nodes) {
    if (node.amount <= 0) continue;
    pts.push({ x: i % s.map.w, y: Math.floor(i / s.map.w), cat: `node:${node.kind}` });
  }
  return { ix: buildIndex(s.map.w, s.map.h, CLUSTER, pts), byTile };
}

function findTarget(
  s: ColonyState, from: Pt, job: JobType,
  ix: SpatialIndex, byTile: Map<string, Building>,
): { tile: Pt; buildingId?: string } | null {
  if (job === 'farm' || job === 'research' || job === 'tailor') {
    const t = nearest(ix, s.map.w, s.map.h, from, `job:${job}`, (p) => {
      const b = byTile.get(`${p.x},${p.y}`)!;
      return workersOn(s, b.id) < b.workSlots;
    });
    if (!t) return null;
    const b = byTile.get(`${t.x},${t.y}`)!;
    return { tile: b.tile, buildingId: b.id };
  }
  if (job === 'build') {
    const t = nearest(ix, s.map.w, s.map.h, from, 'build', (p) => {
      const b = byTile.get(`${p.x},${p.y}`)!;
      return workersOn(s, b.id) < 1;
    });
    if (!t) return null;
    const b = byTile.get(`${t.x},${t.y}`)!;
    return { tile: b.tile, buildingId: b.id };
  }
  if (job === 'woodcut') {
    const t = nearest(ix, s.map.w, s.map.h, from, 'node:wood');
    return t ? { tile: t } : null;
  }
  return null;
}

const JOB_ORDER: JobType[] = ['build', 'farm', 'woodcut', 'research', 'tailor'];

/** Назначает работу idle-колонистам с бюджетом путей за тик (time-sliced). Без RNG. */
export function runJobScheduler(s: ColonyState): void {
  const { ix, byTile } = buildTargetIndex(s);
  const n = s.colonists.length;
  if (n === 0) { s.assignCursor = 0; return; }
  let budget = ASSIGN_BUDGET;
  let examined = 0;
  for (; examined < n && budget > 0; examined++) {
    const i = (s.assignCursor + examined) % n;
    const c = s.colonists[i];
    if (!c.alive || c.task !== 'idle') continue;
    const jobs = JOB_ORDER
      .filter((j) => (c.priorities[j] ?? 0) > 0)
      .sort((a, b) => (c.priorities[b] - c.priorities[a]) || (JOB_ORDER.indexOf(a) - JOB_ORDER.indexOf(b)));
    const from = tileOf(c);
    for (const job of jobs) {
      const target = findTarget(s, from, job, ix, byTile);
      if (!target) continue;
      const path = s.nav ? cachedFindPathHier(s.map, s.nav, from, target.tile) : findPath(s.map, from, target.tile);
      if (path === null) continue;
      c.targetTile = target.tile;
      c.targetBuildingId = target.buildingId;
      c.path = path;
      c.task = 'goto_work';
      budget -= 1;
      break;
    }
  }
  s.assignCursor = (s.assignCursor + examined) % n;
}

export { tileAt };
