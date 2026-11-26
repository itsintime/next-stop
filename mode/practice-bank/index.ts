import type { Scenario } from '../../src/types';
import { APPROVED_SCENARIOS } from './tasks';
export { ALL_TASKS, APPROVED_SCENARIOS, APPROVED_TASKS, BUILT_IN_TASKS, officialTaskIds, taskById } from './tasks';
export type { TaskDefinition } from './tasks';

const metricAnomaly: Scenario = {
  id: 'metric-anomaly',
  title: '支付转化率异常排查',
  typeLabel: '开放场景题 · 不自动打分',
  discipline: '数据分析',
  difficulty: '中等',
  taskTags: ['task:metric-anomaly', 'task:funnel-analysis'],
  prompt:
    '某业务支付转化率一周内突然下降。你会先核对哪些指标口径、按哪些维度拆解影响范围，以及如何验证原因？',
  referencePoints: [
    '先核对支付转化率的分子、分母、统计口径、时间窗口、数据延迟和埋点质量。',
    '按渠道、设备、地区、新老用户和支付漏斗环节拆解，定位下降集中在哪里。',
    '对比历史同期、对照组和结构变化，区分数据问题、结构性变化与真实业务变化。',
    '提出可验证假设，补充监控指标，并给出下一步行动建议。',
  ],
  evaluationPoints: [
    '先校验口径和数据质量，而不是直接归因到业务。',
    '能按至少两个合理维度拆解影响范围，并说明拆分依据。',
    '能提出可验证的假设和验证方式，区分数据异常、结构变化与真实业务变化。',
    '给出后续监控指标和可执行建议，并说明结论的边界。',
  ],
  followUps: [
    '如果支付成功率正常，但下单转化率下降，你会优先检查哪一段漏斗？',
    '你如何判断是统计口径变化，还是用户行为真的发生了变化？',
  ],
  selfCheck: [
    '我是否先校验口径和数据质量，而不是直接归因？',
    '我是否按维度拆解，并说明每个维度要验证什么？',
    '我是否给出可执行建议和后续监控方式？',
  ],
  sourceNote: '虚构校园活动支付场景，依据常见漏斗与异常分析方法编写，不对应真实公司数据。',
};

const requirementPriority: Scenario = {
  id: 'requirement-priority',
  title: '需求排序取舍',
  typeLabel: '开放场景题 · 不自动打分',
  discipline: '产品',
  difficulty: '中等',
  taskTags: ['task:requirement-priority'],
  prompt:
    '本周排期只能完成一个需求：A 提升报名转化，B 修复活动页的关键可用性问题，C 为运营提供数据看板。你会如何取舍？',
  referencePoints: [
    '先明确当前阶段目标和用户群体，区分增长、体验和内部效率三类价值。',
    '评估每个需求的影响范围、紧急程度、实现成本、依赖和风险。',
    '用可解释的优先级方法（如价值/成本、机会成本或 RICE）形成排序，并说明假设。',
    '给出取舍结论、验证方式和与业务方的沟通计划。',
  ],
  evaluationPoints: [
    '目标明确，能说明当前阶段最需要解决的用户或业务问题。',
    '比较了需求的价值、成本、风险或依赖，而不是只凭声音大小排序。',
    '给出清晰的取舍结论和优先级依据。',
    '说明上线后的验证指标和后续处理其他需求的方式。',
  ],
  followUps: [
    '如果 B 的可用性问题会直接影响 A 的转化，你会怎样重新排序？',
    '当业务方坚持另一个需求时，你会用什么信息推进共识？',
  ],
  selfCheck: [
    '我是否先说明目标和判断标准？',
    '我是否同时考虑了用户价值、成本和风险？',
    '我的结论是否可执行，并能被验证？',
  ],
  sourceNote: '虚构校园活动产品场景，用于练习需求评估与取舍，不涉及真实排期或公司数据。',
};

const featureImpact: Scenario = {
  id: 'feature-impact',
  title: '衡量功能效果',
  typeLabel: '开放场景题 · 不自动打分',
  discipline: '产品',
  difficulty: '中等',
  taskTags: ['task:feature-impact'],
  prompt:
    '活动报名页上线了「一键收藏活动」功能。你会如何判断它有没有解决用户问题，并决定是否继续迭代？',
  referencePoints: [
    '先明确功能要解决的用户问题、目标用户和成功假设。',
    '定义主指标、辅助指标和护栏指标，例如收藏率、报名转化、取消率和留存。',
    '设计前后对比、分群观察或 A/B 测试，控制季节性和渠道变化。',
    '结合行为数据、用户反馈和定性观察解释指标变化，形成继续、调整或回退的结论。',
  ],
  evaluationPoints: [
    '能把功能效果连接到明确的用户问题和成功假设。',
    '定义了主指标、护栏指标和合理的观察窗口。',
    '说明了对比方式、分群或实验设计，并考虑外部变化。',
    '能结合定量与定性证据给出迭代或回退建议。',
  ],
  followUps: [
    '如果收藏率高但报名转化没有变化，你会怎样解释？',
    '你会设置什么护栏指标，防止功能带来负面体验？',
  ],
  selfCheck: [
    '我是否先定义用户问题和成功标准？',
    '我是否同时考虑主指标与护栏指标？',
    '我的结论是否能指导下一步产品动作？',
  ],
  sourceNote: '虚构校园活动功能场景，用于练习功能效果衡量，不包含真实用户数据。',
};

const prototypeIteration: Scenario = {
  id: 'prototype-iteration',
  title: '根据反馈迭代原型',
  typeLabel: '开放场景题 · 不自动打分',
  discipline: '视觉设计',
  difficulty: '中等',
  taskTags: ['task:prototype-iteration'],
  prompt:
    '用户反馈在活动页面找不到报名按钮。你会如何确认原因、调整原型，并验证修改是否有效？',
  referencePoints: [
    '先通过可用性测试、访谈或行为记录复现问题，确认用户卡在哪一步。',
    '检查信息架构、视觉层级、按钮文案、对比度和交互路径，形成具体原因假设。',
    '制作原型变体，优先调整最影响任务完成的层级和入口，并保留其他变量。',
    '用任务完成率、寻找时间、误点击和定性反馈验证，再决定是否继续迭代。',
  ],
  evaluationPoints: [
    '先验证问题而不是直接改视觉样式。',
    '能从信息层级、入口位置、文案或交互路径提出具体原因假设。',
    '原型调整针对根因，并说明设计取舍。',
    '用可观察的完成率、时间或反馈验证修改效果。',
  ],
  followUps: [
    '如果用户能找到按钮但不愿意点击，你的排查方向会怎样变化？',
    '你会如何避免只改颜色，而没有解决信息层级问题？',
  ],
  selfCheck: [
    '我是否先复现问题并确认原因？',
    '我的修改是否针对具体根因？',
    '我是否定义了验证修改效果的方法？',
  ],
  sourceNote: '虚构校园活动报名页场景，用于练习原型反馈迭代，不引用真实产品或用户资料。',
};

const mobileHierarchy: Scenario = {
  id: 'mobile-hierarchy',
  title: '移动端信息层级',
  typeLabel: '开放场景题 · 不自动打分',
  discipline: '视觉设计',
  difficulty: '中等',
  taskTags: ['task:mobile-hierarchy'],
  prompt:
    '活动页在手机上信息太多，用户看不完就离开。你会如何安排内容和视觉层级，让用户快速理解并完成报名？',
  referencePoints: [
    '先确定页面唯一主任务和用户完成报名所需的最少信息。',
    '按信息重要性分层，合并次要内容，把关键时间、地点、价值和报名入口放在首屏清晰位置。',
    '通过字号、留白、对比、分组和视觉动线建立层级，并保证移动端触控尺寸与可读性。',
    '用首屏理解、报名按钮发现率、任务完成率和滚动深度等指标验证，再迭代。',
  ],
  evaluationPoints: [
    '明确页面主任务，并识别报名所需的关键信息。',
    '能对内容分级、合并或延后，而不是简单删减全部信息。',
    '使用视觉层级、分组、留白或动线帮助用户快速理解。',
    '说明移动端可用性约束和验证效果的方法。',
  ],
  followUps: [
    '如果报名按钮必须保留在首屏，你会如何压缩其他信息？',
    '你会用什么方式验证用户真的理解了活动价值？',
  ],
  selfCheck: [
    '我是否先明确页面的唯一主任务？',
    '我的信息层级是否能引导用户完成报名？',
    '我是否考虑了移动端可读性和验证方式？',
  ],
  sourceNote: '虚构校园活动移动端页面，用于练习信息层级与视觉组织，不对应真实品牌。',
};

export const BUILT_IN_SCENARIOS: Scenario[] = [
  metricAnomaly,
  requirementPriority,
  featureImpact,
  prototypeIteration,
  mobileHierarchy,
];

const builtInIds = new Set(BUILT_IN_SCENARIOS.map((scenario) => scenario.id));
export const SCENARIO_BANK: Scenario[] = [
  ...BUILT_IN_SCENARIOS,
  ...APPROVED_SCENARIOS.filter((scenario) => !builtInIds.has(scenario.id)),
];

const taskToScenario = new Map<string, Scenario>();
for (const scenario of SCENARIO_BANK) {
  for (const tag of scenario.taskTags) taskToScenario.set(tag, scenario);
}

export function scenarioForTask(taskKey: string): Scenario | null {
  return taskToScenario.get(taskKey) ?? null;
}

export function scenarioForCapability(key: string, label: string): Scenario | null {
  const byTask = scenarioForTask(key);
  if (byTask) return byTask;
  if (/排查指标异常|监控指标并排查异常|漏斗分析/.test(label)) return metricAnomaly;
  if (/需求排序|需求优先级|需求取舍/.test(label)) return requirementPriority;
  if (/衡量功能效果|功能效果评估/.test(label)) return featureImpact;
  if (/根据反馈迭代原型|可用性测试.*(?:交互|原型)|用户反馈.*(?:交互|原型)/.test(label)) {
    return prototypeIteration;
  }
  if (/移动端信息层级|信息层级设计/.test(label)) return mobileHierarchy;
  return null;
}

export function scenarioById(id: string): Scenario | null {
  return SCENARIO_BANK.find((scenario) => scenario.id === id) ?? null;
}