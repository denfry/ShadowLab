import type { CaseArchive, ArchiveProgress, ArchiveRecord, Entity, EntityType } from './types';
import type { MediaSpec } from './media-types';

export interface ResolvedSpan {
  text: string;
  /** Present → render as a clickable entity link. */
  entity?: Entity;
}
export interface RecordView {
  record: ArchiveRecord;
  spans: ResolvedSpan[];
  media?: MediaSpec;
  sealed: boolean;
  sealHint?: string;
}
export interface EntityRecordRef {
  record: ArchiveRecord;
  sealed: boolean;
}
export interface EntityPage {
  entity: Entity;
  records: EntityRecordRef[];
  relatedEntities: Entity[];
}
export interface IndexGroup {
  type: EntityType;
  entities: { entity: Entity; recordCount: number }[];
}
export interface CaseFileView {
  pinnedRecords: ArchiveRecord[];
  pinnedEntities: Entity[];
  suspicions: { record: ArchiveRecord; note?: string }[];
  notes: string[];
}

const findRecord = (caseData: CaseArchive, id: string): ArchiveRecord | undefined =>
  caseData.records.find((r) => r.id === id);
const findEntity = (caseData: CaseArchive, id: string): Entity | undefined =>
  caseData.entities.find((e) => e.id === id);
const isSealedFor = (state: ArchiveProgress, record: ArchiveRecord): boolean =>
  Boolean(record.seal) && !state.keys.includes(record.seal!.keyId);
const mediaById = (caseData: CaseArchive, mediaId: string): MediaSpec | undefined =>
  (caseData.media ?? []).find((m) => m.id === mediaId)?.media;

const ENTITY_TYPE_ORDER: EntityType[] = ['person', 'place', 'time', 'object', 'event', 'org'];

export function getRecordView(
  caseData: CaseArchive,
  state: ArchiveProgress,
  recordId: string,
): RecordView | null {
  const record = findRecord(caseData, recordId);
  if (!record) return null;
  const sealed = isSealedFor(state, record);
  if (sealed) {
    return { record, spans: [], media: undefined, sealed: true, sealHint: record.seal?.hint };
  }
  const spans: ResolvedSpan[] = record.body.map((s) =>
    'entityId' in s ? { text: s.text, entity: findEntity(caseData, s.entityId) } : { text: s.text },
  );
  const media = record.mediaId ? mediaById(caseData, record.mediaId) : undefined;
  return { record, spans, media, sealed: false };
}

export function getEntityPage(
  caseData: CaseArchive,
  state: ArchiveProgress,
  entityId: string,
): EntityPage | null {
  const entity = findEntity(caseData, entityId);
  if (!entity) return null;
  if (!state.discoveredEntities.includes(entityId)) return null;

  const records: EntityRecordRef[] = caseData.records
    .filter((r) => r.mentions.includes(entityId))
    .map((record) => ({ record, sealed: isSealedFor(state, record) }));

  const related = new Set<string>();
  for (const ref of records) {
    for (const m of ref.record.mentions) {
      if (m !== entityId && state.discoveredEntities.includes(m)) related.add(m);
    }
  }
  const relatedEntities = [...related]
    .map((id) => findEntity(caseData, id))
    .filter((e): e is Entity => Boolean(e));

  return { entity, records, relatedEntities };
}

export function getDiscoveredIndex(caseData: CaseArchive, state: ArchiveProgress): IndexGroup[] {
  const recordCount = (entityId: string): number =>
    caseData.records.filter((r) => r.mentions.includes(entityId)).length;

  return ENTITY_TYPE_ORDER.map((type) => ({
    type,
    entities: caseData.entities
      .filter((e) => e.type === type && state.discoveredEntities.includes(e.id))
      .map((entity) => ({ entity, recordCount: recordCount(entity.id) })),
  })).filter((g) => g.entities.length > 0);
}

export function getCaseFile(caseData: CaseArchive, state: ArchiveProgress): CaseFileView {
  return {
    pinnedRecords: state.pinnedRecords
      .map((id) => findRecord(caseData, id))
      .filter((r): r is ArchiveRecord => Boolean(r)),
    pinnedEntities: state.pinnedEntities
      .map((id) => findEntity(caseData, id))
      .filter((e): e is Entity => Boolean(e)),
    suspicions: state.suspicions.flatMap((s) => {
      const record = findRecord(caseData, s.recordId);
      return record ? [{ record, note: s.note }] : [];
    }),
    notes: [...state.notes],
  };
}

export function getAccusableSuspects(caseData: CaseArchive, state: ArchiveProgress): Entity[] {
  return caseData.entities.filter(
    (e) => e.type === 'person' && e.isSuspect && state.discoveredEntities.includes(e.id),
  );
}
