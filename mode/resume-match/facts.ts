export type Section = '教育经历' | '技能' | '实践经历' | '其他';
export interface Source { text: string; section: Section; start: number; end: number }
export interface TaskFact { key: string; source: Source }
export interface ResumeFacts {
  sources: Source[];
  education: Source[];
  graduation: { year: string; source: Source }[];
  tasks: TaskFact[];
  tools: { name: string; source: Source }[];
}
const heading = /^(教育(?:经历|背景)|学历|专业技能|技能(?:特长|证书)?|技术栈|项目(?:经历|经验)|实习(?:经历|经验)|工作经历|实践经历|在校经历|校园经历|个人(?:信息|简介|总结)|基本信息|自我评价|求职意向)\s*(?=[:：]|$)/;
const privacy = /^(?:[\s•·-]*)(?:姓名|姓\s*名|电\s*话|手\s*机|电子邮箱|邮箱|联系方式|出生年月|性别|民族)\s*[:：]/;
const metric = /指标|转化率|留存率|点击率|销售额|流量|订单量|活跃率/;
const monitoring = /监控|监测|追踪|跟踪|周报|日报|月报|看板/;
const anomaly = /异常|下降|下滑|突增|波动|偏离/;
const diagnosis = /排查|定位.{0,16}原因|定位到|归因|验证.{0,12}原因|分析.{0,12}(?:原因|异常|波动)|找出.{0,12}原因/;
export const SQL = /\b(?:SQL|MySQL|PostgreSQL|SQLite|Oracle)\b/i;
const negative = /(?:未(?:曾|能|实际|完成|开展|做|参与|使用|涉及|负责|独立|对|进行|排查|分析|去重|定位)|没(?:有)?(?:做|排查|定位|使用|进行|参与|去重)|不曾|不会|无需|尚未|无.{0,5}经验|希望|计划(?:学习|开展)|仅了解|待学习|学习目标)/;
const attributedToOthers = /(?:团队|同事|队友|导师|组员|他人|项目组|同组成员)(?:共同)?(?:负责|完成|实现|开展|主导)|由(?:团队|同事|队友|导师|组员|他人|项目组|同组成员)/;
const abilityOnly = /^(?:[-•*\d.\s]+)?(?:熟悉|了解|掌握|精通|擅长|了解过)/;
export const action = /使用|用|通过|完成|实现|编写|开发|搭建|建立|设计|构建|制作|生成|执行|负责|分析|处理|排查|定位|追踪|监控|统计|清洗|去重|汇总|绘制|计算|撰写|对接|提出|优化|交付|推动/;

function sourceLines(text: string): Source[] {
  let section: Section = '其他';
  const output: Source[] = [];
  for (const match of text.matchAll(/[^\r\n；;。]+/g)) {
    const trimmed = match[0].trim();
    if (!trimmed || privacy.test(trimmed)) continue;
    const h = heading.exec(trimmed);
    const header = h?.[1] ?? '';
    if (h) section = /教育|学历/.test(header) ? '教育经历' : /技能|技术栈/.test(header) ? '技能'
      : /项目|实习|工作|实践|在校|校园/.test(header) ? '实践经历' : '其他';
    const value = h ? trimmed.slice(h[0].length).replace(/^[:：]\s*/, '') : trimmed;
    if (!value || privacy.test(value)) continue;
    const start = match.index + match[0].indexOf(trimmed) + trimmed.length - value.length;
    output.push({ text: value, section, start, end: start + value.length });
  }
  return output;
}

export function positiveParts(line: Source): Source[] {
  if (line.section === '技能' || line.section === '教育经历') return [];
  const clauses = [...line.text.matchAll(/[^，,]+/g)];
  const output: Source[] = [];
  let carry: Source | undefined;
  for (const clause of clauses) {
    const body = clause[0].trim();
    if (!body) continue;
    if (negative.test(body) || attributedToOthers.test(body) || abilityOnly.test(body)) {
      if (carry) output.push(carry);
      carry = undefined;
      continue;
    }
    const start = line.start + clause.index + clause[0].indexOf(body);
    const end = start + body.length;
    carry = carry ? { ...carry, end, text: line.text.slice(carry.start - line.start, end - line.start) }
      : { ...line, start, end, text: body };
  }
  if (carry) output.push(carry);
  return output;
}

export const usableMention = (line: Source): boolean => !negative.test(line.text) && !attributedToOthers.test(line.text);
const taskRules: Record<string, (t: string) => boolean> = {
  'task:metric-monitoring': (t) => metric.test(t) && monitoring.test(t),
  'task:metric-anomaly': (t) => metric.test(t) && anomaly.test(t) && diagnosis.test(t),
  'task:metric-system': (t) => /搭建|构建|设计|建立/.test(t) && /指标.{0,6}体系|指标口径/.test(t),
  'task:problem-decompose': (t) => /拆解|定位|分析/.test(t) && /业务问题/.test(t) && /建议|方案|策略/.test(t),
  'task:data-modeling': (t) => /沉淀|构建|设计|建立|开发/.test(t) && /数据模型|数据产品/.test(t),
  'task:business-collab': (t) => /业务方|相关团队/.test(t) && /沟通|对接|协作/.test(t) && /上线|落地|交付/.test(t),
  'task:requirement-priority': (t) =>
    /需求|功能/.test(t) && /优先级|排序|取舍|排期|RICE/.test(t),
  'task:feature-impact': (t) =>
    /功能|产品|上线/.test(t) && /效果|影响|价值|成功指标/.test(t) && /衡量|评估|验证|判断|实验|A\/B|AB/.test(t),
  'task:prototype-iteration': (t) =>
    /可用性测试|用户测试|用户反馈|用户访谈/.test(t) &&
    /原型|交互|页面|流程/.test(t) &&
    /优化|迭代|调整|改进|修改/.test(t),
  'task:mobile-hierarchy': (t) =>
    /移动端|手机端|活动页|落地页|报名页|H5/.test(t) &&
    /信息层级|视觉层级|信息架构|内容层级|页面信息|信息太多|快速理解|报名按钮|视觉重点/.test(t),
  'task:funnel-analysis': (t) =>
    /漏斗|转化路径|转化环节/.test(t) && /分析|拆解|优化|监控|提升|排查/.test(t),
  'sql:dedupe': (t) => SQL.test(t) && /去重|count\s*\(\s*distinct/i.test(t),
  'sql:join': (t) => SQL.test(t) && /联表|关联查询|多表|\bjoin\b/i.test(t),
  'sql:basic': (t) => SQL.test(t) && /查询|筛选|检索|\bselect\b/i.test(t),
  'sql:retention': (t) => SQL.test(t) && /留存/.test(t) && /计算|分析|统计|跟踪/.test(t),
};
export const knownTask = (key: string): boolean => Object.hasOwn(taskRules, key);

const toolNames = ['SQL', 'MySQL', 'PostgreSQL', 'SQLite', 'Oracle', 'Python', 'Excel', 'Power BI', 'Tableau', 'SPSS', 'SAS', 'Stata', 'Hive', 'Spark', 'Hadoop', 'R', 'Git', 'Linux', 'Java', 'C++'];
function matchesTool(text: string, label: string): boolean {
  if (label === 'Excel' && /电子表格/.test(text)) return true;
  if (label === 'Power BI' && /\bpower\s*bi\b/i.test(text)) return true;
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![a-z\\d])${escaped}(?![a-z\\d])`, label === 'R' ? '' : 'i').test(text);
}
export function extractResumeFacts(text: string): ResumeFacts {
  const sources = sourceLines(text);
  const education = sources.filter(({ text, section }) => section === '教育经历' || /学历|学位|(?:本科|硕士|博士)在读|在校生|统招/.test(text));
  const graduation = sources.flatMap((source) => {
    const year = /(?:预计|预期)?\s*(20\d{2})\s*年\s*(?:\d{1,2}\s*月\s*)?(?:预计\s*)?毕业|(?:预计|预期)?毕业(?:时间)?\s*[:：]?\s*(20\d{2})|(?:^|[\s，,：:（(])(20\d{2})\s*届(?:\s*毕业生)?/.exec(source.text)?.slice(1).find(Boolean);
    if (source.section === '实践经历' || source.section === '技能' || !year || /预计取消|无法毕业|未毕业/.test(source.text)) return [];
    return [{ year, source }];
  });
  const tasks: TaskFact[] = [];
  const seen = new Set<string>();
  for (const line of sources.flatMap(positiveParts)) {
    for (const [key, test] of Object.entries(taskRules)) {
      if (!test(line.text)) continue;
      const id = key + ':' + line.text.normalize('NFKC').replace(/\s+/g, ' ').trim();
      if (seen.has(id)) continue;
      seen.add(id);
      tasks.push({ key, source: line });
    }
  }
  const tools = toolNames.flatMap((name) => {
    const source = sources.find((line) => usableMention(line) && matchesTool(line.text, name));
    return source ? [{ name, source }] : [];
  });
  return { sources, education, graduation, tasks, tools };
}
