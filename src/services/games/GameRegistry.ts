import type { GameDefinition, GameId, GameModule, GameRegistryEntry } from '@/types/game-module';

/** Catalog of games. Definitions are available immediately for the portal UI;
 *  the heavy module (Phaser + systems) is fetched on demand via load(). */
class GameRegistryImpl {
  private entries = new Map<GameId, GameRegistryEntry>();
  private loaded = new Map<GameId, GameModule>();

  register(entry: GameRegistryEntry): void {
    this.entries.set(entry.definition.id, entry);
  }

  getAll(): GameDefinition[] {
    return [...this.entries.values()].map((e) => e.definition);
  }

  getDefinition(id: GameId): GameDefinition | undefined {
    return this.entries.get(id)?.definition;
  }

  has(id: string): id is GameId {
    return this.entries.has(id as GameId);
  }

  async load(id: GameId): Promise<GameModule> {
    const cached = this.loaded.get(id);
    if (cached) return cached;
    const entry = this.entries.get(id);
    if (!entry) throw new Error(`Unknown game: ${id}`);
    const module = await entry.load();
    this.loaded.set(id, module);
    return module;
  }
}

export const GameRegistry = new GameRegistryImpl();
