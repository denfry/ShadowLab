import type { PuzzleInstance, PuzzleEvent, Role } from '@/games/lodge/engine';

export interface StationProps {
  puzzle: PuzzleInstance;
  dispatch: (puzzleId: string, by: Role, event: PuzzleEvent) => void;
}
