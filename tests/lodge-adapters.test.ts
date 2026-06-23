import { describe, expect, it } from 'vitest';
import { dialProps } from '@/games/lodge/ui/adapters/dial';
import { constellationProps } from '@/games/lodge/ui/adapters/constellation';
import { candleProps } from '@/games/lodge/ui/adapters/candle';

describe('dialProps', () => {
  it('maps pos to a rotation angle and entered indices to labels', () => {
    const view = { kind: 'dial', ring: ['sun', 'moon', 'star', 'eye'] } as const;
    const state = { kind: 'dial', pos: 1, entered: [0, 2] } as const;
    const p = dialProps(view, state);
    expect(p.ringLabels).toEqual(['sun', 'moon', 'star', 'eye']);
    expect(p.pointerAngleRad).toBeCloseTo((1 / 4) * Math.PI * 2);
    expect(p.enteredLabels).toEqual(['sun', 'star']);
  });
});

describe('constellationProps', () => {
  it('places nodes on a unit circle and passes edges through', () => {
    const view = { kind: 'constellation', nodes: 4 } as const;
    const state = { kind: 'constellation', edges: [[0, 2]] as [number, number][] } as const;
    const p = constellationProps(view, state);
    expect(p.nodePositions).toHaveLength(4);
    for (const [x, y] of p.nodePositions) expect(Math.hypot(x, y)).toBeCloseTo(1);
    expect(p.edges).toEqual([[0, 2]]);
  });
});

describe('candleProps', () => {
  it('flags lit candles and centers positions', () => {
    const view = { kind: 'candelabra', count: 4 } as const;
    const state = { kind: 'candle', lit: [0, 2] } as const;
    const p = candleProps(view, state);
    expect(p.lit).toEqual([true, false, true, false]);
    expect(p.positions).toEqual([-1.5, -0.5, 0.5, 1.5]);
  });
});
