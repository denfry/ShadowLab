import type { SaveFile } from '@/types/save';
import { SaveManager } from '@/services/save/SaveManager';
import { appBus } from '@/core/events/appBus';
import { debounce, nowIso } from '@/core/utils';
import { fetchCloudSave, upsertCloudSave } from '@/services/supabase/cloudSaves';
import { decideSync } from './mergeDecision';
import { summarizeSave } from './saveSummary';
import { useSyncStore } from '@/stores/useSyncStore';
import { useProfileStore } from '@/stores/useProfileStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useAchievementStore } from '@/stores/useAchievementStore';

const PUSH_DEBOUNCE = 4000;
const DEVICE =
  typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 80) : 'unknown';

class CloudSyncImpl {
  private userId: string | null = null;
  private unsubDirty: (() => void) | null = null;
  private suppressDirty = false;
  private pushDebounced = debounce(() => void this.push(), PUSH_DEBOUNCE);

  async onAuthChange(userId: string | null): Promise<void> {
    if (userId === this.userId) return;
    this.userId = userId;
    if (!userId) {
      this.stop();
      return;
    }
    await this.initialSync();
    this.startListening();
  }

  stop(): void {
    this.unsubDirty?.();
    this.unsubDirty = null;
    this.pushDebounced.cancel();
    useSyncStore.getState().setPhase('idle');
  }

  private startListening(): void {
    this.suppressDirty = false;
    this.unsubDirty?.();
    this.unsubDirty = appBus.on('save:dirty', () => {
      if (this.suppressDirty) {
        this.suppressDirty = false;
        return;
      }
      useSyncStore.getState().setPhase('syncing');
      this.pushDebounced();
    });
  }

  private async initialSync(): Promise<void> {
    if (!this.userId) return;
    useSyncStore.getState().setPhase('syncing');
    let cloud;
    try {
      cloud = await fetchCloudSave(this.userId);
    } catch (err) {
      console.error('[CloudSync] initial sync failed', err);
      useSyncStore.getState().setPhase('error');
      return;
    }
    const local = SaveManager.getFile();
    const action = decideSync(local, cloud);
    if (action === 'push') {
      await this.push();
    } else if (action === 'pull' && cloud) {
      await this.applyCloud(cloud.data);
      useSyncStore.getState().markSynced(cloud.updated_at);
    } else if (action === 'conflict' && cloud) {
      useSyncStore.getState().setConflict({
        local,
        cloud: cloud.data,
        localSummary: summarizeSave(local),
        cloudSummary: summarizeSave(cloud.data),
        cloudUpdatedAt: cloud.updated_at,
      });
      useSyncStore.getState().setPhase('idle');
    } else {
      useSyncStore.getState().markSynced(nowIso());
    }
    await this.markLinked();
  }

  private async applyCloud(data: SaveFile): Promise<void> {
    this.suppressDirty = true;
    await SaveManager.importAll(data);
    useProfileStore.getState().hydrate(SaveManager.getProfile());
    useSettingsStore.getState().hydrate(SaveManager.getSettings());
    useAchievementStore.getState().refresh();
  }

  private async push(): Promise<void> {
    if (!this.userId) return;
    try {
      await upsertCloudSave(this.userId, SaveManager.getFile(), DEVICE);
      useSyncStore.getState().markSynced(nowIso());
    } catch (err) {
      console.error('[CloudSync] push failed', err);
      useSyncStore.getState().setPhase('error');
    }
  }

  private async markLinked(): Promise<void> {
    if (!SaveManager.getProfile().cloudLinked) {
      await SaveManager.setProfile({ cloudLinked: true });
      useProfileStore.getState().refresh();
    }
  }

  async resolveConflict(choice: 'local' | 'cloud'): Promise<void> {
    const c = useSyncStore.getState().conflict;
    if (!c) return;
    useSyncStore.getState().setConflict(null);
    useSyncStore.getState().setPhase('syncing');
    if (choice === 'cloud') {
      await SaveManager.backupNow();
      await this.applyCloud(c.cloud);
    }
    await this.push();
    this.startListening();
  }
}

export const CloudSync = new CloudSyncImpl();
