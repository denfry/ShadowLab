import type {
  AchievementSave,
  GameSave,
  ProfileSave,
  SaveFile,
  SettingsSave,
  StorageAdapter,
} from '@/types/save';
import { nowIso } from '@/core/utils';
import { appBus } from '@/core/events/appBus';
import { LocalStorageAdapter } from './adapters/LocalStorageAdapter';
import { defaultSaveFile } from './defaults';
import { migrateSaveFile } from './migrations';

const ROOT_KEY = 'denfry.save.v1';
const BACKUP_KEY = 'denfry.save.backup';
const AUTOSAVE_SLOT = 0;
const AUTOSAVE_DEBOUNCE = 2500;

/**
 * Facade over a StorageAdapter. The single source of truth for profile,
 * settings, achievements and per-game slots. Games only ever touch a scoped
 * GameSaveApi (see PortalBridge), never this class directly.
 */
class SaveManagerImpl {
  private adapter: StorageAdapter = new LocalStorageAdapter();
  private file: SaveFile = defaultSaveFile();
  private ready = false;
  private autosaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private pendingAutosave = new Map<string, GameSave>();

  async init(): Promise<SaveFile> {
    if (this.ready) return this.file;
    const stored = await this.adapter.get<SaveFile>(ROOT_KEY);
    if (stored) {
      // Keep a backup of the raw stored file before any migration overwrites it.
      await this.adapter.set(BACKUP_KEY, stored);
    }
    this.file = migrateSaveFile(stored);
    this.ready = true;
    await this.persist();
    return this.file;
  }

  private async persist(): Promise<void> {
    await this.adapter.set(ROOT_KEY, this.file);
    appBus.emit('save:dirty', undefined);
  }

  getFile(): SaveFile {
    return this.file;
  }

  // ---- profile -------------------------------------------------------------
  getProfile(): ProfileSave {
    return this.file.profile;
  }

  async setProfile(patch: Partial<ProfileSave>): Promise<void> {
    this.file.profile = { ...this.file.profile, ...patch };
    await this.persist();
  }

  async addPlaytime(gameId: string, seconds: number): Promise<void> {
    const stats = this.file.profile.stats;
    stats.totalPlaytimeSec += seconds;
    stats.gamesPlayed[gameId] = (stats.gamesPlayed[gameId] ?? 0) + 1;
    await this.persist();
  }

  // ---- settings ------------------------------------------------------------
  getSettings(): SettingsSave {
    return this.file.settings;
  }

  async setSettings(next: SettingsSave): Promise<void> {
    this.file.settings = next;
    await this.persist();
  }

  // ---- achievements --------------------------------------------------------
  getAchievements(): AchievementSave {
    return this.file.achievements;
  }

  async setAchievements(next: AchievementSave): Promise<void> {
    this.file.achievements = next;
    await this.persist();
  }

  // ---- records (bests / counters) -----------------------------------------
  getRecords(): Record<string, number> {
    return this.file.records;
  }

  getRecord(key: string): number {
    return this.file.records[key] ?? 0;
  }

  setRecord(key: string, value: number, mode: 'max' | 'set' | 'inc' = 'max'): void {
    const current = this.file.records[key] ?? 0;
    const next = mode === 'max' ? Math.max(current, value) : mode === 'inc' ? current + value : value;
    if (next === current && key in this.file.records) return;
    this.file.records[key] = next;
    void this.persist();
  }

  // ---- game slots ----------------------------------------------------------
  listSlots(gameId: string): GameSave[] {
    return [...(this.file.games[gameId] ?? [])].sort((a, b) => a.slot - b.slot);
  }

  getSlot(gameId: string, slot: number): GameSave | null {
    return this.file.games[gameId]?.find((s) => s.slot === slot) ?? null;
  }

  lastPlayed(gameId: string): GameSave | null {
    const slots = this.file.games[gameId] ?? [];
    if (!slots.length) return null;
    return [...slots].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  }

  async saveSlot(save: GameSave): Promise<void> {
    const list = this.file.games[save.gameId] ?? [];
    const idx = list.findIndex((s) => s.slot === save.slot);
    const stamped: GameSave = {
      ...save,
      createdAt: idx >= 0 ? list[idx].createdAt : save.createdAt || nowIso(),
      updatedAt: nowIso(),
    };
    if (idx >= 0) list[idx] = stamped;
    else list.push(stamped);
    this.file.games[save.gameId] = list;
    await this.persist();
    appBus.emit('save:written', { gameId: save.gameId, slot: save.slot });
  }

  async removeSlot(gameId: string, slot: number): Promise<void> {
    const list = this.file.games[gameId] ?? [];
    this.file.games[gameId] = list.filter((s) => s.slot !== slot);
    await this.persist();
  }

  /** Debounced autosave into slot 0 for a given game. */
  autosave(gameId: string, version: number, payload: unknown, label: string): void {
    const save: GameSave = {
      gameId,
      slot: AUTOSAVE_SLOT,
      version,
      label,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      payload,
    };
    this.pendingAutosave.set(gameId, save);
    const existing = this.autosaveTimers.get(gameId);
    if (existing) clearTimeout(existing);
    this.autosaveTimers.set(
      gameId,
      setTimeout(() => void this.flushAutosave(gameId), AUTOSAVE_DEBOUNCE),
    );
  }

  async flushAutosave(gameId: string): Promise<void> {
    const timer = this.autosaveTimers.get(gameId);
    if (timer) clearTimeout(timer);
    this.autosaveTimers.delete(gameId);
    const pending = this.pendingAutosave.get(gameId);
    if (pending) {
      this.pendingAutosave.delete(gameId);
      await this.saveSlot(pending);
    }
  }

  // ---- export / import -----------------------------------------------------
  exportAll(): SaveFile {
    return { ...structuredCloneSafe(this.file), exportedAt: nowIso() };
  }

  async importAll(raw: unknown): Promise<SaveFile> {
    const migrated = migrateSaveFile(raw);
    this.file = migrated;
    await this.persist();
    return this.file;
  }

  async wipeAll(): Promise<void> {
    this.file = defaultSaveFile();
    await this.persist();
  }
}

function structuredCloneSafe<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

export const SaveManager = new SaveManagerImpl();
export type { SaveManagerImpl };
