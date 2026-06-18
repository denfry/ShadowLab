import { create } from 'zustand';
import type { ProfileSave } from '@/types/save';
import { SaveManager } from '@/services/save/SaveManager';

interface ProfileStore {
  profile: ProfileSave;
  hydrate(profile: ProfileSave): void;
  refresh(): void;
  setDisplayName(name: string): void;
  setAvatar(avatarId: string): void;
}

export const useProfileStore = create<ProfileStore>((set) => ({
  profile: SaveManager.getProfile(),

  hydrate: (profile) => set({ profile }),

  refresh: () => set({ profile: { ...SaveManager.getProfile() } }),

  setDisplayName: (name) => {
    void SaveManager.setProfile({ displayName: name }).then(() =>
      set({ profile: { ...SaveManager.getProfile() } }),
    );
  },

  setAvatar: (avatarId) => {
    void SaveManager.setProfile({ avatarId }).then(() =>
      set({ profile: { ...SaveManager.getProfile() } }),
    );
  },
}));
