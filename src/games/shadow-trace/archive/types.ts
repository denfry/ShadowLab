// src/games/shadow-trace/archive/types.ts
import type { MediaSpec } from './media-types';

// ---- references into the archive ----
export type FactRef =
  | { kind: 'record'; recordId: string }
  | { kind: 'recordClaim'; recordId: string; claimId?: string }
  | { kind: 'metadata'; recordId: string; field: string }
  | { kind: 'entity'; entityId: string };

// ---- authored case content ----
export type RecordSpan = { text: string } | { entityId: string; text: string };

export type RecordKind =
  | 'transcript'
  | 'chat'
  | 'letter'
  | 'report'
  | 'log'
  | 'note'
  | 'photo'
  | 'object';

export interface ArchiveRecord {
  id: string;
  kind: RecordKind;
  title: string;
  source?: string;
  timestamp?: string;
  body: RecordSpan[];
  mediaId?: string;
  metadata?: { time?: string; geo?: string; device?: string; exif?: Record<string, string> };
  /** Entity ids this record references (kept explicit for the validator/index). */
  mentions: string[];
  /** Reading this record (or inspecting its media hotspot) grants these keys. */
  grantsKeys?: string[];
  /** When present, the record is unreadable until `seal.keyId` is in the player's keys. */
  seal?: { keyId: string; hint: string };
}

export type EntityType = 'person' | 'place' | 'time' | 'object' | 'event' | 'org';

export interface Entity {
  id: string;
  type: EntityType;
  label: string;
  aliases?: string[];
  summary?: string;
  isSuspect?: boolean;
}

export interface KeyDef {
  id: string;
  label: string;
}

export interface Contradiction {
  id: string;
  between: [FactRef, FactRef];
  rule: 'time_overlap' | 'place_conflict' | 'mutual_exclusive' | 'authenticity';
  weight: number;
  revealHint?: string;
}

export type ArchiveCondition =
  | { accuse: string }
  | { decisiveLie: string }
  | { noticedContradiction: string }
  | { hasKey: string }
  | { all: ArchiveCondition[] }
  | { any: ArchiveCondition[] }
  | { not: ArchiveCondition };

export type EndingQuality = 'truth' | 'partial' | 'miscarriage' | 'cold_case';

export interface Ending {
  id: string;
  title: string;
  requires: ArchiveCondition;
  quality: EndingQuality;
  epilogue: string[];
  /** Persisted to the campaign layer (consumed in Этап A2). */
  campaignFlags?: string[];
}

export interface MediaAsset {
  id: string;
  media: MediaSpec;
}

export interface CaseArchive {
  id: string;
  title: string;
  difficulty: 'normal' | 'hard' | 'nightmare';
  synopsis: string;
  episodeOf?: string;
  seedRecordIds: string[];
  records: ArchiveRecord[];
  entities: Entity[];
  contradictions: Contradiction[];
  endings: Ending[];
  keysSchema: KeyDef[];
  media?: MediaAsset[];
}

// ---- runtime state ----
export interface ArchiveAccusation {
  culpritEntityId: string;
  decisiveLie?: [FactRef, FactRef];
}

export interface Suspicion {
  recordId: string;
  note?: string;
}

export interface ArchiveProgress {
  caseId: string;
  openRecords: string[];
  seenRecords: string[];
  discoveredEntities: string[];
  keys: string[];
  pinnedRecords: string[];
  pinnedEntities: string[];
  suspicions: Suspicion[];
  notes: string[];
  accusation?: ArchiveAccusation;
}

export type Rank = 'F' | 'C' | 'B' | 'A' | 'S';

export interface DeductionResultArchive {
  rank: Rank;
  score: number;
  decisiveLieCorrect: boolean;
  contradictionsNoticed: number;
  contradictionsTotal: number;
  sealsOpened: number;
  sealsTotal: number;
  emptySuspicions: number;
  accusationQuality: EndingQuality;
  flagsForCampaign: string[];
}
