import { describe, expect, it } from 'vitest';
import { createMap, setPassable } from '@/games/colony/systems/grid';
import { detectPortals, clusterIdOf } from '@/games/colony/systems/pathHierarchy';

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
