export type EvidenceKind = 'message' | 'log' | 'image' | 'note' | 'object';

export interface Evidence {
  id: string;
  title: string;
  kind: EvidenceKind;
  summary: string;
  content: string;
  relatedSuspectIds: string[];
  isFake: boolean;
}

export interface SuspectStatement {
  line: string;
  /** If set, this line is locked until the player has discovered that evidence. */
  requiresEvidenceId?: string;
}

export interface Suspect {
  id: string;
  name: string;
  role: string;
  alibi: string;
  motive?: string;
  /** Interrogation lines (DialogueSystem). Optional for backward compatibility. */
  statements?: SuspectStatement[];
}

/** Reference (correct) connection used by the DeductionSystem. */
export interface ConnectionRule {
  fromId: string;
  toId: string;
  relation: string;
}

export interface Question {
  id: string;
  text: string;
  options: { id: string; label: string }[];
  correctOptionId: string;
  weight: number;
}

/** A scripted, sandboxed terminal entry. Output is fixed data from the case —
 *  nothing is ever executed. This keeps the "terminal" a puzzle prop, not a tool. */
export interface TerminalCommand {
  cmd: string;
  output: string[];
}

export interface CaseSummary {
  id: string;
  title: string;
  tagline: string;
  difficulty: 'easy' | 'normal' | 'hard';
}

export interface DetectiveCase {
  id: string;
  title: string;
  tagline?: string;
  difficulty: 'easy' | 'normal' | 'hard';
  synopsis: string;
  intro: string[];
  evidence: Evidence[];
  suspects: Suspect[];
  questions: Question[];
  validConnections: ConnectionRule[];
  terminal: TerminalCommand[];
  solution: {
    culpritId: string;
    fakeEvidenceId: string;
    whatHappened: string;
  };
}

export interface PlayerConnection {
  fromId: string;
  toId: string;
}

export type CasePhase = 'intro' | 'investigate' | 'questions' | 'accuse' | 'result';

export interface CaseProgress {
  caseId: string;
  phase: CasePhase;
  discovered: string[];
  connections: PlayerConnection[];
  answers: Record<string, string>;
  accusation?: { culpritId: string; fakeEvidenceId: string };
  result?: DeductionResult;
}

export type Rank = 'F' | 'C' | 'B' | 'A' | 'S';

export interface DeductionResult {
  score: number;
  rank: Rank;
  correctConnections: number;
  totalConnections: number;
  correctAnswers: number;
  totalQuestions: number;
  foundFake: boolean;
  accusedCorrectly: boolean;
}
