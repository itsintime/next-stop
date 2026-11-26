import type { Scenario } from '../../src/types';
import approvedBank from './data/approved-bank.json';

export interface TaskDefinition {
  id: string;
  name: string;
  directions: string[];
  patterns: string[];
  source: string;
  builtIn?: boolean;
}

export interface ApprovedBank {
  version: number;
  tasks: TaskDefinition[];
  scenarios: Scenario[];
}

export const BUILT_IN_TASKS: TaskDefinition[] = [
  { id: 'task:metric-system', name: '搭建业务指标体系', directions: ['数据分析'], patterns: [], source: '内置识别规则', builtIn: true },
  { id: 'task:metric-anomaly', name: '排查指标异常', directions: ['数据分析'], patterns: [], source: '内置识别规则', builtIn: true },
  { id: 'task:problem-decompose', name: '拆解业务问题并给出数据建议', directions: ['数据分析'], patterns: [], source: '内置识别规则', builtIn: true },
  { id: 'task:data-modeling', name: '沉淀分析框架为数据模型或数据产品', directions: ['数据分析'], patterns: [], source: '内置识别规则', builtIn: true },
  { id: 'task:business-collab', name: '与业务方沟通并推动分析落地', directions: ['数据分析'], patterns: [], source: '内置识别规则', builtIn: true },
  { id: 'task:requirement-priority', name: '需求排序', directions: ['产品'], patterns: [], source: '内置识别规则', builtIn: true },
  { id: 'task:feature-impact', name: '衡量功能效果', directions: ['产品'], patterns: [], source: '内置识别规则', builtIn: true },
  { id: 'task:prototype-iteration', name: '根据反馈迭代原型', directions: ['视觉设计'], patterns: [], source: '内置识别规则', builtIn: true },
  { id: 'task:mobile-hierarchy', name: '移动端信息层级设计', directions: ['视觉设计'], patterns: [], source: '内置识别规则', builtIn: true },
  { id: 'task:funnel-analysis', name: '活动漏斗分析', directions: ['数据分析', '运营'], patterns: [], source: '内置识别规则', builtIn: true },
];

const builtInTaskIds = new Set(BUILT_IN_TASKS.map((task) => task.id));

function isScenario(value: unknown): value is Scenario {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<Scenario>;
  return (
    typeof item.id === 'string' &&
    typeof item.title === 'string' &&
    typeof item.discipline === 'string' &&
    typeof item.difficulty === 'string' &&
    typeof item.prompt === 'string' &&
    Array.isArray(item.taskTags) &&
    Array.isArray(item.referencePoints) &&
    Array.isArray(item.evaluationPoints) &&
    Array.isArray(item.followUps) &&
    Array.isArray(item.selfCheck) &&
    typeof item.sourceNote === 'string'
  );
}

function isTask(value: unknown): value is TaskDefinition {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<TaskDefinition>;
  return (
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    Array.isArray(item.patterns) &&
    Array.isArray(item.directions) &&
    typeof item.source === 'string'
  );
}

const raw = approvedBank as Partial<ApprovedBank>;
const approvedTasks = Array.isArray(raw.tasks) ? raw.tasks.filter(isTask) : [];
export const APPROVED_TASKS: TaskDefinition[] = approvedTasks
  .filter((task) => task.id.startsWith('task:') && !builtInTaskIds.has(task.id))
  .map((task) => ({ ...task, builtIn: false }));

export const ALL_TASKS: TaskDefinition[] = [...BUILT_IN_TASKS, ...APPROVED_TASKS];

const allTaskIds = new Set(ALL_TASKS.map((task) => task.id));

export const APPROVED_SCENARIOS: Scenario[] = (Array.isArray(raw.scenarios) ? raw.scenarios : [])
  .filter(isScenario)
  .filter(
    (scenario) =>
      scenario.taskTags.length > 0 &&
      scenario.taskTags.every((taskId) => allTaskIds.has(taskId)) &&
      scenario.evaluationPoints.length >= 1,
  );

export const OFFICIAL_SCENARIOS: Scenario[] = APPROVED_SCENARIOS;

export const APPROVED_TASK_PATTERN_INPUTS = APPROVED_TASKS.map((task) => ({
  key: task.id.replace(/^task:/, ''),
  label: task.name,
  patterns: task.patterns,
}));

export function taskById(id: string): TaskDefinition | undefined {
  return ALL_TASKS.find((task) => task.id === id);
}

export function officialTaskIds(): Set<string> {
  return new Set(allTaskIds);
}

export function approvedTaskPatternInputs() {
  return APPROVED_TASK_PATTERN_INPUTS;
}
