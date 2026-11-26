import type { Job, Profile, Scenario } from '../../src/types';
import { extractItems } from '../../src/extract/extract';
import { evaluateJob } from '../../src/fit';
import { matchResume } from '../resume-match';
import { recommendForJob, type Recommendation } from '../../src/recommend';
import {
  ALL_TASKS,
  APPROVED_SCENARIOS,
  APPROVED_TASKS,
  BUILT_IN_SCENARIOS,
  BUILT_IN_TASKS,
  SCENARIO_BANK,
  scenarioForCapability,
  type TaskDefinition,
} from '../practice-bank';

export type AdminQuestionStatus = 'draft' | 'approved' | 'withdrawn';

export interface AdminQuestion extends Scenario {
  status: AdminQuestionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AdminState {
  version: 1;
  tasks: TaskDefinition[];
  questions: AdminQuestion[];
}

export type PreviewStatus = 'new' | 'duplicate' | 'fix';

export interface ImportPreviewRow {
  line: number;
  id: string;
  title: string;
  status: PreviewStatus;
  reason: string;
  scenario?: AdminQuestion;
}

export interface ImportPreview {
  rows: ImportPreviewRow[];
  validCount: number;
  error?: string;
}

export interface TrialRecognizedTask {
  id: string;
  label: string;
  quote: string;
  scenarioTitle?: string;
}

export interface TrialResult {
  scope: 'official' | 'draft';
  recognized: TrialRecognizedTask[];
  recommendation: Recommendation;
  recommendationTitle: string;
  requirement: string;
  reason: string;
  none: boolean;
}

export interface ExportBaseline {
  tasks: TaskDefinition[];
  scenarios: Scenario[];
}

export interface ExportResult {
  json: string;
  preservedCount: number;
  addedCount: number;
  totalCount: number;
  taskCount: number;
  error?: string;
}

export const ADMIN_STORAGE_KEY = 'jd-assistant:practice-admin:v1';
export const EXPORT_PATH = 'mode/practice-bank/data/approved-bank.json';
export const EXPORT_BUILD_COMMAND = 'npm run build';

const EMPTY_PROFILE: Profile = {
  graduation: '',
  days: '',
  duration: '',
  sql: { basic: '', dedupe: '', join: '' },
};

export const SAMPLE_TASKS: TaskDefinition[] = [
  {
    id: 'task:sensor-debug',
    name: '传感器联调',
    directions: ['电子信息', '物联网'],
    patterns: ['传感器联调', '传感器调试', '传感器.*联调'],
    source: '原创电子信息样例',
  },
  {
    id: 'task:firmware-offline',
    name: '固件升级后掉线排查',
    directions: ['电子信息', '嵌入式'],
    patterns: ['固件升级.{0,20}掉线', '设备间歇性掉线'],
    source: '原创电子信息样例',
  },
];

export const TEMPLATE_CSV = `题目 ID,标题,任务 ID,难度,题干,评价要点,来源说明
sensor-debug-demo,传感器联调排查,task:sensor-debug,中等,设备在联调时需要确认多个传感器的读数与采集配置。你会如何定位并验证联调问题？,先核对供电与接线|检查采样配置与校准|复现并记录异常条件|给出验证步骤,原创电子信息场景，用于本地题库验收。
firmware-offline-sample,固件升级掉线排查,task:firmware-offline,中等,设备升级固件后间歇性掉线。你会如何复现、收集日志并判断是固件、网络还是供电问题？,先确认版本与回滚条件|收集日志和网络状态|按设备批次与环境分组|给出验证和修复方案,原创电子信息场景，用于本地题库验收。`;

export const DEMO_CSV = `${TEMPLATE_CSV}
sensor-debug-demo,传感器联调排查,task:sensor-debug,中等,设备在联调时需要确认多个传感器的读数与采集配置。你会如何定位并验证联调问题？,先核对供电与接线|检查采样配置与校准|复现并记录异常条件|给出验证步骤,重复样例。
firmware-offline-missing,固件升级掉线排查,task:firmware-offline,中等,设备升级固件后间歇性掉线。, ,缺少评价要点的样例。`;

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function isTaskDefinition(value: unknown): value is TaskDefinition {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<TaskDefinition>;
  return (
    typeof item.id === 'string' &&
    item.id.startsWith('task:') &&
    typeof item.name === 'string' &&
    Array.isArray(item.patterns) &&
    Array.isArray(item.directions) &&
    typeof item.source === 'string'
  );
}

function isAdminQuestion(value: unknown): value is AdminQuestion {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<AdminQuestion>;
  return (
    typeof item.id === 'string' &&
    typeof item.title === 'string' &&
    typeof item.prompt === 'string' &&
    ['draft', 'approved', 'withdrawn'].includes(item.status ?? '') &&
    Array.isArray(item.taskTags) &&
    Array.isArray(item.evaluationPoints)
  );
}

export function loadAdminState(): AdminState {
  try {
    const raw = globalThis.localStorage?.getItem(ADMIN_STORAGE_KEY);
    if (!raw) return { version: 1, tasks: [], questions: [] };
    const parsed = JSON.parse(raw) as Partial<AdminState>;
    return {
      version: 1,
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks.filter(isTaskDefinition) : [],
      questions: Array.isArray(parsed.questions) ? parsed.questions.filter(isAdminQuestion) : [],
    };
  } catch {
    return { version: 1, tasks: [], questions: [] };
  }
}

export function saveAdminState(state: AdminState): boolean {
  try {
    globalThis.localStorage?.setItem(ADMIN_STORAGE_KEY, JSON.stringify(state));
    return Boolean(globalThis.localStorage);
  } catch {
    return false;
  }
}

export function allTasksWithAdmin(state: AdminState): TaskDefinition[] {
  const ids = new Set<string>();
  return [...ALL_TASKS, ...state.tasks].filter((task) => {
    if (ids.has(task.id)) return false;
    ids.add(task.id);
    return true;
  });
}

export function allDirections(state: AdminState): string[] {
  return [...new Set(allTasksWithAdmin(state).flatMap((task) => task.directions))].sort();
}

export function questionsForTask(state: AdminState, taskId: string): Scenario[] {
  return [...SCENARIO_BANK, ...state.questions].filter((question) => question.taskTags.includes(taskId));
}

function normalizeTaskId(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith('task:') ? trimmed : `task:${trimmed}`;
}

export function createTaskDraft(
  state: AdminState,
  input: { id: string; name: string; directions: string; patterns: string; source: string },
): { state: AdminState; task?: TaskDefinition; error?: string } {
  const id = normalizeTaskId(input.id);
  if (!/^task:[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id)) {
    return { state, error: '任务 ID 需为 task: 开头，后接字母、数字、下划线或短横线。' };
  }
  if (allTasksWithAdmin(state).some((task) => task.id === id)) {
    return { state, error: '任务 ID 已存在，不能覆盖已有任务。' };
  }
  const name = input.name.trim();
  if (!name) return { state, error: '请填写任务显示名称。' };
  const directions = input.directions.split(/[，,、|]/).map((value) => value.trim()).filter(Boolean);
  const patterns = input.patterns.split(/\n/).map((value) => value.trim()).filter(Boolean);
  if (directions.length === 0) return { state, error: '请至少填写一个岗位方向。' };
  if (patterns.length === 0) return { state, error: '请至少填写一种常见 JD 写法。' };
  for (const pattern of patterns) {
    try {
      new RegExp(pattern, 'i');
    } catch {
      return { state, error: `匹配式无效：${pattern}` };
    }
  }
  const task: TaskDefinition = {
    id,
    name,
    directions,
    patterns,
    source: input.source.trim() || '工作台新增',
  };
  return { state: { ...state, tasks: [...state.tasks, task] }, task };
}

export function installSampleTasks(state: AdminState): { state: AdminState; added: number; error?: string } {
  let next = state;
  let added = 0;
  for (const task of SAMPLE_TASKS) {
    if (allTasksWithAdmin(next).some((entry) => entry.id === task.id)) continue;
    next = { ...next, tasks: [...next.tasks, { ...task }] };
    added += 1;
  }
  return { state: next, added };
}

interface RawRow {
  line: number;
  values: string[];
}

function parseDelimited(textValue: string): { rows: RawRow[]; delimiter: ',' | '\t' } {
  const firstLine = textValue.split(/\r?\n/, 1)[0] ?? '';
  const delimiter: ',' | '\t' = firstLine.includes('\t') ? '\t' : ',';
  const rows: RawRow[] = [];
  let values: string[] = [];
  let field = '';
  let inQuotes = false;
  let line = 1;
  let rowLine = 1;

  const pushRow = () => {
    if (values.some((value) => value.trim())) rows.push({ line: rowLine, values });
    values = [];
    rowLine = line;
  };

  for (let i = 0; i < textValue.length; i += 1) {
    const char = textValue[i];
    if (inQuotes) {
      if (char === '"' && textValue[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        if (char === '\n') line += 1;
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      values.push(field.trim());
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && textValue[i + 1] === '\n') i += 1;
      values.push(field.trim());
      field = '';
      pushRow();
      line += 1;
      rowLine = line;
    } else {
      field += char;
    }
  }
  values.push(field.trim());
  pushRow();
  return { rows, delimiter };
}

function normalizeHeader(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/[\s_-]+/g, '');
}

const HEADER_ALIASES: Record<keyof ImportFields, string[]> = {
  id: ['题目id', '题目编号', 'id'],
  title: ['标题', '题目标题', 'title'],
  taskIds: ['任务id', '任务标识', 'taskids'],
  difficulty: ['难度', 'difficulty'],
  prompt: ['题干', 'prompt'],
  evaluationPoints: ['评价要点', '评价点', 'evaluationpoints'],
  sourceNote: ['来源说明', '来源', 'sourcenote'],
};

interface ImportFields {
  id: string;
  title: string;
  taskIds: string;
  difficulty: string;
  prompt: string;
  evaluationPoints: string;
  sourceNote: string;
}

function splitValues(value: string): string[] {
  return value.split(/[|；;]/).map((entry) => entry.trim()).filter(Boolean);
}

function normalizedQuestion(textValue: string): string {
  return textValue.normalize('NFKC').toLowerCase().replace(/[\s，,。；;：:！!？?、'"“”‘’（）()]/g, '');
}

function bigramSimilarity(left: string, right: string): number {
  const grams = (value: string) => {
    const result = new Set<string>();
    for (let i = 0; i < value.length - 1; i += 1) result.add(value.slice(i, i + 2));
    return result;
  };
  const a = grams(left);
  const b = grams(right);
  if (a.size === 0 || b.size === 0) return left === right ? 1 : 0;
  let overlap = 0;
  for (const gram of a) if (b.has(gram)) overlap += 1;
  return overlap / (a.size + b.size - overlap);
}

function rowScenario(
  fields: ImportFields,
  tasksById: Map<string, TaskDefinition>,
): AdminQuestion {
  const taskIds = splitValues(fields.taskIds).map(normalizeTaskId);
  const evaluationPoints = splitValues(fields.evaluationPoints);
  const directions = [...new Set(taskIds.flatMap((taskId) => tasksById.get(taskId)?.directions ?? []))];
  const now = new Date().toISOString();
  return {
    id: fields.id.trim(),
    title: fields.title.trim(),
    typeLabel: '开放场景题 · 不自动打分',
    discipline: directions.join(' / ') || '通用',
    difficulty: fields.difficulty.trim() as Scenario['difficulty'],
    taskTags: taskIds,
    prompt: fields.prompt.trim(),
    referencePoints: evaluationPoints,
    evaluationPoints,
    followUps: [],
    selfCheck: ['我是否直接回应了题目任务？', '我是否说明了判断依据？', '我是否给出了可验证的下一步？'],
    sourceNote: fields.sourceNote.trim(),
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };
}

export function previewImport(state: AdminState, csv: string): ImportPreview {
  const { rows } = parseDelimited(csv);
  if (rows.length < 2) return { rows: [], validCount: 0, error: '没有可读取的数据行。' };
  const header = rows[0].values.map(normalizeHeader);
  const indexes = {} as Record<keyof ImportFields, number>;
  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [keyof ImportFields, string[]][]) {
    const index = header.findIndex((value) => aliases.includes(value));
    if (index < 0) return { rows: [], validCount: 0, error: `缺少列：${field}` };
    indexes[field] = index;
  }
  const tasksById = new Map(allTasksWithAdmin(state).map((task) => [task.id, task]));
  const existing = [...SCENARIO_BANK, ...state.questions];
  const rowsOut: ImportPreviewRow[] = [];
  const seenIds = new Set(existing.map((question) => question.id));
  const seenSignatures = new Set(existing.map((question) => `${question.taskTags.slice().sort().join('|')}::${normalizedQuestion(question.prompt)}`));
  const seenPrompts = existing.map((question) => ({ question, prompt: normalizedQuestion(question.prompt) }));

  for (const row of rows.slice(1)) {
    const fields = Object.fromEntries(
      (Object.keys(indexes) as (keyof ImportFields)[]).map((field) => [field, row.values[indexes[field]] ?? '']),
    ) as unknown as ImportFields;
    const id = fields.id.trim();
    const title = fields.title.trim();
    const taskIds = splitValues(fields.taskIds).map(normalizeTaskId);
    const difficulty = fields.difficulty.trim();
    const prompt = fields.prompt.trim();
    const evaluationPoints = splitValues(fields.evaluationPoints);
    const sourceNote = fields.sourceNote.trim();
    const missing = [
      !id && '题目 ID',
      !title && '标题',
      taskIds.length === 0 && '任务 ID',
      !difficulty && '难度',
      !prompt && '题干',
      evaluationPoints.length === 0 && '评价要点',
      !sourceNote && '来源说明',
    ].filter(Boolean);
    if (missing.length > 0) {
      rowsOut.push({ line: row.line, id, title, status: 'fix', reason: `缺少必填项：${missing.join('、')}` });
      continue;
    }
    if (!['入门', '中等', '进阶'].includes(difficulty)) {
      rowsOut.push({ line: row.line, id, title, status: 'fix', reason: '难度必须是入门、中等或进阶。' });
      continue;
    }
    const unknown = taskIds.filter((taskId) => !tasksById.has(taskId));
    if (unknown.length > 0) {
      rowsOut.push({ line: row.line, id, title, status: 'fix', reason: `未知任务 ID：${unknown.join('、')}` });
      continue;
    }
    const signature = `${taskIds.slice().sort().join('|')}::${normalizedQuestion(prompt)}`;
    if (seenIds.has(id)) {
      rowsOut.push({ line: row.line, id, title, status: 'duplicate', reason: '题目 ID 已存在，不能静默覆盖。' });
      continue;
    }
    if (seenSignatures.has(signature)) {
      rowsOut.push({ line: row.line, id, title, status: 'duplicate', reason: '同一任务下题干完全相同，不能重复新增。' });
      continue;
    }
    const normalized = normalizedQuestion(prompt);
    const similar = seenPrompts.find(
      (entry) =>
        entry.question.taskTags.some((taskId) => taskIds.includes(taskId)) &&
        bigramSimilarity(entry.prompt, normalized) >= 0.82,
    );
    if (similar) {
      rowsOut.push({
        line: row.line,
        id,
        title,
        status: 'duplicate',
        reason: `与已有题目「${similar.question.title}」措辞相似，请人工确认或修改。`,
      });
      continue;
    }
    const scenario = rowScenario(fields, tasksById);
    seenIds.add(id);
    seenSignatures.add(signature);
    seenPrompts.push({ question: scenario, prompt: normalized });
    rowsOut.push({ line: row.line, id, title, status: 'new', reason: '可新增。', scenario });
  }
  return { rows: rowsOut, validCount: rowsOut.filter((row) => row.status === 'new').length };
}

export function commitImport(
  state: AdminState,
  preview: ImportPreview,
): { state: AdminState; imported: number } {
  const questions = preview.rows
    .filter((row) => row.status === 'new' && row.scenario)
    .map((row) => row.scenario as AdminQuestion);
  return { state: { ...state, questions: [...state.questions, ...questions] }, imported: questions.length };
}

export function updateAdminQuestion(
  state: AdminState,
  id: string,
  patch: Partial<Pick<AdminQuestion, 'title' | 'prompt' | 'evaluationPoints' | 'sourceNote' | 'difficulty'>>,
): { state: AdminState; error?: string } {
  const current = state.questions.find((question) => question.id === id);
  if (!current) return { state, error: '找不到题目。' };
  const next = { ...current, ...patch };
  if (!next.title.trim() || !next.prompt.trim() || next.evaluationPoints.length === 0 || !next.sourceNote.trim()) {
    return { state, error: '标题、题干、评价要点和来源说明不能为空。' };
  }
  if (!['入门', '中等', '进阶'].includes(next.difficulty)) {
    return { state, error: '难度必须是入门、中等或进阶。' };
  }
  return {
    state: {
      ...state,
      questions: state.questions.map((question) =>
        question.id === id ? { ...next, updatedAt: new Date().toISOString() } : question,
      ),
    },
  };
}

export function setAdminQuestionStatus(
  state: AdminState,
  id: string,
  status: AdminQuestionStatus,
): AdminState {
  return {
    ...state,
    questions: state.questions.map((question) =>
      question.id === id ? { ...question, status, updatedAt: new Date().toISOString() } : question,
    ),
  };
}

function scenarioResolverFor(state: AdminState, scope: 'official' | 'draft') {
  if (scope === 'official') return scenarioForCapability;
  const custom = new Map<string, Scenario>();
  for (const scenario of [...SCENARIO_BANK, ...state.questions.filter((question) => question.status !== 'withdrawn')]) {
    for (const tag of scenario.taskTags) custom.set(tag, scenario);
  }
  return (key: string, label: string) => custom.get(key) ?? scenarioForCapability(key, label);
}

export function runTrial(
  state: AdminState,
  input: { jd: string; resume: string; scope: 'official' | 'draft' },
): TrialResult {
  const extraTaskPatterns =
    input.scope === 'draft'
      ? state.tasks.map((task) => ({
          key: task.id.replace(/^task:/, ''),
          label: task.name,
          patterns: task.patterns,
        }))
      : [];
  const items = extractItems(input.jd, { extraTaskPatterns });
  const job: Job = { id: 'admin-trial', name: '试跑岗位', rawText: input.jd, extraction: 'ok', items };
  const base = evaluateJob(job, EMPTY_PROFILE);
  const evaluation = matchResume(job, base, input.resume, {});
  const resolver = scenarioResolverFor(state, input.scope);
  const recommendation = recommendForJob(job, EMPTY_PROFILE, evaluation, { scenarioResolver: resolver });
  const recognized = evaluation.capabilities
    .filter((capability) => capability.role === 'task' || capability.role === 'sql')
    .map((capability) => ({
      id: capability.key,
      label: capability.label,
      quote: capability.quote,
      scenarioTitle: resolver(capability.key, capability.label)?.title,
    }));
  return {
    scope: input.scope,
    recognized,
    recommendation,
    recommendationTitle:
      recommendation.scenario?.title ?? recommendation.label,
    requirement: recommendation.basis?.requirement ?? '',
    reason: input.resume.trim()
      ? recommendation.basis?.why ?? recommendation.note ?? ''
      : recommendation.kind === 'none' || recommendation.kind === 'unsupported'
        ? recommendation.note ?? ''
        : '未提供简历，先按 JD 明确任务推荐；补充简历后会按证据重新排序。',
    none: recommendation.kind === 'none' || recommendation.kind === 'unsupported',
  };
}

const BUILT_IN_TASK_IDS = new Set(BUILT_IN_TASKS.map((task) => task.id));
const BUILT_IN_SCENARIO_IDS = new Set(BUILT_IN_SCENARIOS.map((scenario) => scenario.id));

export const OFFICIAL_EXPORT_BASELINE: ExportBaseline = {
  tasks: APPROVED_TASKS.filter((task) => !BUILT_IN_TASK_IDS.has(task.id)),
  scenarios: APPROVED_SCENARIOS.filter((scenario) => !BUILT_IN_SCENARIO_IDS.has(scenario.id)),
};

function taskContent(task: TaskDefinition): string {
  return JSON.stringify([task.id, task.name, task.directions, task.patterns, task.source]);
}

const TASK_FIELD_LABELS: [keyof Pick<TaskDefinition, 'name' | 'directions' | 'patterns' | 'source'>, string][] = [
  ['name', '任务名称'],
  ['directions', '岗位方向'],
  ['patterns', 'JD 识别写法'],
  ['source', '来源说明'],
];

function taskFieldContent(task: TaskDefinition, key: (typeof TASK_FIELD_LABELS)[number][0]): string {
  const value = task[key];
  return Array.isArray(value) ? JSON.stringify(value) : String(value);
}

function taskConflictMessage(published: TaskDefinition, local: TaskDefinition): string {
  const fields = TASK_FIELD_LABELS
    .filter(([key]) => taskFieldContent(published, key) !== taskFieldContent(local, key))
    .map(([, label]) => label);
  return `任务「${published.name}」（${published.id}）的 ${fields.join('、')}与正式题库不同`;
}

function scenarioContent(scenario: Scenario): string {
  return JSON.stringify([
    scenario.id,
    scenario.title,
    scenario.typeLabel,
    scenario.discipline,
    scenario.difficulty,
    [...scenario.taskTags].sort(),
    scenario.prompt,
    scenario.referencePoints,
    scenario.evaluationPoints,
    scenario.followUps,
    scenario.selfCheck,
    scenario.sourceNote,
  ]);
}

function exportTask(task: TaskDefinition): TaskDefinition {
  return {
    id: task.id,
    name: task.name,
    directions: [...task.directions],
    patterns: [...task.patterns],
    source: task.source,
  };
}

function exportScenario(scenario: Scenario): Scenario {
  return {
    id: scenario.id,
    title: scenario.title,
    typeLabel: scenario.typeLabel,
    discipline: scenario.discipline,
    difficulty: scenario.difficulty,
    taskTags: [...scenario.taskTags],
    prompt: scenario.prompt,
    referencePoints: [...scenario.referencePoints],
    evaluationPoints: [...scenario.evaluationPoints],
    followUps: [...scenario.followUps],
    selfCheck: [...scenario.selfCheck],
    sourceNote: scenario.sourceNote,
  };
}

export function buildExport(
  state: AdminState,
  baseline: ExportBaseline = OFFICIAL_EXPORT_BASELINE,
): ExportResult {
  const baselineTasks = baseline.tasks
    .filter(isTaskDefinition)
    .filter((task) => !BUILT_IN_TASK_IDS.has(task.id));
  const baselineScenarios = baseline.scenarios.filter(
    (scenario) => !BUILT_IN_SCENARIO_IDS.has(scenario.id),
  );
  const approved = state.questions.filter((question) => question.status === 'approved');
  if (baselineScenarios.length === 0 && approved.length === 0) {
    return {
      json: '',
      preservedCount: 0,
      addedCount: 0,
      totalCount: 0,
      taskCount: 0,
      error: '还没有可导出的题目。',
    };
  }

  const baselineTaskById = new Map(baselineTasks.map((task) => [task.id, task]));
  const baselineScenarioById = new Map(baselineScenarios.map((scenario) => [scenario.id, scenario]));
  const localTasksById = new Map<string, TaskDefinition[]>();
  for (const task of state.tasks.filter(isTaskDefinition)) {
    if (BUILT_IN_TASK_IDS.has(task.id)) continue;
    const list = localTasksById.get(task.id) ?? [];
    list.push(task);
    localTasksById.set(task.id, list);
  }

  const tasks = baselineTasks.map(exportTask);
  const taskIds = new Set(tasks.map((task) => task.id));
  const scenarios = baselineScenarios.map(exportScenario);
  const stagedById = new Map(scenarios.map((scenario) => [scenario.id, scenario]));
  const conflicts: string[] = [];
  const unknownTasks = new Set<string>();
  let addedCount = 0;

  for (const question of approved) {
    const published = baselineScenarioById.get(question.id);
    if (published) {
      if (scenarioContent(published) !== scenarioContent(question)) {
        conflicts.push(`题目「${question.title}」（${question.id}）与已发布题目内容不同`);
      }
      continue;
    }

    let taskBlocked = false;
    for (const taskId of question.taskTags) {
      if (BUILT_IN_TASK_IDS.has(taskId)) continue;
      const published = baselineTaskById.get(taskId);
      const local = localTasksById.get(taskId);
      if (published) {
        const divergent = local?.find((task) => taskContent(task) !== taskContent(published));
        if (divergent) {
          conflicts.push(taskConflictMessage(published, divergent));
          taskBlocked = true;
        }
        continue;
      }
      if (!local || local.length === 0) {
        unknownTasks.add(taskId);
        taskBlocked = true;
        continue;
      }
      if (new Set(local.map(taskContent)).size > 1) {
        conflicts.push(`任务「${taskId}」存在多条不同配置`);
        taskBlocked = true;
        continue;
      }
      if (!taskIds.has(taskId)) {
        tasks.push(exportTask(local[0]));
        taskIds.add(taskId);
      }
    }
    if (taskBlocked) continue;

    const staged = stagedById.get(question.id);
    if (staged) {
      if (scenarioContent(staged) !== scenarioContent(question)) {
        conflicts.push(`题目「${question.title}」（${question.id}）在同一次导出中有不同内容`);
      }
      continue;
    }
    const exported = exportScenario(question);
    scenarios.push(exported);
    stagedById.set(exported.id, exported);
    addedCount += 1;
  }

  if (conflicts.length > 0 || unknownTasks.size > 0) {
    const messages: string[] = [];
    if (conflicts.length > 0) {
      messages.push(`内容冲突：${conflicts.join('；')}。请核对并解决冲突后重新导出；已发布内容不会被覆盖。`);
    }
    if (unknownTasks.size > 0) {
      messages.push(`题目引用了未知任务：${[...unknownTasks].join('、')}。请先补建任务或修正题目。`);
    }
    messages.push('导出已取消，正式题库保持不变。');
    return {
      json: '',
      preservedCount: baselineScenarios.length,
      addedCount: 0,
      totalCount: 0,
      taskCount: 0,
      error: messages.join(' '),
    };
  }

  const bank = {
    version: 1,
    exportedAt: new Date().toISOString(),
    tasks,
    scenarios,
  };
  return {
    json: JSON.stringify(bank, null, 2),
    preservedCount: baselineScenarios.length,
    addedCount,
    totalCount: scenarios.length,
    taskCount: tasks.length,
  };
}
