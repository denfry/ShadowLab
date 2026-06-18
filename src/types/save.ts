export const SAVE_SCHEMA_VERSION = 2;

/** Storage backend abstraction — swap local -> IndexedDB -> cloud without
 *  touching games or SaveManager callers. */
export interface StorageAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  keys(prefix: string): Promise<string[]>;
}

export interface SettingsSave {
  audio: { master: number; music: number; sfx: number; muted: boolean };
  graphics: { quality: 'low' | 'med' | 'high'; particles: boolean };
  language: 'ru' | 'en';
  reducedMotion: boolean;
}

export interface ProfileSave {
  id: string;
  displayName: string;
  avatarId: string;
  createdAt: string;
  stats: {
    totalPlaytimeSec: number;
    gamesPlayed: Record<string, number>;
  };
  cloudLinked: boolean;
}

export interface AchievementSave {
  unlocked: Record<string, string>; // achievementId -> ISO unlock date
  progress: Record<string, number>; // achievementId -> current counter value
}

export interface GameSave {
  gameId: string;
  slot: number; // 0 = autosave, 1..N = manual
  version: number; // per-game payload schema version
  createdAt: string;
  updatedAt: string;
  label: string;
  thumbnail?: string;
  payload: unknown; // ColonyState | CaseProgress
}

export interface SaveFile {
  schemaVersion: number;
  profile: ProfileSave;
  settings: SettingsSave;
  achievements: AchievementSave;
  games: Record<string, GameSave[]>;
  /** Flat numeric records keyed by domain, e.g. 'colony.bestDay',
   *  'case.<id>.bestScore'. Added in schema v2. */
  records: Record<string, number>;
  exportedAt?: string;
}
