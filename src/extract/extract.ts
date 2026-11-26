import type { ExtractedItem, SqlType } from '../types';
import { designTools, explicitToolChoice } from '../../mode/resume-match/requirements';
import { approvedTaskPatternInputs } from '../../mode/practice-bank/tasks';
import { uid } from '../utils';

interface Piece {
  text: string;
  start: number;
  end: number;
}

const SENTENCE_BREAK = /[。；;\n]/;
const SEGMENT_BREAK = /[。；;\n，,]/;

function splitPieces(rawText: string, breakPattern: RegExp): Piece[] {
  const pieces: Piece[] = [];
  let start = 0;
  for (let i = 0; i <= rawText.length; i += 1) {
    const isEnd = i === rawText.length;
    if (!isEnd && !breakPattern.test(rawText[i])) continue;
    const chunk = rawText.slice(start, i);
    const leading = chunk.length - chunk.trimStart().length;
    const trimmed = chunk.trim();
    if (trimmed) {
      pieces.push({ text: trimmed, start: start + leading, end: start + leading + trimmed.length });
    }
    start = i + 1;
  }
  return pieces;
}

function cleanQuote(text: string): string {
  return text.replace(/[。；;，,\s]+$/u, '').trim();
}

function findSentence(sentences: Piece[], position: number): Piece {
  return (
    sentences.find((sentence) => position >= sentence.start && position < sentence.end + 1) ??
    sentences[sentences.length - 1] ?? { text: '', start: position, end: position }
  );
}

function parseCnNumber(value: string): number | null {
  if (/^\d+$/.test(value)) return Number(value);
  const map: Record<string, number> = {
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
  };
  if (value === '十一') return 11;
  if (value === '十二') return 12;
  return map[value] ?? null;
}

interface ToolDefinition {
  value: string;
  pattern: RegExp;
  dialect?: boolean;
}

const TOOLS: ToolDefinition[] = [
  ...designTools,
  { value: 'MySQL', pattern: /\bmysql\b/i, dialect: true },
  { value: 'PostgreSQL', pattern: /\bpostgres(?:ql)?\b/i, dialect: true },
  { value: 'Oracle', pattern: /\boracle\b/i, dialect: true },
  { value: 'SQL', pattern: /\bsql\b/i },
  { value: 'Python', pattern: /\bpython\b/i },
  { value: 'Excel', pattern: /\bexcel\b|电子表格/i },
  { value: 'Tableau', pattern: /\btableau\b/i },
  { value: 'Power BI', pattern: /power\s*bi/i },
  { value: 'SPSS', pattern: /\bspss\b/i },
  { value: 'SAS', pattern: /\bsas\b/i },
  { value: 'Stata', pattern: /\bstata\b/i },
  { value: 'Hive', pattern: /\bhive\b/i },
  { value: 'Spark', pattern: /\bspark\b/i },
  { value: 'Hadoop', pattern: /\bhadoop\b/i },
  { value: 'R', pattern: /(?<![A-Za-z])R(?![A-Za-z])/ },
  { value: 'Git', pattern: /\bgit\b/i },
  { value: 'Linux', pattern: /\blinux\b/i },
  { value: 'Java', pattern: /\bjava\b/i },
  { value: 'C++', pattern: /c\+\+/i },
  { value: '数据可视化', pattern: /数据可视化|可视化工具/ },
  { value: '数据清洗', pattern: /数据清洗/ },
  { value: '机器学习', pattern: /机器学习/ },
];

const PREFERRED = /优先|加分|更佳|最好|优先考虑|优先录用/;
const DUTY = /协助|负责|参与|配合|维护|搭建|整理|输出|制作|跟进|推动|落地|撰写|组织/;
const STRONG_REQUIRED =
  /^(?:要求|必须|需要|需)|(?:要求|必须|需要|需)(?:熟练|掌握|熟悉|具备)|任职资格|岗位要求/;
const SQL_TASK_PHRASE =
  /去重|分组(?:统计|查询)?|多表|联表|表连接|表关联|join|基础查询|条件查询|数据查询|聚合(?:统计|查询)|留存/i;
const TASK_REQUIREMENT = /要求|需要|必须|熟悉|掌握|能对|能使用|会使用/;

interface SqlTaskDefinition {
  sqlType: SqlType;
  detail?: string;
}

interface TaskPattern {
  key: string;
  label: string;
  test: (text: string) => boolean;
}

export interface TaskPatternInput {
  key: string;
  label: string;
  patterns: string[];
}

export interface ExtractOptions {
  extraTaskPatterns?: TaskPatternInput[];
}

function compileTaskPatterns(inputs: TaskPatternInput[]): TaskPattern[] {
  return inputs.flatMap((input) => {
    const expressions = input.patterns.flatMap((pattern) => {
      try {
        return [new RegExp(pattern, 'i')];
      } catch {
        return [];
      }
    });
    if (!input.key || expressions.length === 0) return [];
    return [{ key: input.key, label: input.label, test: (text: string) => expressions.some((expression) => expression.test(text)) }];
  });
}

const APPROVED_TASK_PATTERNS = compileTaskPatterns(approvedTaskPatternInputs());

const TASK_PATTERNS: TaskPattern[] = [
  {
    key: 'metric-system',
    label: '搭建业务指标体系',
    test: (text) =>
      /搭建|构建|建立|设计/.test(text) &&
      /(指标|数据).{0,8}体系|指标体系|数据分析体系/.test(text),
  },
  {
    key: 'metric-anomaly',
    label: '排查指标异常',
    test: (text) =>
      (/监控|监测|排查/.test(text) && /指标|异常|波动/.test(text)) || /异常波动/.test(text),
  },
  {
    key: 'problem-decompose',
    label: '拆解业务问题并给出数据建议',
    test: (text) =>
      /拆解.{0,8}问题|分析.{0,8}问题/.test(text) && /数据|建议|支持/.test(text),
  },
  {
    key: 'data-modeling',
    label: '沉淀分析框架为数据模型或数据产品',
    test: (text) => /沉淀|数据模型|数据产品/.test(text),
  },
  {
    key: 'business-collab',
    label: '与业务方沟通并推动分析落地',
    test: (text) => /业务方.{0,12}沟通|机会点|推动落地/.test(text),
  },
  {
    key: 'requirement-priority',
    label: '需求排序',
    test: (text) =>
      /(需求|功能).{0,16}(优先级|排序|取舍|排期)|(优先级|排序|取舍|排期).{0,16}(需求|功能)|只能做一个需求/.test(
        text,
      ),
  },
  {
    key: 'feature-impact',
    label: '衡量功能效果',
    test: (text) =>
      /(衡量|评估|验证|判断).{0,20}(功能|产品).{0,20}(效果|影响|价值)|功能上线后.{0,24}(判断|衡量|验证|评估)|A\/B\s*测试|AB\s*测试|灰度.{0,10}(验证|评估)/i.test(
        text,
      ),
  },
  {
    key: 'prototype-iteration',
    label: '根据反馈迭代原型',
    test: (text) =>
      /可用性测试|用户测试|用户反馈|用户访谈/.test(text) &&
      /原型|交互|页面|流程/.test(text) &&
      /优化|迭代|调整|改进|修改/.test(text),
  },
  {
    key: 'mobile-hierarchy',
    label: '移动端信息层级设计',
    test: (text) =>
      /移动端|手机端|活动页|落地页|报名页|H5/.test(text) &&
      /信息层级|视觉层级|信息架构|内容层级|页面信息|信息太多|快速理解|报名按钮|视觉重点/.test(text),
  },
  {
    key: 'funnel-analysis',
    label: '活动漏斗分析',
    test: (text) =>
      /漏斗|转化路径|转化环节/.test(text) && /分析|拆解|优化|监控|提升|排查/.test(text),
  },
];

function detectImplicitSqlTasks(text: string): SqlTaskDefinition[] {
  if (!SQL_TASK_PHRASE.test(text) || !TASK_REQUIREMENT.test(text)) return [];
  if (detectTools(text).length > 0) return [];
  return detectSqlTasks(text).filter((task) => task.sqlType !== 'broad');
}

function detectTools(text: string): ToolDefinition[] {
  const found = TOOLS.filter((tool) => tool.pattern.test(text));
  const hasDialect = found.some((tool) => tool.dialect);
  return hasDialect ? found.filter((tool) => tool.value !== 'SQL') : found;
}

function detectSqlTasks(text: string): SqlTaskDefinition[] {
  if (/窗口函数|调优|性能优化|索引优化|存储过程|执行计划|复杂查询/.test(text)) {
    return [{ sqlType: 'unsupported', detail: '进阶 SQL' }];
  }

  const tasks: SqlTaskDefinition[] = [];
  if (/留存|retention/i.test(text)) {
    tasks.push({
      sqlType: 'retention',
      detail: /次日留存/.test(text) ? '次日留存' : '留存分析',
    });
  }
  if (/多表|联表|多张表|表连接|表关联|join|关联查询/i.test(text)) {
    tasks.push({ sqlType: 'join', detail: '多表连接' });
  }
  if (/去重|分组|聚合|汇总|统计|group\s*by|count\s*\(/i.test(text)) {
    const dedupe = /去重/.test(text);
    const group = /分组|聚合|汇总|group\s*by/i.test(text);
    tasks.push({
      sqlType: 'dedupe',
      detail: dedupe && group ? '去重与分组统计' : dedupe ? '去重统计' : '分组统计',
    });
  }
  if (tasks.length === 0 && /基础查询|条件查询|筛选|检索|查询/.test(text)) {
    tasks.push({ sqlType: 'basic', detail: '基础查询' });
  }
  if (tasks.length === 0) {
    tasks.push({ sqlType: 'broad' });
  }
  return tasks;
}

function cleanDuty(text: string): string {
  return text
    .replace(/^\s*(?:\d+[.、)]|[-•·])\s*/u, '')
    .replace(/[。；;，,\s]+$/u, '')
    .trim()
    .slice(0, 90);
}

export function extractItems(rawText: string, options: ExtractOptions = {}): ExtractedItem[] {
  const taskPatterns = new Map<string, TaskPattern>();
  for (const pattern of [...TASK_PATTERNS, ...APPROVED_TASK_PATTERNS, ...compileTaskPatterns(options.extraTaskPatterns ?? [])]) {
    if (!taskPatterns.has(pattern.key)) taskPatterns.set(pattern.key, pattern);
  }
  const sentences = splitPieces(rawText, SENTENCE_BREAK);
  const segments = splitPieces(rawText, SEGMENT_BREAK);
  const items: ExtractedItem[] = [];
  const seenSkills = new Set<string>();
  const seenDuties = new Set<string>();
  const seenTasks = new Set<string>();
  let graduationFound = false;
  let educationFound = false;
  let enrollmentFound = false;
  let majorFound = false;
  let daysFound = false;
  let durationFound = false;

  const push = (item: Omit<ExtractedItem, 'id' | 'manual' | 'source'>) => {
    items.push({ ...item, id: uid('auto'), manual: false, source: 'auto' });
  };

  for (const sentence of sentences) {
    for (const pattern of taskPatterns.values()) {
      if (seenTasks.has(pattern.key) || !pattern.test(sentence.text)) continue;
      seenTasks.add(pattern.key);
      const quote = cleanQuote(sentence.text) || sentence.text;
      push({
        field: 'task',
        value: pattern.label,
        detail: '岗位任务',
        taskKey: pattern.key,
        requirement: 'duty',
        quote,
      });
    }
  }

  for (const segment of segments) {
    const sentence = findSentence(sentences, segment.start);
    const text = segment.text;
    const quote = cleanQuote(text) || text;
    const countBefore = items.length;

    if (!graduationFound) {
      const yearMatch = text.match(/(20\d{2}|[2-3]\d)\s*届/);
      const yearAlt = text.match(/(20\d{2})\s*年(?:毕业|应届|及以后)/);
      if (yearMatch || yearAlt) {
        const rawYear = (yearMatch?.[1] ?? yearAlt?.[1]) as string;
        const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
        const preferred = PREFERRED.test(text);
        push({
          field: 'graduation',
          value: `${year} 届`,
          requirement: preferred ? 'preferred' : 'info',
          qualifier: preferred ? '优先' : undefined,
          quote,
          detail: preferred ? '优先考虑该届别' : '毕业届别',
        });
        graduationFound = true;
      }
    }

    if (!educationFound) {
      const educationMatch = text.match(/(统招|全日制)\s*(本科|硕士|博士|大专)(及以上)?/);
      if (educationMatch) {
        const value = `${educationMatch[1]}${educationMatch[2]}${educationMatch[3] ?? ''}`;
        push({
          field: 'education',
          value,
          requirement: 'info',
          quote,
          detail: '学历要求',
        });
        educationFound = true;
      }
    }

    if (!enrollmentFound && /在校生|在读/.test(text)) {
      push({
        field: 'enrollment',
        value: /在校生/.test(text) ? '在校生' : '在读',
        requirement: 'info',
        quote,
        detail: '在校状态',
      });
      enrollmentFound = true;
    }

    if (!majorFound && /相关专业|等专业/.test(text)) {
      const value = text.replace(/^\s*\d+[.、)]\s*/u, '').trim();
      if (value) {
        push({
          field: 'major',
          value,
          requirement: 'info',
          quote,
          detail: '相关专业',
        });
        majorFound = true;
      }
    }

    if (!daysFound) {
      const dayMatch = text.match(
        /(?:每周|一周|每(?:个)?星期)([^。；;\n，,]{0,16}?)([1-7一二三四五六七两])\s*(?:天|日)/,
      );
      if (dayMatch) {
        const qualifierMatch = dayMatch[1].match(/至少|最少|不少于|不低于/);
        push({
          field: 'days',
          value: dayMatch[0].replace(/\s+/g, ' ').trim(),
          requirement: 'info',
          qualifier: qualifierMatch?.[0],
          quote,
          detail: qualifierMatch ? '最低到岗要求' : '每周到岗',
        });
        daysFound = true;
      }
    }

    if (!durationFound && /实习|到岗|连续|实习期/.test(text)) {
      const rangeMatch = text.match(
        /(\d+|[一二三四五六七八九十两])\s*[-~至到]\s*(\d+)\s*个?\s*月/,
      );
      const singleMatch = text.match(/(\d+|[一二三四五六七八九十两])\s*个?\s*月/);
      const qualifierMatch = text.match(/至少|最少|不少于|不低于/);
      if (rangeMatch) {
        const from = parseCnNumber(rangeMatch[1]) ?? rangeMatch[1];
        push({
          field: 'duration',
          value: `${from}–${rangeMatch[2]} 个月`,
          requirement: 'info',
          qualifier: qualifierMatch?.[0],
          quote,
          detail: '连续实习时长',
        });
        durationFound = true;
      } else if (singleMatch) {
        const months = parseCnNumber(singleMatch[1]) ?? singleMatch[1];
        push({
          field: 'duration',
          value: `${qualifierMatch ? `${qualifierMatch[0]} ` : ''}${months} 个月`,
          requirement: 'info',
          qualifier: qualifierMatch?.[0],
          quote,
          detail: '连续实习时长',
        });
        durationFound = true;
      } else if (/长期|半年以上|一年以上/.test(text)) {
        const surface = text.match(/长期|半年以上|一年以上/)?.[0] ?? '长期';
        push({
          field: 'duration',
          value: surface,
          requirement: 'info',
          uncertain: true,
          quote,
          detail: '具体时长未写明',
        });
        durationFound = true;
      }
    }

    const tools = detectTools(text);
    const isPreferred = PREFERRED.test(text);
    const isDuty = DUTY.test(text);
    const implicitSqlTasks = tools.length === 0 ? detectImplicitSqlTasks(text) : [];

    const addToolSkills = (requirement: 'required' | 'preferred', qualifier?: string) => {
      for (const tool of tools) {
        if (tool.value === 'SQL') {
          for (const task of detectSqlTasks(sentence.text)) {
            const key = `${tool.value}:${requirement}:${task.sqlType}`;
            if (seenSkills.has(key)) continue;
            seenSkills.add(key);
            push({
              field: 'skill',
              value: 'SQL',
              detail: task.detail,
              requirement,
              qualifier,
              quote: cleanQuote(sentence.text) || quote,
              sqlType: task.sqlType,
            });
          }
        } else {
          const key = `${tool.value}:${requirement}`;
          if (seenSkills.has(key)) continue;
          seenSkills.add(key);
          push({
            field: 'skill',
            value: tool.value,
            requirement,
            qualifier,
            quote,
          });
        }
      }
    };

    const alternatives = explicitToolChoice(text, tools);
    if (alternatives.length) {
      push({
        field: 'skill', value: alternatives.join(' 或 '), alternatives,
        requirement: isPreferred ? 'preferred' : 'required',
        qualifier: isPreferred ? '优先' : undefined, quote,
      });
    } else if (tools.length > 0 && isPreferred) {
      addToolSkills('preferred', '优先');
    } else if (tools.length > 0 && STRONG_REQUIRED.test(text)) {
      addToolSkills('required');
    } else if (implicitSqlTasks.length > 0) {
      const requirement = isPreferred ? 'preferred' : 'required';
      for (const task of implicitSqlTasks) {
        const key = `SQL:${requirement}:${task.sqlType}`;
        if (seenSkills.has(key)) continue;
        seenSkills.add(key);
        push({
          field: 'skill',
          value: 'SQL',
          detail: task.detail,
          requirement,
          qualifier: isPreferred ? '优先' : undefined,
          quote,
          sqlType: task.sqlType,
        });
      }
    } else if (!tools.length && countBefore === items.length &&
      !items.some((item) => item.field === 'task' && item.quote.includes(quote)) &&
      (STRONG_REQUIRED.test(cleanDuty(text)) || isPreferred)) {
      push({
        field: 'skill', value: cleanDuty(text), uncertain: true,
        requirement: isPreferred ? 'preferred' : 'required',
        qualifier: isPreferred ? '优先' : undefined, quote,
      });
    } else if (isDuty) {
      const duty = cleanDuty(text);
      if (duty && !seenDuties.has(duty)) {
        seenDuties.add(duty);
        push({
          field: 'duty',
          value: duty,
          requirement: 'duty',
          quote,
        });
      }
    } else if (tools.length > 0) {
      addToolSkills('required');
    }
  }

  if (!graduationFound && /应届|毕业/.test(rawText)) {
    const sentence = sentences.find((item) => /应届|毕业/.test(item.text));
    if (sentence) {
      push({
        field: 'graduation',
        value: '应届生',
        requirement: 'info',
        uncertain: true,
        quote: cleanQuote(sentence.text) || sentence.text,
        detail: '未写明具体届别',
      });
    }
  }

  if (!daysFound) {
    const sentence = sentences.find((item) => /每周[^。；;\n]{0,12}(?:到岗|实习)/.test(item.text));
    if (sentence) {
      push({
        field: 'days',
        value: '每周到岗',
        requirement: 'info',
        uncertain: true,
        quote: cleanQuote(sentence.text) || sentence.text,
        detail: '未写明天数',
      });
    }
  }

  if (!durationFound) {
    const sentence = sentences.find((item) => /实习[^。；;\n]{0,16}(?:时长|期限)/.test(item.text));
    if (sentence) {
      push({
        field: 'duration',
        value: '实习时长',
        requirement: 'info',
        uncertain: true,
        quote: cleanQuote(sentence.text) || sentence.text,
        detail: '未写明具体月数',
      });
    }
  }

  const taskQuotes = items.filter((item) => item.field === 'task').map((item) => item.quote);
  return items.filter(
    (item) =>
      item.field !== 'duty' || !taskQuotes.some((quote) => quote.includes(item.quote)),
  );
}

export function extractionSummary(items: ExtractedItem[]): string {
  const required = items.filter((item) => item.requirement === 'required').length;
  const preferred = items.filter((item) => item.requirement === 'preferred').length;
  const tasks = items.filter((item) => item.field === 'task').length;
  const duties = items.filter((item) => item.field === 'duty').length;
  return `必需 ${required} · 加分 ${preferred} · 任务 ${tasks} · 职责 ${duties}`;
}
