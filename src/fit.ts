import type {
  CapabilityAnswer,
  CapabilityRequirement,
  ExtractedItem,
  FitEvaluation,
  FitResult,
  Job,
  Profile,
  QuestionId,
  SelfLevel,
  SqlTask,
} from './types';
import { scenarioForCapability } from '../mode/practice-bank';

const TASK_LABELS: Record<SqlTask, string> = {
  basic: '基础查询',
  dedupe: '分组去重',
  join: '多表连接',
};

const TASK_QUESTIONS: Record<SqlTask, 1 | 2 | 3> = {
  basic: 1,
  dedupe: 2,
  join: 3,
};

const QUESTION_LABELS: Record<QuestionId, string> = {
  1: '题 1 · 基础查询',
  2: '题 2 · 分组去重',
  3: '题 3 · 多表分析',
};

const SELF_LABELS: Record<SelfLevel, string> = {
  none: '没学过',
  aware: '了解但不能独立完成',
  independent: '能独立完成',
  '': '未填写',
};

const CN_NUMBERS: Record<string, number> = {
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
  十一: 11,
  十二: 12,
};

export function taskLabel(task: SqlTask): string {
  return TASK_LABELS[task];
}

export function selfLevelLabel(level: SelfLevel): string {
  return SELF_LABELS[level];
}

export function capabilityLevelLabel(level: SelfLevel, kind: 'sql' | 'excel' | 'skill'): string {
  if (level === 'none') return kind === 'sql' ? '没学过' : '没做过';
  if (level === 'aware') return '需要参考';
  return SELF_LABELS[level];
}

export function isSqlItem(item: ExtractedItem): boolean {
  return item.field === 'skill' && (/sql|mysql|postgres|oracle/i.test(item.value) || Boolean(item.sqlType));
}

export function sqlTaskFromItem(item: ExtractedItem): SqlTask | null {
  if (item.sqlType === 'basic' || item.sqlType === 'broad') return 'basic';
  if (item.sqlType === 'dedupe') return 'dedupe';
  if (item.sqlType === 'join') return 'join';
  return null;
}

export function questionForTask(task: SqlTask): 1 | 2 | 3 {
  return TASK_QUESTIONS[task];
}

function parseNumberToken(token: string): number | null {
  if (/^\d+$/.test(token)) return Number(token);
  return CN_NUMBERS[token] ?? null;
}

function firstNumber(text: string, unit: 'day' | 'month'): number | null {
  const pattern =
    unit === 'day'
      ? /(\d+|[一二三四五六七八九十两]+)\s*(?:天|日)/
      : /(\d+|[一二三四五六七八九十两]+)\s*个?\s*月/;
  const match = text.match(pattern);
  return match ? parseNumberToken(match[1]) : null;
}

function yearOf(text: string): number | null {
  const match = text.match(/20\d{2}/);
  return match ? Number(match[0]) : null;
}

function profileDisplay(profile: Profile): Record<'graduation' | 'days' | 'duration', string> {
  return {
    graduation: profile.graduation.trim() ? `${profile.graduation.trim()} 届` : '未填写',
    days: profile.days.trim() ? `每周 ${profile.days.trim()} 天` : '未填写',
    duration: profile.duration.trim() ? `${profile.duration.trim()} 个月` : '未填写',
  };
}

function headword(result: FitResult): string {
  if (result.label === '毕业届别') return '届别';
  if (result.label === '每周到岗') return '到岗要求';
  if (result.label === '连续实习') return '实习时长';
  return result.label;
}

function itemText(item: ExtractedItem | undefined): string {
  return item ? `${item.value} ${item.detail ?? ''} ${item.quote}` : '';
}

function isPivot(text: string): boolean {
  return /透视表|数据透视|pivot/i.test(text);
}

function isExcel(text: string): boolean {
  return /excel|电子表格/i.test(text);
}

function exerciseFor(result: FitResult, item: ExtractedItem | undefined) {
  const key = result.id.startsWith('cap:') ? result.id.slice(4) : '';
  const scenario = scenarioForCapability(key, result.label);
  if (scenario) {
    return {
      state: 'linked' as const,
      label: `场景题 · ${scenario.title}`,
      note: '开放场景题 · 不自动打分',
    };
  }

  if (result.questionId) {
    return {
      state: 'linked' as const,
      label: QUESTION_LABELS[result.questionId],
      note: '沿用同一条 JD 要求和原句',
    };
  }

  const text = itemText(item);
  if (item?.field === 'task') {
    return {
      state: 'none' as const,
      label: '暂无对应练习',
      note: '题库暂无这项任务的对应练习。',
    };
  }
  if (item?.field === 'skill') {
    if (isSqlItem(item)) {
      return {
        state: 'none' as const,
        label: '暂无对应练习',
        note: '这项 SQL 要求超出现有题库范围。',
      };
    }
    if (isPivot(text)) {
      return {
        state: 'none' as const,
        label: '暂无对应练习',
        note: '题库当前覆盖 SQL 基础、分组去重和多表分析，暂无 Excel 透视表题。',
      };
    }
    return {
      state: 'none' as const,
      label: '暂无对应练习',
      note: '题库当前只覆盖 SQL，暂无这项技能的对应练习。',
    };
  }

  if (item?.field === 'duty') {
    if (isPivot(text) || isExcel(text)) {
      return {
        state: 'none' as const,
        label: '暂无对应练习',
        note: '题库暂无 Excel 透视表或电子表格练习。',
      };
    }
    return {
      state: 'not_applicable' as const,
      label: '无需练习',
      note: '这是职责描述，不进入 SQL 练习。',
    };
  }

  return {
    state: 'not_applicable' as const,
    label: '无需练习',
    note: '这是时间或届别条件，不是练习题。',
  };
}

function sqlTaskFromText(text: string): SqlTask | null {
  if (/多表|联表|表连接|表关联|join/i.test(text)) return 'join';
  if (/去重|分组统计|分组查询|count\s*\(/i.test(text)) return 'dedupe';
  if (/基础查询|条件查询|筛选|数据查询/i.test(text)) return 'basic';
  return null;
}

const TOOL_PATTERNS: { value: string; pattern: RegExp }[] = [
  { value: 'Python', pattern: /python/i },
  { value: 'Tableau', pattern: /tableau/i },
  { value: 'Power BI', pattern: /power\s*bi/i },
  { value: 'SPSS', pattern: /spss/i },
  { value: 'Excel', pattern: /excel|电子表格/i },
  { value: 'R', pattern: /(?<![A-Za-z])R(?![A-Za-z])/ },
  { value: 'SAS', pattern: /\bsas\b/i },
  { value: 'Stata', pattern: /\bstata\b/i },
  { value: 'Hive', pattern: /\bhive\b/i },
  { value: 'Spark', pattern: /\bspark\b/i },
  { value: 'SQL', pattern: /\bsql\b|mysql|postgres|oracle/i },
];

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\u4e00-\u9fa5-]/g, '');
}

function detectToolName(text: string): string | null {
  return TOOL_PATTERNS.find((tool) => tool.pattern.test(text))?.value ?? null;
}

function isToolSetText(text: string): boolean {
  const matches = TOOL_PATTERNS.filter((tool) => tool.pattern.test(text)).length;
  return matches >= 2 || (/、/.test(text) && /等/.test(text));
}

function specificToolTask(
  tool: string,
  text: string,
): { key: string; label: string } | null {
  if (/清洗|预处理/.test(text)) {
    return { key: 'clean', label: `${tool} 数据清洗` };
  }
  if (/统计建模|建模|数据模型/.test(text)) {
    return { key: 'modeling', label: `${tool} 统计建模` };
  }
  if (/仪表盘|看板|dashboard/i.test(text)) {
    return { key: 'dashboard', label: `${tool} 仪表盘` };
  }
  if (/可视化|图表/.test(text)) {
    return { key: 'visualization', label: `${tool} 数据可视化` };
  }
  if (/分析/.test(text)) {
    return { key: 'analysis', label: `${tool} 数据分析` };
  }
  return null;
}

function capabilityKeyForSkill(value: string): string {
  return `skill:${normalizeKey(value)}`;
}

function capabilityFromItem(item: ExtractedItem): CapabilityRequirement | null {
  const text = itemText(item);
  if (!text.trim()) return null;

  if (item.field === 'skill' && (item.alternatives?.length || item.uncertain)) {
    return {
      key: item.alternatives?.length ? `choice:${normalizeKey(item.value)}` : `review:${normalizeKey(item.value)}`,
      label: item.value, kind: 'skill', role: 'general', requirement: item.requirement,
      quote: item.quote, itemId: item.id, answer: '',
    };
  }

  if (item.field === 'task') {
    return {
      key: `task:${item.taskKey ?? normalizeKey(item.value)}`,
      label: item.value,
      kind: 'skill',
      role: 'task',
      requirement: 'duty',
      quote: item.quote,
      itemId: item.id,
      answer: '',
    };
  }

  if (item.field === 'education' || item.field === 'enrollment' || item.field === 'major') {
    return null;
  }

  const sqlByText =
    item.field === 'duty' &&
    (/(?:\bsql\b|mysql|postgres|oracle)/i.test(text) || sqlTaskFromText(text) !== null);
  const looksSql = isSqlItem(item) || sqlByText;
  if (looksSql) {
    const toolSet = isToolSetText(text);
    if (item.sqlType === 'retention' || /留存/.test(text)) {
      return {
        key: 'sql:retention',
        label: /次日留存/.test(text) ? 'SQL 次日留存' : 'SQL 留存分析',
        kind: 'sql',
        role: 'sql',
        requirement: item.requirement,
        quote: item.quote,
        itemId: item.id,
        toolSet,
        answer: '',
      };
    }
    if (item.sqlType === 'broad') {
      return {
        key: 'sql:broad',
        label: 'SQL（具体任务待确认）',
        kind: 'sql',
        role: 'sql',
        requirement: item.requirement,
        quote: item.quote,
        itemId: item.id,
        sqlTask: 'basic',
        questionId: 1,
        uncertain: true,
        toolSet,
        answer: '',
      };
    }
    if (item.sqlType === 'unsupported') {
      return {
        key: 'sql:advanced',
        label: '进阶 SQL（具体任务待确认）',
        kind: 'sql',
        role: 'sql',
        requirement: item.requirement,
        quote: item.quote,
        itemId: item.id,
        uncertain: true,
        toolSet,
        answer: '',
      };
    }
    const task = sqlTaskFromItem(item) ?? sqlTaskFromText(text);
    if (!task) {
      return {
        key: 'sql:unspecified',
        label: 'SQL（具体任务待确认）',
        kind: 'sql',
        role: 'sql',
        requirement: item.requirement,
        quote: item.quote,
        itemId: item.id,
        uncertain: true,
        toolSet,
        answer: '',
      };
    }
    return {
      key: `sql:${task}`,
      label: `SQL ${taskLabel(task)}`,
      kind: 'sql',
      role: 'sql',
      requirement: item.requirement,
      quote: item.quote,
      itemId: item.id,
      sqlTask: task,
      questionId: questionForTask(task),
      toolSet,
      answer: '',
    };
  }

  if (isPivot(text)) {
    const detail = text.match(/按([^，。；;\n]{1,12})汇总/)?.[0];
    return {
      key: 'excel:pivot',
      label: detail ? `Excel 透视表 · ${detail}` : 'Excel 透视表',
      kind: 'excel',
      role: 'task',
      requirement: item.requirement,
      quote: item.quote,
      itemId: item.id,
      answer: '',
    };
  }

  const tool =
    item.field === 'skill' && TOOL_PATTERNS.some((entry) => entry.value === item.value)
      ? item.value
      : detectToolName(text);
  if (tool) {
    const specific = specificToolTask(tool, text);
    if (specific) {
      return {
        key: `tool:${normalizeKey(tool)}:${specific.key}`,
        label: specific.label,
        kind: 'skill',
        role: 'task',
        requirement: item.requirement,
        quote: item.quote,
        itemId: item.id,
        answer: '',
      };
    }
    return {
      key: `tool:${normalizeKey(tool)}:general`,
      label: tool,
      kind: 'skill',
      role: 'tool',
      requirement: item.requirement,
      quote: item.quote,
      itemId: item.id,
      toolSet: isToolSetText(text),
      answer: '',
    };
  }

  if (item.field === 'skill') {
    return {
      key: capabilityKeyForSkill(item.value),
      label: item.value,
      kind: 'skill',
      role: 'general',
      requirement: item.requirement,
      quote: item.quote,
      itemId: item.id,
      answer: '',
    };
  }

  return null;
}

export function deriveCapabilities(
  job: Job,
  answers: Record<string, CapabilityAnswer>,
  profile: Profile,
): CapabilityRequirement[] {
  const ranked = new Map<string, { capability: CapabilityRequirement; score: number }>();
  for (const item of job.items) {
    const capability = capabilityFromItem(item);
    if (!capability) continue;
    const score =
      item.field === 'skill'
        ? item.requirement === 'required'
          ? 4
          : 3
        : item.requirement === 'preferred'
          ? 2
          : 1;
    const current = ranked.get(capability.key);
    if (!current || score > current.score) {
      ranked.set(capability.key, { capability, score });
    }
  }

  return [...ranked.values()].map(({ capability }) => {
    const explicit = answers[capability.key]?.level;
    const fallback =
      capability.kind === 'sql' && capability.sqlTask ? profile.sql[capability.sqlTask] : '';
    return {
      ...capability,
      answer: capability.uncertain ? '' : explicit ?? fallback,
    };
  });
}

export function evaluateJob(
  job: Job,
  profile: Profile,
  answers: Record<string, CapabilityAnswer> = {},
): FitEvaluation {
  const results: FitResult[] = [];
  const shown = profileDisplay(profile);
  const capabilities = deriveCapabilities(job, answers, profile);
  const itemById = new Map(job.items.map((item) => [item.id, item]));
  const consumedDutyIds = new Set<string>();
  const profileFilled = Boolean(
    profile.graduation.trim() ||
      profile.days.trim() ||
      profile.duration.trim() ||
      Object.values(profile.sql).some(Boolean) ||
      capabilities.some((capability) => capability.answer),
  );

  const graduation = job.items.find((item) => item.field === 'graduation');
  if (!graduation) {
    results.push({
      id: 'base:graduation',
      label: '毕业届别',
      requirement: 'JD 未说明',
      profileValue: shown.graduation,
      verdict: 'JD 未说明',
      status: 'unknown',
      reason: '岗位描述没有写明毕业届别，因此不判定为不满足。',
      group: 'hard',
    });
  } else if (graduation.requirement === 'preferred') {
    results.push({
      id: `item:${graduation.id}`,
      label: '毕业届别',
      requirement: `${graduation.value}${graduation.qualifier ?? ''}`,
      profileValue: shown.graduation,
      verdict: '加分项',
      status: 'bonus',
      reason: '岗位标注为优先考虑，不作为硬门槛。',
      group: 'bonus',
      itemId: graduation.id,
    });
  } else {
    const jobYear = yearOf(graduation.value);
    const myYear = yearOf(profile.graduation);
    if (graduation.uncertain || jobYear === null) {
      results.push({
        id: `item:${graduation.id}`,
        label: '毕业届别',
        requirement: graduation.value,
        profileValue: shown.graduation,
        verdict: '待确认',
        status: 'unknown',
        reason: 'JD 有届别描述，但没有写明具体年份，暂不判定。',
        group: 'hard',
        itemId: graduation.id,
      });
    } else if (myYear === null) {
      results.push({
        id: `item:${graduation.id}`,
        label: '毕业届别',
        requirement: `${jobYear} 届`,
        profileValue: shown.graduation,
        verdict: '资料未填写',
        status: 'unknown',
        reason: '我的资料没有填写毕业届别，暂不判定为不满足。',
        group: 'hard',
        itemId: graduation.id,
      });
    } else if (jobYear === myYear) {
      results.push({
        id: `item:${graduation.id}`,
        label: '毕业届别',
        requirement: `${jobYear} 届`,
        profileValue: `${myYear} 届`,
        verdict: '满足',
        status: 'meet',
        reason: `岗位面向 ${jobYear} 届，我的资料是 ${myYear} 届。`,
        group: 'hard',
        itemId: graduation.id,
      });
    } else {
      results.push({
        id: `item:${graduation.id}`,
        label: '毕业届别',
        requirement: `${jobYear} 届`,
        profileValue: `${myYear} 届`,
        verdict: '不满足',
        status: 'unmet',
        reason: `岗位面向 ${jobYear} 届，我的资料是 ${myYear} 届。`,
        group: 'hard',
        itemId: graduation.id,
      });
    }
  }

  const days = job.items.find((item) => item.field === 'days');
  if (!days) {
    results.push({
      id: 'base:days',
      label: '每周到岗',
      requirement: 'JD 未说明',
      profileValue: shown.days,
      verdict: 'JD 未说明',
      status: 'unknown',
      reason: '岗位描述没有写明每周到岗天数，因此不判定为不满足。',
      group: 'hard',
    });
  } else {
    const requiredDays = firstNumber(days.value, 'day');
    const myDays = Number(profile.days);
    if (days.uncertain || requiredDays === null) {
      results.push({
        id: `item:${days.id}`,
        label: '每周到岗',
        requirement: days.value,
        profileValue: shown.days,
        verdict: '待确认',
        status: 'unknown',
        reason: 'JD 有到岗描述，但无法确定具体天数，暂不判定。',
        group: 'hard',
        itemId: days.id,
      });
    } else if (!profile.days.trim() || Number.isNaN(myDays)) {
      results.push({
        id: `item:${days.id}`,
        label: '每周到岗',
        requirement: days.value,
        profileValue: shown.days,
        verdict: '资料未填写',
        status: 'unknown',
        reason: '我的资料没有填写每周可到岗天数，暂不判定为不满足。',
        group: 'hard',
        itemId: days.id,
      });
    } else if (myDays >= requiredDays) {
      results.push({
        id: `item:${days.id}`,
        label: '每周到岗',
        requirement: days.value,
        profileValue: shown.days,
        verdict: '满足',
        status: 'meet',
        reason: `每周可到岗 ${myDays} 天，达到岗位要求的最少 ${requiredDays} 天。`,
        group: 'hard',
        itemId: days.id,
      });
    } else {
      results.push({
        id: `item:${days.id}`,
        label: '每周到岗',
        requirement: days.value,
        profileValue: shown.days,
        verdict: '不满足',
        status: 'unmet',
        reason: `每周可到岗 ${myDays} 天，少于岗位要求的最少 ${requiredDays} 天。`,
        group: 'hard',
        itemId: days.id,
      });
    }
  }

  const duration = job.items.find((item) => item.field === 'duration');
  if (!duration) {
    results.push({
      id: 'base:duration',
      label: '连续实习',
      requirement: 'JD 未说明',
      profileValue: shown.duration,
      verdict: 'JD 未说明',
      status: 'unknown',
      reason: '岗位描述没有写连续实习时长，因此不判定为不满足。',
      group: 'hard',
    });
  } else {
    const requiredMonths = firstNumber(duration.value, 'month');
    const myMonths = Number(profile.duration);
    if (duration.uncertain || requiredMonths === null) {
      results.push({
        id: `item:${duration.id}`,
        label: '连续实习',
        requirement: duration.value,
        profileValue: shown.duration,
        verdict: '待确认',
        status: 'unknown',
        reason: 'JD 有时长描述，但无法确定具体月数，暂不判定。',
        group: 'hard',
        itemId: duration.id,
      });
    } else if (!profile.duration.trim() || Number.isNaN(myMonths)) {
      results.push({
        id: `item:${duration.id}`,
        label: '连续实习',
        requirement: duration.value,
        profileValue: shown.duration,
        verdict: '资料未填写',
        status: 'unknown',
        reason: '我的资料没有填写可连续实习时长，暂不判定为不满足。',
        group: 'hard',
        itemId: duration.id,
      });
    } else if (myMonths >= requiredMonths) {
      results.push({
        id: `item:${duration.id}`,
        label: '连续实习',
        requirement: duration.value,
        profileValue: shown.duration,
        verdict: '满足',
        status: 'meet',
        reason: `可连续实习 ${myMonths} 个月，达到岗位要求的最少 ${requiredMonths} 个月。`,
        group: 'hard',
        itemId: duration.id,
      });
    } else {
      results.push({
        id: `item:${duration.id}`,
        label: '连续实习',
        requirement: duration.value,
        profileValue: shown.duration,
        verdict: '不满足',
        status: 'unmet',
        reason: `可连续实习 ${myMonths} 个月，少于岗位要求的最少 ${requiredMonths} 个月。`,
        group: 'hard',
        itemId: duration.id,
      });
    }
  }

  for (const item of job.items.filter((entry) => entry.field === 'education')) {
    results.push({
      id: `item:${item.id}`,
      label: '学历要求',
      requirement: item.value,
      profileValue: '资料未覆盖',
      verdict: '待确认',
      status: 'unknown',
      reason: '当前资料没有学历字段，暂不判定为不满足。',
      group: 'hard',
      itemId: item.id,
    });
  }

  for (const item of job.items.filter((entry) => entry.field === 'enrollment')) {
    results.push({
      id: `item:${item.id}`,
      label: '在校状态',
      requirement: item.value,
      profileValue: '资料未覆盖',
      verdict: '待确认',
      status: 'unknown',
      reason: '当前资料没有在校状态字段，暂不判定为不满足。',
      group: 'hard',
      itemId: item.id,
    });
  }

  for (const item of job.items.filter((entry) => entry.field === 'major')) {
    results.push({
      id: `item:${item.id}`,
      label: '相关专业',
      requirement: item.value,
      profileValue: '资料未覆盖',
      verdict: '岗位信息',
      status: 'info',
      reason: '岗位单独列出相关专业，当前资料没有专业字段，暂不判定。',
      group: 'info',
      itemId: item.id,
    });
  }

  for (const capability of capabilities) {
    const item = itemById.get(capability.itemId);
    if (item?.field === 'duty') consumedDutyIds.add(item.id);
    const requirementText =
      capability.requirement === 'preferred'
        ? `加分能力 · ${capability.label}`
        : capability.role === 'task'
          ? `岗位任务 · ${capability.label}`
          : capability.role === 'tool'
            ? `工具熟悉度 · ${capability.label}`
            : capability.role === 'sql'
              ? `SQL 任务 · ${capability.label}`
              : `能力项 · ${capability.label}`;
    const base = {
      id: `cap:${capability.key}`,
      label: capability.label,
      requirement: requirementText,
      quote: capability.quote,
      itemId: capability.itemId,
      sqlTask: capability.sqlTask,
      questionId: capability.questionId,
    };

    if (capability.uncertain) {
      results.push({
        ...base,
        profileValue: '待确认',
        verdict: '待确认',
        status: 'unknown',
        reason: 'JD 里有这条描述，但没有写明具体任务；请先补充或更正岗位要求。',
        group: 'skill',
      });
      continue;
    }

    const answerText = capabilityLevelLabel(capability.answer, capability.kind);
    if (capability.requirement === 'preferred') {
      results.push({
        ...base,
        profileValue: answerText,
        verdict: '加分项',
        status: 'bonus',
        reason: `岗位标注为加分项；当前回答：${answerText}。不作为硬门槛。`,
        group: 'bonus',
      });
      continue;
    }

    if (!capability.answer) {
      results.push({
        ...base,
        profileValue: '未填写',
        verdict: '信息不足',
        status: 'info',
        reason: '还没有回答这项能力，暂不判定为不满足。',
        group: 'skill',
      });
    } else if (capability.answer === 'independent') {
      results.push({
        ...base,
        profileValue: answerText,
        verdict: '自评符合',
        status: 'meet',
        reason: `自评能独立完成「${capability.label}」；这是自评，不等同于岗位录用判断。`,
        group: 'skill',
      });
    } else {
      results.push({
        ...base,
        profileValue: answerText,
        verdict: '需要补强',
        status: 'unmet',
        reason: `自评${answerText}「${capability.label}」，建议先补强。`,
        group: 'skill',
      });
    }
  }

  for (const item of job.items.filter(
    (entry) => entry.field === 'duty' && !consumedDutyIds.has(entry.id),
  )) {
    results.push({
      id: `item:${item.id}`,
      label: '实习职责',
      requirement: item.value,
      profileValue: '无需匹配',
      verdict: '职责描述',
      status: 'info',
      reason: '职责描述不等于硬门槛，不会单独判为不满足。',
      group: 'info',
      itemId: item.id,
    });
  }

  for (const result of results) {
    const item = result.itemId ? itemById.get(result.itemId) : undefined;
    result.quote = result.quote ?? item?.quote;
    result.exercise = exerciseFor(result, item);
  }

  const unmet = results.filter((result) => result.status === 'unmet' && result.group === 'hard');
  const weakSkills = results.filter((result) => result.status === 'unmet' && result.group === 'skill');
  const unknown = results.filter((result) => result.status === 'unknown');
  const bonus = results.filter((result) => result.status === 'bonus');

  let headline = '';
  if (!profileFilled) {
    headline = '我的资料尚未填写；先补充资料，才能逐项判断。';
  } else if (unmet.length > 0 || weakSkills.length > 0) {
    const parts: string[] = [];
    if (unmet.length > 0) parts.push(`${unmet.map(headword).join('、')}不满足`);
    if (weakSkills.length > 0) {
      const sqlOnly = weakSkills.every((result) => Boolean(result.sqlTask));
      parts.push(`有 ${weakSkills.length} 项${sqlOnly ? ' SQL 能力' : '能力'}待补强`);
    }
    headline = `${parts.join('；')}。`;
  } else {
    headline = '暂未发现不满足的硬条件。';
    if (unknown.length > 0) headline += `另有 ${unknown.length} 项因信息不足暂不判定。`;
  }

  return {
    results,
    capabilities,
    headline,
    unmet,
    weakSkills,
    unknown,
    bonus,
    profileFilled,
    hasSqlRequirement: capabilities.some((capability) => capability.kind === 'sql') || job.items.some(isSqlItem),
  };
}
