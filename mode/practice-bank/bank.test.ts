import assert from 'node:assert/strict';
import type { Job, Profile } from '../../src/types';
import { extractItems } from '../../src/extract/extract';
import { evaluateJob } from '../../src/fit';
import { matchResume } from '../resume-match';
import { recommendForJob } from '../../src/recommend';
import { findMatchResultForItem } from '../match-session';
import { SCENARIO_BANK, scenarioForCapability } from './index';

const profile: Profile = {
  graduation: '',
  days: '',
  duration: '',
  sql: { basic: '', dedupe: '', join: '' },
};
const resume =
  '教育经历\n统计学本科在读，预计 2027 年毕业。\n项目经历\n参与活动页面改版讨论，整理用户反馈。';
const job = (id: string, rawText: string): Job => ({
  id,
  name: id,
  rawText,
  items: extractItems(rawText),
  extraction: 'ok',
});
const evaluate = (selected: Job, text = resume) =>
  matchResume(selected, evaluateJob(selected, profile), text);
const recommend = (selected: Job, text = resume) =>
  recommendForJob(selected, profile, evaluate(selected, text));

for (const scenario of SCENARIO_BANK) {
  assert.ok(scenario.id, '场景题必须有稳定 ID');
  assert.ok(scenario.discipline, `${scenario.id} 必须有方向标签`);
  assert.ok(['入门', '中等', '进阶'].includes(scenario.difficulty));
  assert.ok(scenario.prompt.length > 10);
  assert.ok(scenario.evaluationPoints.length >= 3 && scenario.evaluationPoints.length <= 5);
  assert.ok(scenario.sourceNote.length > 0);
  assert.ok(scenario.taskTags.length > 0);
}
assert.ok(SCENARIO_BANK.length >= 5, '至少覆盖五类场景');
assert.ok(SCENARIO_BANK.some((scenario) => scenario.id === 'sensor-debug-sample'), '应加载审核导出的新题');

const metricJob = job('metric', '负责监控支付转化率并排查异常波动，分析活动漏斗。');
const priorityJob = job('priority', '负责需求优先级排序和排期取舍。');
const prototypeJob = job('prototype', '根据用户反馈和可用性测试迭代原型、优化交互。');
const metricRecommendation = recommend(metricJob);
assert.equal(metricRecommendation.scenarioId, 'metric-anomaly');
assert.match(metricRecommendation.basis?.requirement ?? '', /转化率|异常|漏斗/);
const priorityRecommendation = recommend(priorityJob);
assert.equal(priorityRecommendation.scenarioId, 'requirement-priority');
assert.match(priorityRecommendation.basis?.requirement ?? '', /需求/);
const prototypeRecommendation = recommend(prototypeJob);
assert.equal(prototypeRecommendation.scenarioId, 'prototype-iteration');
assert.match(prototypeRecommendation.basis?.requirement ?? '', /可用性测试|用户反馈/);

const figmaOnly = job('figma-only', '熟悉 Figma。');
const figmaRecommendation = recommend(figmaOnly);
assert.equal(figmaRecommendation.scenarioId, undefined);
assert.equal(figmaRecommendation.label, '暂无对应练习');
assert.equal(
  scenarioForCapability('tool:figma:general', 'Figma'),
  null,
  '只有工具名不能匹配原型迭代题',
);
assert.equal(
  recommend(job('usability', '结合可用性测试优化交互。')).scenarioId,
  'prototype-iteration',
);
assert.equal(
  recommend(job('feedback', '根据用户反馈迭代原型。')).scenarioId,
  'prototype-iteration',
);

const funnelRecommendation = recommend(job('operations', '运营岗，明确要求分析活动漏斗。'));
assert.equal(funnelRecommendation.scenarioId, 'metric-anomaly');

const uncovered = job('uncovered', '熟悉 SQL。负责拆解业务问题并给出数据建议。');
const uncoveredRecommendation = recommend(uncovered);
assert.equal(uncoveredRecommendation.questionId, null);
assert.equal(uncoveredRecommendation.label, '暂无对应练习');
assert.match(uncoveredRecommendation.note ?? '', /暂未覆盖|拆解业务问题/);

const featureRecommendation = recommend(
  job('feature', '新功能上线后，如何判断它有没有解决用户问题。'),
);
assert.equal(featureRecommendation.scenarioId, 'feature-impact');
const mobileRecommendation = recommend(
  job('mobile', '负责移动端活动页的信息层级和视觉重点设计。'),
);
assert.equal(mobileRecommendation.scenarioId, 'mobile-hierarchy');

const twoTaskJob = job(
  'two-task',
  '负责监控支付转化率并排查异常波动。负责需求优先级排序和排期取舍。',
);
const twoTaskEvaluation = evaluate(twoTaskJob);
assert.equal(
  recommendForJob(twoTaskJob, profile, twoTaskEvaluation).scenarioId,
  'metric-anomaly',
  '同为缺口时按 JD 任务顺序选择',
);
const answeredMetric = matchResume(twoTaskJob, evaluateJob(twoTaskJob, profile), resume, {
  'cap:task:metric-anomaly': {
    kind: 'text',
    value: '我监控支付转化率，发现下降后按渠道拆解并定位原因。',
    updatedAt: new Date().toISOString(),
  },
});
assert.equal(
  recommendForJob(twoTaskJob, profile, answeredMetric).scenarioId,
  'requirement-priority',
  '补充证据后应优先推荐仍缺证的任务',
);
const priorityItem = twoTaskJob.items.find(
  (item) => item.field === 'task' && item.taskKey === 'requirement-priority',
);
const metricItem = twoTaskJob.items.find(
  (item) => item.field === 'task' && item.taskKey === 'metric-anomaly',
);
assert.ok(priorityItem && metricItem);
assert.equal(recommendForJob(twoTaskJob, profile, twoTaskEvaluation).scenarioId, 'metric-anomaly');
const selectedPriority = findMatchResultForItem(twoTaskEvaluation, priorityItem.id);
assert.equal(selectedPriority?.label, '需求排序');
assert.match(selectedPriority?.quote ?? '', /需求优先级排序/);
assert.equal(findMatchResultForItem(twoTaskEvaluation, 'missing-item'), null);
const selectedMetricWithSupplement = findMatchResultForItem(answeredMetric, metricItem.id);
const selectedPriorityWithSupplement = findMatchResultForItem(answeredMetric, priorityItem.id);
assert.equal(Boolean(selectedMetricWithSupplement?.supplement?.value), true);
assert.equal(selectedPriorityWithSupplement?.supplement, undefined, '另一行不能引用补充证据');

const integratedSensorJob = job('integrated-sensor', '负责传感器联调，并排查固件升级后设备间歇性掉线。');
const integratedSensorRecommendation = recommend(integratedSensorJob);
assert.equal(integratedSensorRecommendation.scenarioId, 'sensor-debug-sample');
assert.match(integratedSensorRecommendation.basis?.requirement ?? '', /传感器联调/);

const availabilityJob = job('availability', '每周至少到岗 3 天，连续实习至少 3 个月，2027 届优先。');
assert.equal(recommend(availabilityJob).label, '暂无对应练习', '时间条件不出题');

console.log('PASS: 五类场景题、任务优先推荐、工具名反例、漏斗复用、未覆盖任务与时间条件不出题');