/**
 * Regression test for Fix 1: suppressDirty leak after cloud pull.
 *
 * Scenario: local save is default (empty), cloud has meaningful data →
 * initialSync() takes the 'pull' path → applyCloud() sets suppressDirty=true.
 * Before the fix, startListening() would NOT reset the flag, so the first
 * 'save:dirty' event after login would be silently dropped.
 * After the fix, startListening() resets suppressDirty=false, so the first
 * real edit IS pushed to cloud.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Hoisted mocks (vi.mock factories are hoisted; use vi.hoisted for shared refs) ──
const { mockUpsertCloudSave, mockFetchCloudSave, mockImportAll, mockGetFile, mockGetProfile } =
  vi.hoisted(() => ({
    mockUpsertCloudSave: vi.fn().mockResolvedValue(undefined),
    mockFetchCloudSave: vi.fn(),
    mockImportAll: vi.fn(),
    mockGetFile: vi.fn(),
    mockGetProfile: vi.fn(),
  }));

vi.mock('@/services/supabase/cloudSaves', () => ({
  fetchCloudSave: mockFetchCloudSave,
  upsertCloudSave: mockUpsertCloudSave,
}));

vi.mock('@/services/save/SaveManager', () => ({
  SaveManager: {
    getFile: mockGetFile,
    getProfile: mockGetProfile,
    getSettings: vi.fn(() => ({
      audio: { master: 0.8, music: 0.6, sfx: 0.8, muted: false },
      graphics: { quality: 'high', particles: true },
      language: 'ru',
      reducedMotion: false,
    })),
    setProfile: vi.fn().mockResolvedValue(undefined),
    importAll: mockImportAll,
    backupNow: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/stores/useSyncStore', () => ({
  useSyncStore: {
    getState: vi.fn(() => ({
      setPhase: vi.fn(),
      markSynced: vi.fn(),
      setConflict: vi.fn(),
      conflict: null,
    })),
  },
}));

vi.mock('@/stores/useProfileStore', () => ({
  useProfileStore: {
    getState: vi.fn(() => ({ hydrate: vi.fn(), refresh: vi.fn() })),
  },
}));

vi.mock('@/stores/useSettingsStore', () => ({
  useSettingsStore: {
    getState: vi.fn(() => ({ hydrate: vi.fn() })),
  },
}));

vi.mock('@/stores/useAchievementStore', () => ({
  useAchievementStore: {
    getState: vi.fn(() => ({ refresh: vi.fn() })),
  },
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────
import { appBus } from '@/core/events/appBus';
import { CloudSync } from '@/services/cloud/CloudSync';

const BASE_PROFILE = {
  id: 'player_mock',
  displayName: 'Mock',
  avatarId: 'avatar-01',
  createdAt: '2026-01-01T00:00:00.000Z',
  stats: { totalPlaytimeSec: 0, gamesPlayed: {} },
  cloudLinked: false,
};

const LOCAL_SAVE = {
  schemaVersion: 1,
  profile: BASE_PROFILE,
  settings: { audio: { master: 0.8, music: 0.6, sfx: 0.8, muted: false }, graphics: { quality: 'high', particles: true }, language: 'ru', reducedMotion: false },
  achievements: { unlocked: {}, progress: {} },
  games: {},
  records: {}, // empty → not meaningful → triggers 'pull'
};

const CLOUD_SAVE = { ...LOCAL_SAVE, records: { 'colony.bestDay': 42 } }; // meaningful

describe('CloudSync — suppressDirty reset after pull (Fix 1)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    mockGetFile.mockReturnValue(LOCAL_SAVE);
    mockGetProfile.mockReturnValue(BASE_PROFILE);
    mockImportAll.mockResolvedValue(CLOUD_SAVE);
    mockUpsertCloudSave.mockResolvedValue(undefined);

    // Cloud has meaningful data → decideSync returns 'pull'
    mockFetchCloudSave.mockResolvedValue({
      data: CLOUD_SAVE,
      schema_version: 1,
      updated_at: '2026-01-01T00:00:00.000Z',
      updated_device: null,
    });

    CloudSync.stop();
  });

  afterEach(() => {
    CloudSync.stop();
    vi.useRealTimers();
  });

  it('pushes the first save:dirty event after a cloud pull (flag is reset)', async () => {
    // Login → initialSync takes 'pull' → applyCloud sets suppressDirty=true
    // → startListening (the fix) resets it to false
    await CloudSync.onAuthChange('user-1');

    // First real edit after login
    appBus.emit('save:dirty', undefined);

    // Flush the 4 s push debounce
    await vi.advanceTimersByTimeAsync(5000);

    // Push must have fired — first edit was NOT suppressed
    expect(mockUpsertCloudSave).toHaveBeenCalled();
  });
});
