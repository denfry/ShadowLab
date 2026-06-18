import { create } from 'zustand';
import type { SettingsSave } from '@/types/save';
import { SaveManager } from '@/services/save/SaveManager';

interface SettingsStore extends SettingsSave {
  hydrate(settings: SettingsSave): void;
  set<K extends keyof SettingsSave>(key: K, value: SettingsSave[K]): void;
}

const initial = SaveManager.getSettings();

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...initial,

  hydrate: (settings) => set({ ...settings }),

  // Persists silently through SaveManager so cloud/migration stay uniform.
  set: (key, value) => {
    set({ [key]: value } as Partial<SettingsStore>);
    const { audio, graphics, language, reducedMotion } = get();
    const next: SettingsSave = { audio, graphics, language, reducedMotion };
    void SaveManager.setSettings(next);
  },
}));
