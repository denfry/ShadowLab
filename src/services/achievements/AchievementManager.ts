import type { AchievementDefinition, AchievementProgress, AchievementScope } from '@/types/achievements';
import { nowIso } from '@/core/utils';
import { appBus } from '@/core/events/appBus';
import { SaveManager } from '@/services/save/SaveManager';
import { ALL_ACHIEVEMENTS } from './definitions';

type Listener = () => void;

/**
 * Global achievement registry. Definitions are static; progress is persisted
 * through SaveManager. Unlocks emit a toast + notify subscribers (the Zustand
 * store re-reads progress on change).
 */
class AchievementManagerImpl {
  private defs: AchievementDefinition[] = ALL_ACHIEVEMENTS;
  private byId = new Map(this.defs.map((d) => [d.id, d]));
  private listeners = new Set<Listener>();

  getDefinitions(): AchievementDefinition[] {
    return this.defs;
  }

  forScope(scope: AchievementScope): AchievementDefinition[] {
    return this.defs.filter((d) => d.scope === scope);
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    this.listeners.forEach((l) => l());
  }

  getProgress(): Record<string, AchievementProgress> {
    const save = SaveManager.getAchievements();
    const out: Record<string, AchievementProgress> = {};
    for (const def of this.defs) {
      const unlockedAt = save.unlocked[def.id];
      out[def.id] = {
        id: def.id,
        unlocked: Boolean(unlockedAt),
        unlockedAt,
        current: save.progress[def.id] ?? 0,
        target: def.target ?? 1,
      };
    }
    return out;
  }

  totalPoints(): { earned: number; total: number } {
    const save = SaveManager.getAchievements();
    let earned = 0;
    let total = 0;
    for (const def of this.defs) {
      total += def.points;
      if (save.unlocked[def.id]) earned += def.points;
    }
    return { earned, total };
  }

  unlock(id: string): void {
    const def = this.byId.get(id);
    if (!def) return;
    const save = SaveManager.getAchievements();
    if (save.unlocked[id]) return;
    save.unlocked[id] = nowIso();
    if (def.type === 'counter') save.progress[id] = def.target ?? 1;
    void SaveManager.setAchievements(save);
    appBus.emit('achievement:unlocked', { id, title: def.title });
    appBus.emit('toast', {
      kind: 'achievement',
      title: 'Достижение получено',
      message: def.title,
      icon: def.icon,
    });
    this.notify();
  }

  /** For counter achievements: record progress and auto-unlock at target. */
  progress(id: string, value: number): void {
    const def = this.byId.get(id);
    if (!def) return;
    const save = SaveManager.getAchievements();
    if (save.unlocked[id]) return;
    const current = Math.max(save.progress[id] ?? 0, value);
    save.progress[id] = current;
    void SaveManager.setAchievements(save);
    if (def.type === 'counter' && current >= (def.target ?? 1)) {
      this.unlock(id);
    } else {
      this.notify();
    }
  }
}

export const AchievementManager = new AchievementManagerImpl();
