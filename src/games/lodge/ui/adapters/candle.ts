import type { RoomView, PuzzleState } from '@/games/lodge/engine';

export interface CandleProps {
  lit: boolean[];
  positions: number[];
}

export function candleProps(
  view: Extract<RoomView, { kind: 'candelabra' }>,
  state: Omit<Extract<PuzzleState, { kind: 'candle' }>, 'lit'> & { lit: readonly number[] },
): CandleProps {
  const count = view.count;
  const litSet = new Set(state.lit);
  const lit: boolean[] = [];
  const positions: number[] = [];
  for (let i = 0; i < count; i++) {
    lit.push(litSet.has(i));
    positions.push(i - (count - 1) / 2);
  }
  return { lit, positions };
}
