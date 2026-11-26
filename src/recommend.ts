import { rankResumePractice } from '../mode/resume-match';
import type {
  ExtractedItem,
  FitEvaluation,
  FitResult,
  Job,
  Profile,
  QuestionId,
  Scenario,
  SqlTask,
  SqlType,
} from './types';
import { evaluateJob } from './fit';
import { scenarioForCapability } from '../mode/practice-bank';
import { QUESTIONS } from './data/questions';

export interface Recommendation {
  sqlItem?: ExtractedItem;
  questionId: QuestionId | null;
  itemId?: string;
  kind: 'normal' | 'broad' | 'unsupported' | 'none' | 'scenario';
  label: string;
  note?: string;
  scenarioId?: string;
  scenario?: Scenario;
  basis?: {
    requirement: string;
    answer: string;
    practice: string;
    why: string;
    exerciseType: string;
  };
  task?: SqlTask;
}

export function sqlTypeLabel(sqlType: SqlType | undefined): string {
  switch (sqlType) {
    case 'basic':
      return '基础查询';
    case 'dedupe':
      return '分组去重';
    case 'join':
      return '多表分析';
    case 'retention':
      return '留存分析';
    case 'unsupported':
      return '进阶 SQL';
    default:
      return '具体任务未写明';
  }
}

function statusScore(result: FitResult): number {
  const scores: Record<FitResult['status'], number> = {
    unmet: 3,
    info: 2,
    meet: 1,
    bonus: 0,
    unknown: 0,
  };
  return scores[result.status];
}

interface SqlCandidate {
  kind: 'sql';
  result: FitResult;
  item: ExtractedItem;
  questionId: QuestionId;
  score: number;
}

interface ScenarioCandidate {
  kind: 'scenario';
  result: FitResult;
  scenario: Scenario;
  score: number;
}

type Candidate = SqlCandidate | ScenarioCandidate;

export interface RecommendOptions {
  scenarioResolver?: (key: string, label: string) => Scenario | null;
}

export function recommendForJob(
  job: Job,
  profile: Profile,
  evaluation: FitEvaluation = evaluateJob(job, profile),
  options: RecommendOptions = {},
): Recommendation {
  const resolveScenario = options.scenarioResolver ?? scenarioForCapability;
  const sqlCandidates: SqlCandidate[] = evaluation.results
    .filter((result) => result.exercise?.state === 'linked' && result.questionId && result.itemId)
    .map((result) => {
      const item = job.items.find((entry) => entry.id === result.itemId);
      if (!item) return null;
      const broad = item.sqlType === 'broad';
      return {
        kind: 'sql' as const,
        result,
        item,
        questionId: result.questionId as QuestionId,
        score: evaluation.resumeBased ? rankResumePractice(result, broad) : (broad ? 1 : 2) * 10 + statusScore(result) + (result.quote ? 1 : 0),
      };
    })
    .filter((entry): entry is SqlCandidate => entry !== null);

  const scenarioCandidates: ScenarioCandidate[] = evaluation.capabilities
    .map((capability) => {
      const scenario = resolveScenario(capability.key, capability.label);
      const result = evaluation.results.find((entry) => entry.id === `cap:${capability.key}`);
      if (!scenario || !result) return null;
      return {
        kind: 'scenario' as const,
        result,
        scenario,
        score: evaluation.resumeBased ? rankResumePractice(result, false) : 30 + statusScore(result) + (result.quote ? 1 : 0),
      };
    })
    .filter((entry): entry is ScenarioCandidate => entry !== null);

  const candidates: Candidate[] = [...scenarioCandidates, ...sqlCandidates].sort(
    (left, right) => right.score - left.score,
  );
  const uncoveredTasks = evaluation.capabilities.filter(
    (capability) =>
      capability.role === 'task' && !resolveScenario(capability.key, capability.label),
  );
  const nonBroadCandidates = candidates.filter(
    (candidate) => !(candidate.kind === 'sql' && candidate.item.sqlType === 'broad'),
  );
  const usableCandidates =
    nonBroadCandidates.length > 0
      ? nonBroadCandidates
      : uncoveredTasks.length > 0
        ? []
        : candidates;

  if (usableCandidates.length === 0) {
    if (uncoveredTasks.length > 0) {
      return {
        questionId: null,
        kind: 'none',
        label: '暂无对应练习',
        note: `JD 明确提到的「${uncoveredTasks[0].label}」暂未覆盖，未用通用 SQL 题替代。`,
      };
    }
    if (evaluation.hasSqlRequirement) {
      return {
        questionId: null,
        kind: 'unsupported',
        label: '暂无对应练习',
        note: '这项 SQL 要求超出第一版题库范围，仍然可以分析和收藏。',
      };
    }
    const excelGap = evaluation.results.find(
      (result) =>
        result.exercise?.state === 'none' &&
        /excel|透视表|电子表格/i.test(result.exercise.note ?? ''),
    );
    const technicalGap =
      excelGap ?? evaluation.results.find((result) => result.exercise?.state === 'none');
    return {
      questionId: null,
      kind: 'none',
      label: '暂无对应练习',
      note:
        technicalGap?.exercise?.note ??
        '这份 JD 没有可对应的 SQL 要求，仍然可以分析和收藏。',
    };
  }

  const chosen = usableCandidates[0];
  if (chosen.kind === 'scenario') {
    return {
      questionId: null,
      itemId: chosen.result.itemId,
      kind: 'scenario',
      label: `场景题 · ${chosen.scenario.title}`,
      note: '开放场景题，不自动打分',
      scenarioId: chosen.scenario.id,
      scenario: chosen.scenario,
      basis: {
        requirement: chosen.result.quote || chosen.result.requirement,
        answer: chosen.result.profileValue,
        practice: `开放场景题 · ${chosen.scenario.title}（不自动打分）`,
        why: chosen.result.reason,
        exerciseType: '开放场景题 · 不自动打分',
      },
    };
  }

  const { result, item, questionId } = chosen;
  const question = QUESTIONS[questionId];
  const isBroad = item.sqlType === 'broad';
  const broadNote = isBroad ? 'JD 只写了宽泛的 SQL 要求，具体任务未说明。' : '';
  const whyTail =
    !evaluation.resumeBased && result.status === 'info'
      ? '先用这道题确认基础。'
      : result.status === 'meet'
        ? '可用于巩固。'
        : result.status === 'bonus'
          ? '这是加分项，但可以作为相关练习。'
          : '';

  return {
    sqlItem: item,
    questionId,
    itemId: item.id,
    kind: isBroad ? 'broad' : 'normal',
    label: `题 ${questionId} · ${isBroad ? '基础自测' : question.typeLabel}`,
    note: isBroad ? 'JD 未说明具体任务' : undefined,
    task: result.sqlTask,
    basis: {
      requirement: result.quote || result.requirement,
      answer: result.profileValue,
      practice: `题 ${questionId} · ${question.typeLabel}（原创练习题，模拟校园活动数据场景）`,
      why: `${broadNote}${result.reason}${whyTail ? ` ${whyTail}` : ''}`,
      exerciseType: '原创练习题 · 模拟工作场景',
    },
  };
}