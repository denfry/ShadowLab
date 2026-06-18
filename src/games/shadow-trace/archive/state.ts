import type { CaseArchive, ArchiveProgress, ArchiveAccusation } from './types';

const addUnique = (arr: string[], v: string): string[] => (arr.includes(v) ? arr : [...arr, v]);
const addAllUnique = (arr: string[], vs: string[] | undefined): string[] => {
  let out = arr;
  for (const v of vs ?? []) out = addUnique(out, v);
  return out;
};

/** A record is reachable if it is a seed or it mentions an already-discovered entity. */
function isReachable(caseData: CaseArchive, state: ArchiveProgress, recordId: string): boolean {
  if (caseData.seedRecordIds.includes(recordId)) return true;
  const rec = caseData.records.find((r) => r.id === recordId);
  if (!rec) return false;
  return rec.mentions.some((m) => state.discoveredEntities.includes(m));
}

/** Records readable right now: reachable AND (unsealed OR their key is held). */
function recomputeOpen(caseData: CaseArchive, state: ArchiveProgress): string[] {
  return caseData.records
    .filter((r) => isReachable(caseData, state, r.id))
    .filter((r) => !r.seal || state.keys.includes(r.seal.keyId))
    .map((r) => r.id);
}

export function createArchiveProgress(caseData: CaseArchive): ArchiveProgress {
  const seedRecords = caseData.records.filter((r) => caseData.seedRecordIds.includes(r.id));
  let discoveredEntities: string[] = [];
  let keys: string[] = [];
  for (const r of seedRecords) {
    discoveredEntities = addAllUnique(discoveredEntities, r.mentions);
    keys = addAllUnique(keys, r.grantsKeys);
  }
  const base: ArchiveProgress = {
    caseId: caseData.id,
    openRecords: [],
    seenRecords: [],
    discoveredEntities,
    keys,
    pinnedRecords: [],
    pinnedEntities: [],
    suspicions: [],
    notes: [],
  };
  return { ...base, openRecords: recomputeOpen(caseData, base) };
}

/** Read a reachable, unsealed record: mark seen, discover its entities, grant its keys. */
export function openRecord(caseData: CaseArchive, state: ArchiveProgress, recordId: string): ArchiveProgress {
  const rec = caseData.records.find((r) => r.id === recordId);
  if (!rec) return state;
  if (!isReachable(caseData, state, recordId)) return state;
  if (rec.seal && !state.keys.includes(rec.seal.keyId)) return state;
  const next: ArchiveProgress = {
    ...state,
    seenRecords: addUnique(state.seenRecords, recordId),
    discoveredEntities: addAllUnique(state.discoveredEntities, rec.mentions),
    keys: addAllUnique(state.keys, rec.grantsKeys),
  };
  return { ...next, openRecords: recomputeOpen(caseData, next) };
}

/** Grant a key from any source (e.g. a media hotspot in the UI); unseals matching records. */
export function grantKey(caseData: CaseArchive, state: ArchiveProgress, keyId: string): ArchiveProgress {
  if (state.keys.includes(keyId)) return state;
  const next: ArchiveProgress = { ...state, keys: [...state.keys, keyId] };
  return { ...next, openRecords: recomputeOpen(caseData, next) };
}

/** Record the player's final accusation. */
export function accuse(state: ArchiveProgress, accusation: ArchiveAccusation): ArchiveProgress {
  return { ...state, accusation };
}
