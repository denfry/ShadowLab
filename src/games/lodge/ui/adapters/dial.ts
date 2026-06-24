import type { RoomView, PuzzleState } from '@/games/lodge/engine';

export interface DialProps {
  ringLabels: string[];
  pointerAngleRad: number;
  enteredLabels: string[];
}

export function dialProps(
  view: Omit<Extract<RoomView, { kind: 'dial' }>, 'ring'> & { ring: readonly string[] },
  state: Omit<Extract<PuzzleState, { kind: 'dial' }>, 'entered'> & { entered: readonly number[] },
): DialProps {
  const n = view.ring.length;
  return {
    ringLabels: [...view.ring],
    pointerAngleRad: n === 0 ? 0 : (state.pos / n) * Math.PI * 2,
    enteredLabels: state.entered.map((i) => view.ring[i]),
  };
}
