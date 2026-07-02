import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { runRegrowth } from '@/games/colony/systems/regrowth';
import { setNode, setBiome, setPassable, nodeAt, idx } from '@/games/colony/systems/grid';
import { Rng } from '@/core/utils/rng';

describe('regrowth', () => {
  it('is deterministic: same seed -> same spawn outcome', () => {
    const build = () => {
      const s = createColony(9);
      setNode(s.map, 50, 50, { kind: 'wood', amount: 20, max: 20 });
      setBiome(s.map, 51, 50, 'grass'); setPassable(s.map, 51, 50, true);
      setBiome(s.map, 49, 50, 'grass'); setPassable(s.map, 49, 50, true);
      setBiome(s.map, 50, 51, 'grass'); setPassable(s.map, 50, 51, true);
      setBiome(s.map, 50, 49, 'grass'); setPassable(s.map, 50, 49, true);
      return s;
    };
    const a = build(), b = build();
    const rngA = new Rng(1234), rngB = new Rng(1234);
    for (let i = 0; i < 30; i++) { runRegrowth(a, rngA); runRegrowth(b, rngB); }
    const countNodes = (s: ReturnType<typeof build>) => [...s.map.nodes.values()].length;
    expect(countNodes(a)).toBe(countNodes(b));
  });
  it('does not spawn a sapling onto a building or a field tile', () => {
    const s = createColony(10);
    setNode(s.map, 60, 60, { kind: 'wood', amount: 20, max: 20 });
    // surround the only neighbour candidates so none are eligible
    setBiome(s.map, 61, 60, 'grass'); setPassable(s.map, 61, 60, true);
    s.fields.set(idx(61, 60, s.map.w), { crop: 'wheat', stage: 'till', progress: 0 });
    setBiome(s.map, 59, 60, 'forest'); // not grass
    setBiome(s.map, 60, 61, 'rock');   // not grass
    setBiome(s.map, 60, 59, 'water');  // not grass
    const rng = new Rng(5);
    for (let i = 0; i < 200; i++) runRegrowth(s, rng); // force-exhaust the 2% daily roll
    expect(nodeAt(s.map, 61, 60)).toBeUndefined();
  });
  it('berries regrow after BERRY_REGROW_DAYS on a still-wild tile, not before', () => {
    const s = createColony(11);
    s.regrowCooldowns.set(idx(70, 70, s.map.w), 4);
    const rng = new Rng(2);
    for (let i = 0; i < 3; i++) runRegrowth(s, rng);
    expect(nodeAt(s.map, 70, 70)).toBeUndefined();
    runRegrowth(s, rng);
    expect(nodeAt(s.map, 70, 70)).toEqual({ kind: 'berries', amount: 5, max: 5 });
    expect(s.regrowCooldowns.has(idx(70, 70, s.map.w))).toBe(false);
  });
});
