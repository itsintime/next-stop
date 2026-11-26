export type Field =
  | 'graduation'
  | 'education'
  | 'enrollment'
  | 'major'
  | 'days'
  | 'duration'
  | 'skill'
  | 'task'
  | 'duty';
export type Requirement = 'required' | 'preferred' | 'duty' | 'info';
export type SqlType = 'basic' | 'dedupe' | 'join' | 'retention' | 'broad' | 'unsupported';
export type ExtractionState = 'ok' | 'failed' | 'pending';
export type PracticeStatus = 'not_started' | 'attempted' | 'passed';

export type SqlTask = 'basic' | 'dedupe' | 'join';
export type SelfLevel = 'none' | 'aware' | 'independent' | '';
export type CapabilityKind = 'sql' | 'excel' | 'skill';
export type CapabilityRole = 'task' | 'tool' | 'sql' | 'general';

export interface CapabilityRequirement {
  key: string;
  label: string;
  kind: CapabilityKind;
  role: CapabilityRole;
  requirement: Requirement;
  quote: string;
  itemId: string;
  sqlTask?: SqlTask;
  questionId?: QuestionId;
  uncertain?: boolean;
  toolSet?: boolean;
  answer: SelfLevel;
}

export interface CapabilityAnswer {
  level: SelfLevel;
  updatedAt: string;
}

export interface Profile {
  graduation: string;
  days: string;
  duration: string;
  sql: Record<SqlTask, SelfLevel>;
}

export interface FavoriteEntry {
  note: string;
  savedAt: string;
}

export type FitStatus = 'meet' | 'unmet' | 'unknown' | 'bonus' | 'info';
export type FitGroup = 'hard' | 'skill' | 'bonus' | 'info';

export interface ExerciseMatch {
  state: 'linked' | 'none' | 'not_applicable';
  label: string;
  note?: string;
}

export interface FitResult {
  id: string;
  label: string;
  requirement: string;
  profileValue: string;
  verdict: string;
  status: FitStatus;
  reason: string;
  group: FitGroup;
  itemId?: string;
  sqlTask?: SqlTask;
  questionId?: QuestionId;
  quote?: string;
  exercise?: ExerciseMatch;
  evidenceSource?: 'resume' | 'user' | 'none';
  supplement?: {
    kind: 'days' | 'duration' | 'text';
    value: string;
  };
}

export interface FitEvaluation {
  resumeBased?: boolean;
  results: FitResult[];
  capabilities: CapabilityRequirement[];
  headline: string;
  unmet: FitResult[];
  weakSkills: FitResult[];
  unknown: FitResult[];
  bonus: FitResult[];
  profileFilled: boolean;
  hasSqlRequirement: boolean;
}

export interface ExtractedItem {
  id: string;
  field: Field;
  value: string;
  detail?: string;
  requirement: Requirement;
  qualifier?: string;
  quote: string;
  sqlType?: SqlType;
  taskKey?: string;
  alternatives?: string[];
  manual: boolean;
  uncertain?: boolean;
  source: 'auto' | 'manual' | 'sample';
}

export interface Job {
  id: string;
  name: string;
  link?: string;
  rawText: string;
  extraction: ExtractionState;
  extractionError?: string;
  items: ExtractedItem[];
  isSample?: boolean;
  needsReverify?: boolean;
}

export type QuestionId = 1 | 2 | 3;

export interface PracticeRecord {
  jobId: string;
  questionId: QuestionId;
  status: Exclude<PracticeStatus, 'not_started'>;
  attempts: number;
  lastSql: string;
  lastOutcome: 'passed' | 'mismatch' | 'error' | 'timeout';
  updatedAt: string;
}

export type Phase = 'landing' | 'input' | 'analysis' | 'favorites' | 'profile';

export interface PersistedState {
  version: 3;
  jobs: Job[];
  currentJobId: string | null;
  favorites: Record<string, FavoriteEntry>;
  practice: Record<string, PracticeRecord>;
  profile: Profile;
  capabilityAnswers: Record<string, CapabilityAnswer>;
}

export interface EventRow {
  event_id: number;
  event_name: string;
  city: string | null;
}

export interface SignupRow {
  signup_id: number;
  event_id: number;
  student_id: number | null;
}

export interface Dataset {
  id: string;
  label: string;
  kind: 'public' | 'grading';
  events: EventRow[];
  signups: SignupRow[];
}

export interface Question {
  id: QuestionId;
  title: string;
  shortTitle: string;
  typeLabel: string;
  difficulty: '入门' | '中等' | '进阶';
  goal: string[];
  outputColumns: string[];
  publicDataset: Dataset;
  gradingDatasets: Dataset[];
  expected: Record<string, unknown[][]>;
  hints: string[];
}

export interface Scenario {
  id: string;
  title: string;
  typeLabel: string;
  discipline: string;
  difficulty: '入门' | '中等' | '进阶';
  taskTags: string[];
  prompt: string;
  referencePoints: string[];
  evaluationPoints: string[];
  followUps: string[];
  selfCheck: string[];
  sourceNote: string;
}

export interface DiffRow {
  key: string;
  expected: string;
  actual: string;
  note?: string;
}

export interface DatasetResult {
  datasetId: string;
  datasetLabel: string;
  kind: 'public' | 'grading';
  state: 'match' | 'mismatch' | 'error';
  error?: string;
  actualRows?: unknown[][];
  diff?: DiffRow[];
  note?: string;
}

export type GradeOutcome = 'passed' | 'mismatch' | 'error' | 'timeout' | 'rejected';

export interface GradeReport {
  outcome: GradeOutcome;
  results: DatasetResult[];
  message: string;
  details: string[];
  hints: string[];
}
