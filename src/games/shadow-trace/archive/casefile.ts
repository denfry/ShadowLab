import type { ArchiveProgress } from './types';

const addUnique = (arr: string[], v: string): string[] => (arr.includes(v) ? arr : [...arr, v]);

export function pinRecord(state: ArchiveProgress, recordId: string): ArchiveProgress {
  return { ...state, pinnedRecords: addUnique(state.pinnedRecords, recordId) };
}
export function unpinRecord(state: ArchiveProgress, recordId: string): ArchiveProgress {
  return { ...state, pinnedRecords: state.pinnedRecords.filter((id) => id !== recordId) };
}
export function pinEntity(state: ArchiveProgress, entityId: string): ArchiveProgress {
  return { ...state, pinnedEntities: addUnique(state.pinnedEntities, entityId) };
}
export function unpinEntity(state: ArchiveProgress, entityId: string): ArchiveProgress {
  return { ...state, pinnedEntities: state.pinnedEntities.filter((id) => id !== entityId) };
}
export function markSuspicion(state: ArchiveProgress, recordId: string, note?: string): ArchiveProgress {
  if (state.suspicions.some((s) => s.recordId === recordId)) return state;
  return { ...state, suspicions: [...state.suspicions, { recordId, ...(note ? { note } : {}) }] };
}
export function clearSuspicion(state: ArchiveProgress, recordId: string): ArchiveProgress {
  return { ...state, suspicions: state.suspicions.filter((s) => s.recordId !== recordId) };
}
export function addNote(state: ArchiveProgress, text: string): ArchiveProgress {
  return { ...state, notes: [...state.notes, text] };
}
