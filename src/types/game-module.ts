import type { ComponentType } from 'react';
import type { GameEventBus } from '@/core/events/EventBus';
import type { SettingsSave } from './save';

export type GameId = 'shadow-trace' | 'colony';
export type GameTheme = 'colony' | 'shadow';
export type LaunchMode = 'new' | 'load';

export interface GameDefinition {
  id: GameId;
  title: string;
  tagline: string;
  description: string;
  theme: GameTheme;
  status: 'available' | 'soon';
  tags: string[];
  /** Short flavour for the launch/loading screen. */
  bootHint: string;
}

/** Save surface exposed to a game instance — scoped to its own gameId. */
export interface GameSaveApi {
  load(slot: number): Promise<unknown | null>;
  save(slot: number, payload: unknown, label: string): Promise<void>;
  autosave(payload: unknown, label: string): void;
  autosaveFlush(): Promise<void>;
}

/** Achievement surface exposed to a game instance. */
export interface GameAchievementApi {
  unlock(id: string): void;
  progress(id: string, value: number): void;
}

/** Persistent numeric records (bests/counters) surfaced on the portal. */
export interface GameRecordsApi {
  set(key: string, value: number, mode?: 'max' | 'set' | 'inc'): void;
  get(key: string): number;
}

export type ReadonlySettings = Readonly<SettingsSave>;

/** Everything a game is allowed to touch on the portal. Created by PortalBridge. */
export interface GameContext {
  gameId: GameId;
  mode: LaunchMode;
  slot: number;
  /** Extra launch parameters from the URL (e.g. { case: 'gallery-forgery' }). */
  params: Record<string, string>;
  events: GameEventBus;
  save: GameSaveApi;
  achievements: GameAchievementApi;
  records: GameRecordsApi;
  settings: ReadonlySettings;
  /** Return to the portal (navigates away from the launcher). */
  exit(): void;
  /** Tear down listeners/timers. Called by GameCanvasWrapper on unmount. */
  dispose(): void;
}

export interface GameInstance {
  pause(): void;
  resume(): void;
  destroy(): void;
}

/** The single contract every game implements. The portal knows nothing else. */
export interface GameModule {
  definition: GameDefinition;
  /** Schema version of this game's save payload (drives per-game migrations). */
  payloadVersion: number;
  /** Mount a canvas-based runtime (Phaser). May be a no-op for pure-React games. */
  mount(container: HTMLElement, ctx: GameContext): Promise<GameInstance>;
  /** Optional React HUD/overlay rendered above the canvas. */
  Hud?: ComponentType<{ ctx: GameContext }>;
}

/** Lightweight catalog entry — definition is eager, module is lazy-loaded. */
export interface GameRegistryEntry {
  definition: GameDefinition;
  load: () => Promise<GameModule>;
}
