import { SAVE_SCHEMA_VERSION, type SaveFile } from '@/types/save';
import { defaultSaveFile } from './defaults';

type Migration = (file: any) => any;

/** Ordered migrations keyed by the version they upgrade FROM.
 *  Add an entry whenever SAVE_SCHEMA_VERSION is bumped. */
const MIGRATIONS: Record<number, Migration> = {
  // v1 -> v2: introduce the flat records store.
  1: (file) => ({ ...file, schemaVersion: 2, records: file.records ?? {} }),
};

/** Bring any stored SaveFile up to the current schema, defensively. Unknown or
 *  corrupt shapes fall back to defaults rather than crashing the app. */
export function migrateSaveFile(raw: unknown): SaveFile {
  if (!raw || typeof raw !== 'object') return defaultSaveFile();

  let file = raw as SaveFile;
  let version = typeof file.schemaVersion === 'number' ? file.schemaVersion : 0;

  while (version < SAVE_SCHEMA_VERSION) {
    const migrate = MIGRATIONS[version];
    if (!migrate) {
      // No path defined — start clean but preserve a backup elsewhere.
      return { ...defaultSaveFile(), schemaVersion: SAVE_SCHEMA_VERSION };
    }
    file = migrate(file);
    version += 1;
  }

  // Merge against defaults so missing top-level keys are always present.
  const base = defaultSaveFile();
  return {
    ...base,
    ...file,
    schemaVersion: SAVE_SCHEMA_VERSION,
    profile: { ...base.profile, ...file.profile },
    settings: { ...base.settings, ...file.settings },
    achievements: { ...base.achievements, ...file.achievements },
    games: { ...file.games },
    records: { ...base.records, ...file.records },
  };
}
