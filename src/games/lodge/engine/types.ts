import type { Rng } from './seed';

export type Role = 'A' | 'B';
export const ROLES: readonly Role[] = ['A', 'B'];

export type Difficulty = 'gentle' | 'standard' | 'devious';
export interface DifficultyConfig {
  dialLen: number;
  starEdges: number;
  candleCount: number;
}
export const DIFFICULTY: Record<Difficulty, DifficultyConfig> = {
  gentle: { dialLen: 3, starEdges: 3, candleCount: 4 },
  standard: { dialLen: 4, starEdges: 4, candleCount: 5 },
  devious: { dialLen: 5, starEdges: 5, candleCount: 6 },
};

export const SYMBOLS = [
  'sun', 'moon', 'salt', 'sulphur', 'mercury', 'star', 'eye', 'serpent',
] as const;
export type GlyphSymbol = (typeof SYMBOLS)[number];

export type RoomView =
  | { kind: 'dial'; ring: GlyphSymbol[] }
  | { kind: 'legend'; legend: Record<string, number>; target: number[] }
  | { kind: 'starmap'; nodes: number; edges: [number, number][] }
  | { kind: 'constellation'; nodes: number }
  | { kind: 'verse'; order: number[] }
  | { kind: 'candelabra'; count: number };

export type Solution =
  | { kind: 'dial'; positions: number[] }
  | { kind: 'constellation'; edges: [number, number][] }
  | { kind: 'candle'; order: number[] };

export type PuzzleState =
  | { kind: 'dial'; pos: number; entered: number[] }
  | { kind: 'constellation'; edges: [number, number][] }
  | { kind: 'candle'; lit: number[] };

export type PuzzleEvent =
  | { type: 'dial.set'; value: number }
  | { type: 'dial.commit' }
  | { type: 'dial.clear' }
  | { type: 'constellation.toggle'; a: number; b: number }
  | { type: 'candle.light'; index: number }
  | { type: 'candle.reset' };

export interface LodgeEvent {
  seq: number;
  puzzleId: string;
  by: Role;
  event: PuzzleEvent;
}

export interface GeneratedPuzzle {
  archetypeId: string;
  clueOwner: Role;
  lockOwner: Role;
  views: Record<Role, RoomView>;
  solution: Solution;
  state: PuzzleState;
}
export interface PuzzleInstance extends GeneratedPuzzle {
  id: string;
  solved: boolean;
}

export interface Run {
  seed: number;
  difficulty: Difficulty;
  puzzles: PuzzleInstance[];
}
export interface RunState {
  run: Run;
  cursor: number;
  solvedCount: number;
  escaped: boolean;
  seq: number;
}

export interface Archetype {
  id: string;
  generate(rng: Rng, difficulty: Difficulty): GeneratedPuzzle;
  reduce(inst: PuzzleInstance, ev: PuzzleEvent): PuzzleInstance;
  isSolved(inst: PuzzleInstance): boolean;
  solutionEvents(inst: PuzzleInstance): PuzzleEvent[];
}
