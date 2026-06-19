import { SaveManager } from '@/services/save/SaveManager';
import { AchievementManager } from '@/services/achievements/AchievementManager';
import { appBus } from '@/core/events/appBus';
import { registerGames } from '@/games';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useProfileStore } from '@/stores/useProfileStore';
import { useAchievementStore } from '@/stores/useAchievementStore';
import { useToastStore } from '@/stores/useToastStore';
import { useAuthStore } from '@/stores/useAuthStore';

/**
 * One-time portal bootstrap: register the game catalog, load persisted save
 * state, hydrate the Zustand stores from it, and wire global event listeners.
 * Must complete before the first React render.
 */
export async function bootstrapApp(): Promise<void> {
  registerGames();

  await SaveManager.init();

  // Hydrate UI stores from the (possibly migrated) save file.
  useSettingsStore.getState().hydrate(SaveManager.getSettings());
  useProfileStore.getState().hydrate(SaveManager.getProfile());
  useAchievementStore.getState().refresh();

  // Global wiring: toasts + achievement re-reads.
  appBus.on('toast', (payload) => useToastStore.getState().push(payload));
  AchievementManager.subscribe(() => useAchievementStore.getState().refresh());

  // Keep reduced-motion in sync with system preference on first load.
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    const s = useSettingsStore.getState();
    if (!s.reducedMotion) s.set('reducedMotion', true);
  }

  // Initialize auth last; sets 'guest' when cloud is unconfigured.
  useAuthStore.getState().init();
}
