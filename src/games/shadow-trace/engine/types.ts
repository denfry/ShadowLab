import type { MediaSpec } from './media-types';

// ---- branching primitives ----
export type Condition =
  | { hasEvidence: string }
  | { hasFlag: string }
  | { foundContradiction: string }
  | { accuse: string }
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition };

export interface Effect {
  setFlag?: string;
  addNode?: string;
  lockNode?: string;
  addEvidence?: string;
  addStatement?: string;
}
export type Grant = Effect;

export type FactRef = { type: 'statement' | 'evidence' | 'metadata'; refId: string };
/** Forward-use: consumed by the dossier `Fact.time` model added in Этап 1 (UI layer). */
export type TimeSpan = { start?: string; end?: string };

// ---- authored case content ----
export interface Choice {
  id: string;
  label: string;
  requires?: Condition;
  effects: Effect[];
}

export interface LeadNode {
  id: string;
  type: 'location' | 'interrogation' | 'analysis' | 'cutscene';
  title: string;
  requires?: Condition;
  body: string[];
  choices?: Choice[];
  grants?: Grant[];
  oneShot?: boolean;
}

export interface Evidence {
  id: string;
  title: string;
  kind: 'message' | 'log' | 'document' | 'photo' | 'video' | 'object';
  summary: string;
  content?: string;
  media?: MediaSpec;
  metadata?: { time?: string; geo?: string; device?: string; exif?: Record<string, string> };
  relatedSuspectIds: string[];
  authenticity: 'real' | 'fake';
  revealsStatementIds?: string[];
}

/** Machine-readable form of a statement's claim, used by later contradiction tooling. */
export interface StatementAssert {
  subjectId: string;
  place?: string;
  timeStart?: string;
  timeEnd?: string;
  action?: string;
}

export interface Statement {
  id: string;
  speakerId: string;
  claim: string;
  asserts: StatementAssert;
}

export interface Contradiction {
  id: string;
  between: [FactRef, FactRef];
  rule: 'time_overlap' | 'place_conflict' | 'mutual_exclusive' | 'authenticity';
  unlocks?: Grant[];
  weight: number;
}

export interface Suspect {
  id: string;
  name: string;
  role: string;
  alibi: string;
  motive?: string;
  truthProfile?: { wasAt?: string; at?: string; didAction?: string };
}

export type EndingQuality = 'truth' | 'partial' | 'miscarriage' | 'cold_case';

export interface Ending {
  id: string;
  title: string;
  requires: Condition;
  quality: EndingQuality;
  epilogue: string[];
  campaignEffects?: Effect[];
}

export interface FlagDef {
  id: string;
  description?: string;
}

export interface CaseV2 {
  id: string;
  title: string;
  difficulty: 'normal' | 'hard' | 'nightmare';
  synopsis: string;
  episodeOf?: string;
  startNodeIds: string[];
  nodes: LeadNode[];
  suspects: Suspect[];
  evidence: Evidence[];
  statements: Statement[];
  contradictions: Contradiction[];
  endings: Ending[];
  flagsSchema: FlagDef[];
}

// ---- runtime state ----
export interface PlayerLink {
  fromRef: FactRef;
  toRef: FactRef;
  relation: 'supports' | 'contradicts' | 'explains';
}

export interface Accusation {
  culpritId: string;
  method?: string;
  fakeEvidenceIds: string[];
  motiveId?: string;
  keyContradictionIds: string[];
}

export interface CaseProgressV2 {
  caseId: string;
  openNodes: string[];
  visitedNodes: string[];
  inspectedHotspots: string[];
  discoveredEvidence: string[];
  discoveredStatements: string[];
  flags: Record<string, boolean | number | string>;
  foundContradictions: string[];
  links: PlayerLink[];
  notes: string[];
  choicesMade: Record<string, string>;
  accusation?: Accusation;
}

export type Rank = 'F' | 'C' | 'B' | 'A' | 'S';

export interface DeductionResultV2 {
  rank: Rank;
  score: number;
  contradictionsFound: number;
  contradictionsTotal: number;
  correctLinks: number;
  falseLinks: number;
  fakesIdentified: number;
  fakesTotal: number;
  accusationQuality: EndingQuality;
  flagsForCampaign: string[];
}

/** A derived dossier card: one atomic fact the player has learned. Its `source`
 *  doubles as a FactRef the board's addLink consumes. */
export interface Fact {
  id: string;
  source: { type: 'evidence' | 'statement' | 'hotspot' | 'metadata'; refId: string };
  text: string;
  subjectIds: string[];
  time?: TimeSpan;
  place?: string;
}

// ---- campaign (type-only; consumers arrive in Этап 3) ----
export interface ConsequenceRecord {
  episodeId: string;
  type: 'jailed' | 'freed' | 'died' | 'allied' | 'betrayed';
  subjectId: string;
}

export interface CampaignState {
  campaignId: string;
  flags: Record<string, boolean | number | string>;
  reputation: { press: number; police: number; underworld: number };
  ledger: ConsequenceRecord[];
  retainedEvidence: string[];
  knownCharacters: string[];
}

export interface EpisodeRef {
  id: string;
  caseId: string;
  requires?: Condition;
  nextOptions: { episodeId: string; requires?: Condition }[];
}

export interface Campaign {
  id: string;
  title: string;
  episodes: EpisodeRef[];
  startEpisodeId: string;
}
