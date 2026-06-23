import { describe, expect, it } from 'vitest';
import { createMap, setPassable } from '@/games/colony/systems/grid';
import { detectPortals, clusterIdOf, buildNav, localDistance } from '@/games/colony/systems/pathHierarchy';
import { findPathHier } from '@/games/colony/systems/pathHierarchy';
import { findPath } from '@/games/colony/systems/pathfinding';
import { PATH_LEN_BOUND_K } from '@/games/colony/data/balance';

const valid = (m: any, start: any, path: any[], goal: any) => {
  if (path.length === 0) return start.x === goal.x && start.y === goal.y;
  let prev = start;
  for (const p of path) {
    if (Math.abs(p.x - prev.x) + Math.abs(p.y - prev.y) !== 1) return false;
    prev = p;
  }
  return prev.x === goal.x && prev.y === goal.y;
};

describe('portals', () => {
  it('an open 32x32 map yields one portal per border segment between adjacent clusters', () => {
    const m = createMap(32, 32); // cluster 16 -> 2x2 clusters, fully passable
    const { portals, interEdges } = detectPortals(m, 16);
    // 4 internal borders (2 vertical between left/right pairs, 2 horizontal) -> each a single open
    // segment -> 1 portal pair each -> 8 portals total, 4 inter-edge pairs.
    expect(portals.length).toBe(8);
    let interPairs = 0; interEdges.forEach((arr) => interPairs += arr.length);
    expect(interPairs).toBe(8); // 4 pairs, bidirectional
  });
  it('a wall splitting a border produces two portal segments', () => {
    const m = createMap(32, 16); // 2x1 clusters, vertical border at x=15/16
    // block the middle rows of the border -> two passable segments
    for (let y = 6; y <= 9; y++) { setPassable(m, 15, y, false); setPassable(m, 16, y, false); }
    const { portalsByCluster } = detectPortals(m, 16);
    const left = portalsByCluster.get(clusterIdOf(0, 0, { clusterSize: 16, clustersW: 2 }))!;
    expect(left.length).toBe(2); // two segments -> two portals on the left cluster's border
  });
  it('a fully walled border yields no portals there', () => {
    const m = createMap(32, 16);
    for (let y = 0; y < 16; y++) { setPassable(m, 15, y, false); setPassable(m, 16, y, false); }
    const { portals } = detectPortals(m, 16);
    expect(portals.length).toBe(0);
  });
});

describe('findPathHier', () => {
  it('cross-cluster path is valid and within the length bound', () => {
    const m = createMap(48, 48); // 3x3 clusters
    for (let y = 0; y < 46; y++) setPassable(m, 24, y, false); // long wall, gap near bottom
    const nav = buildNav(m, 16);
    const start = { x: 2, y: 2 }, goal = { x: 45, y: 2 };
    const hier = findPathHier(m, nav, start, goal)!;
    const opt = findPath(m, start, goal)!;
    expect(hier).not.toBeNull();
    expect(valid(m, start, hier, goal)).toBe(true);
    expect(hier.length).toBeLessThanOrEqual(Math.ceil(opt.length * PATH_LEN_BOUND_K));
  });
  it('returns null when the goal cluster is sealed off', () => {
    const m = createMap(32, 16);
    for (let y = 0; y < 16; y++) { setPassable(m, 15, y, false); setPassable(m, 16, y, false); }
    const nav = buildNav(m, 16);
    expect(findPathHier(m, nav, { x: 1, y: 1 }, { x: 30, y: 1 })).toBeNull();
  });
  it('same-cluster short hop returns the local optimal path', () => {
    const m = createMap(16, 16);
    const nav = buildNav(m, 16);
    const hier = findPathHier(m, nav, { x: 1, y: 1 }, { x: 5, y: 1 })!;
    expect(hier.length).toBe(4);
  });
  it('cross-cluster path with an intra-cluster portal-to-portal hop stays valid and bounded', () => {
    const m = createMap(48, 16); // 3x1 clusters, fully open -> path crosses the middle cluster
    const nav = buildNav(m, 16);
    const start = { x: 1, y: 8 }, goal = { x: 46, y: 8 };
    const hier = findPathHier(m, nav, start, goal)!;
    const opt = findPath(m, start, goal)!;
    expect(hier).not.toBeNull();
    expect(valid(m, start, hier, goal)).toBe(true);
    expect(hier.length).toBeLessThanOrEqual(Math.ceil(opt.length * PATH_LEN_BOUND_K));
  });
});

describe('intra-cluster distances + buildNav', () => {
  it('intra-cluster distance equals constrained path length', () => {
    const m = createMap(16, 16); // single cluster
    expect(localDistance(m, 0, 16, 1, { x: 0, y: 0 }, { x: 5, y: 0 })).toBe(5);
    for (let y = 0; y < 15; y++) setPassable(m, 8, y, false); // wall with gap at bottom
    const d = localDistance(m, 0, 16, 1, { x: 0, y: 0 }, { x: 15, y: 0 })!;
    expect(d).toBeGreaterThan(15); // must detour around the wall
  });
  it('buildNav assembles portals + intra edges and is internally consistent', () => {
    const m = createMap(32, 32);
    const nav = buildNav(m, 16);
    expect(nav.portals.length).toBe(8);
    // every portal that shares a cluster with another has an intra edge to it
    for (const p of nav.portals) {
      const mates = (nav.portalsByCluster.get(p.cluster) ?? []).filter((q) => q.id !== p.id);
      const intra = nav.intraEdges.get(p.id) ?? [];
      expect(intra.length).toBe(mates.length);
    }
  });
});
