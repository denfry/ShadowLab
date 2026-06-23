import { describe, expect, it } from 'vitest';
import { buildIndex, nearest } from '@/games/colony/systems/spatialIndex';

const brute = (pts: Array<{x:number;y:number;cat:string}>, from:{x:number;y:number}, cat:string) => {
  let best: {x:number;y:number} | undefined, bd = Infinity;
  for (const p of pts) {
    if (p.cat !== cat) continue;
    const d = Math.abs(p.x-from.x)+Math.abs(p.y-from.y);
    if (d < bd) { bd = d; best = { x: p.x, y: p.y }; }
  }
  return best;
};

describe('spatialIndex', () => {
  it('nearest matches brute force for scattered points', () => {
    const pts = [
      { x: 3, y: 3, cat: 'wood' }, { x: 30, y: 5, cat: 'wood' },
      { x: 50, y: 50, cat: 'stone' }, { x: 10, y: 40, cat: 'wood' },
    ];
    const ix = buildIndex(64, 64, 16, pts);
    for (const from of [{x:0,y:0},{x:31,y:6},{x:9,y:39},{x:63,y:63}]) {
      expect(nearest(ix, 64, 64, from, 'wood')).toEqual(brute(pts, from, 'wood'));
    }
    expect(nearest(ix, 64, 64, {x:0,y:0}, 'gold')).toBeUndefined();
  });
  it('respects the accept predicate (e.g. building with a free slot)', () => {
    const pts = [{ x: 5, y: 5, cat: 'farm' }, { x: 6, y: 5, cat: 'farm' }];
    const ix = buildIndex(32, 32, 16, pts);
    const found = nearest(ix, 32, 32, { x: 0, y: 0 }, 'farm', (p) => !(p.x === 5 && p.y === 5));
    expect(found).toEqual({ x: 6, y: 5 });
  });
  it('matches brute force on a randomized-but-seeded fixture', () => {
    // deterministic pseudo-points (no Math.random): lattice with category by parity
    const pts: Array<{x:number;y:number;cat:string}> = [];
    for (let i = 0; i < 200; i++) {
      const x = (i * 37) % 128, y = (i * 53) % 128;
      pts.push({ x, y, cat: i % 3 === 0 ? 'wood' : 'stone' });
    }
    const ix = buildIndex(128, 128, 16, pts);
    for (let i = 0; i < 20; i++) {
      const from = { x: (i * 61) % 128, y: (i * 17) % 128 };
      expect(nearest(ix, 128, 128, from, 'wood')).toEqual(brute(pts, from, 'wood'));
    }
  });
});
