// ---- authored content ----
export type Trait = 'nosy' | 'trusting' | 'gossip' | 'loner' | 'sharp' | 'anxious' | 'loyal';
export type Exposure = 'public' | 'semi' | 'private';
export type Band = 'trust' | 'wary' | 'cold' | 'accusing';

export interface Location {
  id: string;
  name: string;
  exposure: Exposure;
  objectiveStepIds?: string[];
}

export interface WeightedLoc {
  locationId: string;
  weight: number;
}

export interface NPC {
  id: string;
  name: string;
  role: string;
  traits: Trait[];
  routine: Record<number, WeightedLoc[]>; // slotIndex -> weighted candidate locations
  relationships: { npcId: string; bond: number }[]; // -100..100
  watchfulness: number; // 0..1
  readStyle: string; // -> CueSet.readStyle
}

export interface ObjectiveStep {
  id: string;
  label: string;
  locationId: string;
  baseRisk: number; // 0..1
  requires?: string[];
  leavesTrace?: { severity: number; discoverableBy?: 'sharp' | 'nosy' | 'any' };
}
export interface Objective {
  id: string;
  title: string;
  steps: ObjectiveStep[];
}

export interface Cue {
  channel: 'dialogue' | 'tell' | 'meeting';
  text: string;
  traitGate?: Trait;
}
export interface CueSet {
  readStyle: string;
  bands: Record<Band, Cue[]>;
}

export interface Tuning {
  suspicionGain: number;
  gossipStrength: number;
  detectionMult: number;
  paranoiaEscalation: number;
  composureCost: number;
  composureRegen: number;
}

export interface Station {
  id: string;
  title: string;
  synopsis: string;
  difficulty: 'calm' | 'tense' | 'paranoid';
  days: number;
  slotsPerDay: number;
  locations: Location[];
  crew: NPC[];
  objectives: Objective[]; // pool; one chosen per run
  cueLibrary: CueSet[];
  tuning: Tuning;
  startSuspicion: number;
}

// ---- runtime state ----
export interface Observation {
  day: number;
  slot: number;
  locationId: string;
  subjectId: string;
  kind: 'present' | 'odd_action' | 'anomaly_found';
}
export interface CrewMemberState {
  npcId: string;
  alive: boolean;
  suspicion: Record<string, number>; // toward each other crew + PLAYER_ID; hidden from player
  observations: Observation[];
}
export interface Anomaly {
  id: string;
  fromStepId?: string;
  locationId: string;
  day: number;
  slot: number;
  severity: number;
  discoveredBy?: string;
  plantedAgainst?: string; // framing: discovery attributes suspicion here
}
export interface AlibiRecord {
  day: number;
  slot: number;
  locationId: string;
  witnessIds: string[];
}
export interface NotebookEntry {
  npcId: string;
  learnedSlots: number[]; // routine slots the player has learned
}
export interface PlayerState {
  composure: number; // 0..100
  objectiveProgress: string[]; // completed step ids
  alibis: AlibiRecord[];
  notebook: NotebookEntry[];
}

export type Phase = 'plan' | 'resolve' | 'meeting' | 'result';

export interface GameState {
  station: Station;
  day: number;
  slot: number;
  phase: Phase;
  crew: CrewMemberState[];
  player: PlayerState;
  anomalies: Anomaly[];
  objectiveId: string;
  seed: number; // original, for reference/replay
  rngState: number; // advancing mulberry32 state
}

export type PlayerAction =
  | { kind: 'blend'; locationId: string }
  | { kind: 'objective'; stepId: string }
  | { kind: 'talk'; npcId: string; tack: 'reassure' | 'seed' | 'fish'; targetId?: string }
  | { kind: 'observe'; locationId: string; mode: 'routine' | 'witness' | 'plant'; targetId?: string };

export type Speech =
  | { kind: 'alibi'; slotRef: { day: number; slot: number } }
  | { kind: 'accuse'; targetId: string }
  | { kind: 'sow_doubt' }
  | { kind: 'quiet' };

// ---- shared constants ----
export const PLAYER_ID = 'player';
export const EXPOSURE_FACTOR: Record<Exposure, number> = { public: 1, semi: 0.6, private: 0.25 };
export const BAND_WARY = 20;
export const BAND_COLD = 45;
export const BAND_ACCUSING = 70;
export const EXPOSURE_MED = 30;
export const EXPOSURE_HIGH = 60;
