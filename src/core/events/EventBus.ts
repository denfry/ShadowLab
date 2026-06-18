/**
 * Minimal typed event emitter (mitt-like). Used both as the global portal bus
 * and as a per-game-instance scoped bus inside GameContext.
 */
export type EventHandler<T = unknown> = (payload: T) => void;

export class EventBus<Events extends Record<string, unknown> = Record<string, unknown>> {
  private handlers = new Map<keyof Events, Set<EventHandler>>();

  on<K extends keyof Events>(type: K, handler: EventHandler<Events[K]>): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler as EventHandler);
    return () => this.off(type, handler);
  }

  once<K extends keyof Events>(type: K, handler: EventHandler<Events[K]>): () => void {
    const off = this.on(type, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  off<K extends keyof Events>(type: K, handler: EventHandler<Events[K]>): void {
    this.handlers.get(type)?.delete(handler as EventHandler);
  }

  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    this.handlers.get(type)?.forEach((handler) => handler(payload));
  }

  clear(): void {
    this.handlers.clear();
  }
}

/** Loosely-typed bus used between a game's systems and its React HUD. */
export type GameEventBus = EventBus<Record<string, any>>;
