import type { GameContext, GameId, LaunchMode } from '@/types/game-module';
import { EventBus } from '@/core/events/EventBus';
import { SaveManager } from '@/services/save/SaveManager';
import { AchievementManager } from '@/services/achievements/AchievementManager';

interface BridgeOptions {
  gameId: GameId;
  mode: LaunchMode;
  slot: number;
  params?: Record<string, string>;
  payloadVersion: number;
  onExit: () => void;
}

/**
 * The thin facade through which a game touches the portal. Builds a fresh
 * GameContext per launch: a scoped event bus, a save API bound to this game,
 * an achievement API, a settings snapshot, and exit/dispose hooks.
 */
export function createGameContext(opts: BridgeOptions): GameContext {
  const events = new EventBus<Record<string, any>>();
  let disposed = false;
  let playStartedAt = Date.now();

  const ctx: GameContext = {
    gameId: opts.gameId,
    mode: opts.mode,
    slot: opts.slot,
    params: opts.params ?? {},
    events,
    settings: Object.freeze(structuredCloneSafe(SaveManager.getSettings())),

    save: {
      load: (slot) => Promise.resolve(SaveManager.getSlot(opts.gameId, slot)?.payload ?? null),
      save: (slot, payload, label) =>
        SaveManager.saveSlot({
          gameId: opts.gameId,
          slot,
          version: opts.payloadVersion,
          label,
          createdAt: '',
          updatedAt: '',
          payload,
        }),
      autosave: (payload, label) =>
        SaveManager.autosave(opts.gameId, opts.payloadVersion, payload, label),
      autosaveFlush: () => SaveManager.flushAutosave(opts.gameId),
    },

    achievements: {
      unlock: (id) => AchievementManager.unlock(id),
      progress: (id, value) => AchievementManager.progress(id, value),
    },

    records: {
      set: (key, value, mode) => SaveManager.setRecord(key, value, mode),
      get: (key) => SaveManager.getRecord(key),
    },

    exit: () => {
      void finalize();
      opts.onExit();
    },

    dispose: () => {
      void finalize();
    },
  };

  async function finalize(): Promise<void> {
    if (disposed) return;
    disposed = true;
    const seconds = Math.round((Date.now() - playStartedAt) / 1000);
    events.clear();
    await SaveManager.flushAutosave(opts.gameId);
    await SaveManager.addPlaytime(opts.gameId, seconds);
  }

  return ctx;
}

function structuredCloneSafe<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}
