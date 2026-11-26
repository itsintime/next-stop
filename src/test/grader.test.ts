import assert from 'node:assert/strict';
import path from 'node:path';
import initSqlJs from 'sql.js';
import { QUESTIONS, QUESTION_LIST } from '../data/questions';
import { buildDatasetPayloads, gradeDataset, rowsMatch, validateSql } from '../grading/grade';
import { extractItems } from '../extract/extract';
import { evaluateJob } from '../fit';
import { recommendForJob } from '../recommend';
import { SAMPLE_A_TEXT, SAMPLE_B_TEXT } from '../data/samples';
import type { Job, Profile } from '../types';

const REFERENCE_SQL: Record<number, string> = {
  1: "SELECT event_id, event_name FROM events WHERE city = '上海' ORDER BY event_id;",
  2: 'SELECT event_id, COUNT(DISTINCT student_id) AS student_count FROM signups WHERE student_id IS NOT NULL GROUP BY event_id ORDER BY event_id;',
  3: `SELECT e.event_id, e.event_name
      FROM events e
      LEFT JOIN signups s ON s.event_id = e.event_id AND s.student_id IS NOT NULL
      WHERE s.signup_id IS NULL
      ORDER BY e.event_id;`,
};

async function main() {
  const SQL = await initSqlJs({
    locateFile: (file: string) => path.join(process.cwd(), 'node_modules/sql.js/dist', file),
  });

  for (const question of QUESTION_LIST) {
    for (const payload of buildDatasetPayloads(question)) {
      const result = gradeDataset(SQL, payload, REFERENCE_SQL[question.id]);
      assert.equal(
        result.state,
        'match',
        `题 ${question.id} / ${payload.dataset.label} 的期望结果与参考查询不一致：${result.error ?? ''}`,
      );
    }
  }
  console.log('PASS: 三题参考解在公开与独立判题数据上均与期望结果一致');

  const q2Alternative =
    'SELECT event_id, COUNT(*) AS student_count FROM (SELECT DISTINCT event_id, student_id FROM signups WHERE student_id IS NOT NULL) GROUP BY event_id;';
  for (const payload of buildDatasetPayloads(QUESTIONS[2])) {
    assert.equal(gradeDataset(SQL, payload, q2Alternative).state, 'match', '题 2 等价解应通过');
  }
  console.log('PASS: 题 2 等价去重写法通过');

  const q3NotExists =
    'SELECT e.event_id, e.event_name FROM events e WHERE NOT EXISTS (SELECT 1 FROM signups s WHERE s.event_id = e.event_id AND s.student_id IS NOT NULL);';
  for (const payload of buildDatasetPayloads(QUESTIONS[3])) {
    assert.equal(gradeDataset(SQL, payload, q3NotExists).state, 'match', '题 3 NOT EXISTS 应通过');
  }
  console.log('PASS: 题 3 NOT EXISTS 等价解通过');

  const q2NaivePayload = buildDatasetPayloads(QUESTIONS[2]);
  const q2NaivePublic = q2NaivePayload[0];
  const q2NaiveHidden = q2NaivePayload[1];
  const naive = 'SELECT event_id, COUNT(*) AS student_count FROM signups GROUP BY event_id;';
  assert.equal(gradeDataset(SQL, q2NaivePublic, naive).state, 'match', '漏去重写法应恰好通过公开样例');
  assert.equal(gradeDataset(SQL, q2NaiveHidden, naive).state, 'mismatch', '漏去重写法应在判题数据上失败');
  console.log('PASS: 题 2 漏去重解公开通过、判题失败');

  const distinctNoFilter =
    'SELECT event_id, COUNT(DISTINCT student_id) AS student_count FROM signups GROUP BY event_id;';
  assert.equal(gradeDataset(SQL, q2NaiveHidden, distinctNoFilter).state, 'mismatch', '未过滤空 ID 应失败');
  console.log('PASS: 题 2 未过滤空学生 ID 的解法失败');

  const q3BrokenJoin =
    'SELECT e.event_id, e.event_name FROM events e LEFT JOIN signups s ON s.event_id = e.event_id WHERE s.signup_id IS NULL OR s.student_id IS NULL;';
  assert.equal(gradeDataset(SQL, q2NaivePayload[1], q3BrokenJoin).state, 'mismatch', '题 3 错误连接条件应失败');
  console.log('PASS: 题 3 错误连接条件失败');

  assert.equal(rowsMatch([[1], [1]], [[1], [1]]), true);
  assert.equal(rowsMatch([[1], [1]], [[1]]), false);
  assert.equal(rowsMatch([[1, 2], [2, 1]], [[2, 1], [1, 2]]), true);
  assert.equal(rowsMatch([[1, '2']], [[1, 2]]), true);
  console.log('PASS: 行顺序无关、重复行与数字字符串归一化比较正确');

  assert.equal(validateSql('SELECT 1'), null);
  assert.ok(validateSql('DELETE FROM events'));
  assert.ok(validateSql('SELECT 1; DROP TABLE events;'));
  assert.equal(validateSql("SELECT ';' AS semi"), null);
  assert.ok(validateSql('PRAGMA table_info(events)'));
  console.log('PASS: 只读与单语句校验正确');

  const aItems = extractItems(SAMPLE_A_TEXT);
  const aSql = aItems.find((item) => item.value === 'SQL');
  const aPython = aItems.find((item) => item.value === 'Python');
  assert.equal(aSql?.sqlType, 'dedupe', '示例 A 应识别为去重');
  assert.equal(aSql?.requirement, 'required');
  assert.equal(aPython?.requirement, 'preferred', '示例 A 的 Python 应为加分项');
  assert.ok(aItems.some((item) => item.field === 'graduation' && item.value === '2027 届'));
  assert.ok(aItems.some((item) => item.field === 'days' && item.value.includes('3 天')));
  assert.ok(aItems.some((item) => item.field === 'duration' && item.value.includes('3 个月')));
  console.log('PASS: 示例 A 自由提取结果正确');

  const bItems = extractItems(SAMPLE_B_TEXT);
  const bSql = bItems.find((item) => item.value === 'SQL');
  const bGrad = bItems.find((item) => item.field === 'graduation');
  const bDuty = bItems.find((item) => item.value.includes('Excel'));
  assert.equal(bSql?.sqlType, 'join', '示例 B 应识别为多表连接');
  assert.equal(bGrad?.requirement, 'preferred', '示例 B 的 2028 届应为优先');
  assert.equal(bDuty?.field, 'duty', 'Excel 应归类为职责');
  assert.equal(bItems.some((item) => item.requirement === 'required' && item.value === 'Excel'), false);
  assert.equal(bItems.some((item) => item.field === 'duration'), false, '示例 B 未说明实习时长');
  console.log('PASS: 示例 B 自由提取分类正确');

  const custom = extractItems(
    '2026 届，每周至少到岗 4 天，连续实习至少 6 个月。要求熟悉 SQL 基础查询；有 Tableau 经验优先。协助整理活动报名表。',
  );
  assert.ok(custom.some((item) => item.value === 'SQL' && item.sqlType === 'basic'));
  assert.ok(custom.some((item) => item.value === 'Tableau' && item.requirement === 'preferred'));
  assert.ok(custom.some((item) => item.field === 'duty' && item.value.includes('报名表')));
  console.log('PASS: 自由粘贴 JD 提取正确');

  const makeJob = (id: string, rawText: string): Job => ({
    id,
    name: id,
    rawText,
    extraction: 'ok',
    items: extractItems(rawText),
  });
  const profile: Profile = {
    graduation: '',
    days: '3',
    duration: '',
    sql: { basic: 'independent', dedupe: 'aware', join: '' },
  };

  const acceptanceJob = makeJob(
    'accept-a',
    '每周至少到岗 4 天，要求能对报名数据做分组去重；有 Python 经验优先。',
  );
  assert.ok(
    acceptanceJob.items.some((item) => item.sqlType === 'dedupe' && item.requirement === 'required'),
    '未写 SQL 字样时也应识别分组去重任务',
  );
  const firstFit = evaluateJob(acceptanceJob, profile);
  assert.equal(firstFit.unmet.some((result) => result.id.startsWith('item:') && result.label === '每周到岗'), true);
  assert.equal(firstFit.weakSkills.length, 1, '去重自评应产生 1 项待补强');
  assert.match(firstFit.headline, /到岗要求不满足/);
  assert.match(firstFit.headline, /1 项 SQL 能力待补强/);
  assert.equal(
    firstFit.results.some((result) => result.label === '连续实习' && result.requirement === 'JD 未说明'),
    true,
    '未写实习时长应标为 JD 未说明',
  );
  assert.equal(
    firstFit.results.some((result) => result.requirement.includes('Python') && result.status === 'bonus'),
    true,
    'Python 优先应为加分项',
  );
  const dedupeRow = firstFit.weakSkills[0];
  assert.equal(dedupeRow.verdict, '需要补强');
  assert.equal(dedupeRow.questionId, 2);
  const recommendation = recommendForJob(acceptanceJob, profile);
  assert.equal(recommendation.questionId, 2, '去重薄弱项应推荐题 2');
  assert.match(recommendation.basis?.requirement ?? '', /分组去重/);
  console.log('PASS: 验收 A 的提取、逐项判断、总览与推荐依据正确');

  const daysMet = evaluateJob(acceptanceJob, { ...profile, days: '4' });
  assert.equal(
    daysMet.results.some((result) => result.label === '每周到岗' && result.status === 'meet'),
    true,
    '到岗改为 4 天后应满足',
  );
  assert.doesNotMatch(daysMet.headline, /到岗要求不满足/);
  const correctedItems = acceptanceJob.items.map((item) =>
    item.field === 'days' ? { ...item, value: '每周至少到岗 5 天', manual: true, source: 'manual' as const } : item,
  );
  const corrected = evaluateJob({ ...acceptanceJob, items: correctedItems }, { ...profile, days: '4' });
  const correctedDays = corrected.results.find((result) => result.label === '每周到岗');
  assert.equal(correctedDays?.status, 'unmet', '更正为 5 天后应恢复不满足');
  assert.match(correctedDays?.requirement ?? '', /5 天/);
  assert.doesNotMatch(correctedDays?.requirement ?? '', /4 天/);
  console.log('PASS: 验收 B 的资料重判与手动更正只采用新值');

  const noSqlJob = makeJob('no-sql', '协助维护 Excel 报表，整理活动数据，工作细致。');
  const noSqlRecommendation = recommendForJob(noSqlJob, profile);
  assert.equal(noSqlRecommendation.questionId, null);
  assert.equal(noSqlRecommendation.label, '暂无对应练习');
  const noSqlFit = evaluateJob(noSqlJob, profile);
  assert.ok(noSqlFit.results.length > 0, '没有 SQL 题也应能分析岗位');
  console.log('PASS: 验收 E 的无对应题目岗位仍可分析且不强行推荐');

  const broadJob = makeJob('broad-sql', '要求熟悉 SQL，协助整理活动数据。');
  const broadRecommendation = recommendForJob(broadJob, profile);
  assert.equal(broadRecommendation.questionId, 1);
  assert.equal(broadRecommendation.kind, 'broad');
  assert.equal(broadRecommendation.note, 'JD 未说明具体任务');
  console.log('PASS: 宽泛 SQL 要求只推荐基础自测并标明任务未说明');

  const excelJob = makeJob(
    'excel-pivot',
    '每周至少到岗 3 天。要求熟练使用 Excel 透视表，能独立制作活动汇总报表；有 Python 经验优先。',
  );
  const excelFit = evaluateJob(excelJob, profile);
  const excelCapability = excelFit.capabilities.find((capability) => capability.key === 'excel:pivot');
  assert.ok(excelCapability, 'Excel 透视表应生成独立能力项');
  assert.match(excelCapability?.quote ?? '', /Excel 透视表/);
  assert.notEqual(excelCapability?.key, 'sql:dedupe');
  const excelRequirement = excelFit.results.find((result) => result.id === 'cap:excel:pivot');
  assert.equal(excelRequirement?.exercise?.state, 'none');
  assert.equal(excelRequirement?.exercise?.label, '暂无对应练习');
  const excelRecommendation = recommendForJob(excelJob, profile, excelFit);
  assert.equal(excelRecommendation.questionId, null);
  assert.equal(excelRecommendation.label, '暂无对应练习');
  assert.match(excelRecommendation.note ?? '', /Excel|透视表/);

  const answers = {
    'excel:pivot': { level: 'none' as const, updatedAt: new Date().toISOString() },
    'sql:dedupe': { level: 'aware' as const, updatedAt: new Date().toISOString() },
  };
  const excelNoneFit = evaluateJob(excelJob, profile, answers);
  const excelNoneRow = excelNoneFit.results.find((result) => result.id === 'cap:excel:pivot');
  assert.equal(excelNoneRow?.status, 'unmet');
  assert.equal(excelNoneRow?.verdict, '需要补强');
  assert.equal(excelNoneRow?.profileValue, '没做过');

  const excelIndependentFit = evaluateJob(excelJob, profile, {
    ...answers,
    'excel:pivot': { level: 'independent', updatedAt: new Date().toISOString() },
  });
  const excelIndependentRow = excelIndependentFit.results.find(
    (result) => result.id === 'cap:excel:pivot',
  );
  assert.equal(excelIndependentRow?.status, 'meet');
  assert.equal(excelIndependentRow?.verdict, '自评符合');
  assert.equal(excelIndependentRow?.profileValue, '能独立完成');

  const sqlFit = evaluateJob(acceptanceJob, profile, answers);
  const sqlRequirement = sqlFit.results.find((result) => result.id === 'cap:sql:dedupe');
  assert.ok(sqlRequirement, 'SQL 去重应生成独立能力项');
  assert.equal(sqlRequirement?.profileValue, '需要参考');
  assert.equal(sqlRequirement?.exercise?.state, 'linked');
  assert.equal(sqlRequirement?.exercise?.label, '题 2 · 分组去重');
  const sqlRecommendation = recommendForJob(acceptanceJob, profile, sqlFit);
  assert.equal(sqlRecommendation.questionId, 2);
  assert.equal(sqlRecommendation.basis?.requirement, sqlRequirement?.quote);
  assert.equal(sqlRecommendation.basis?.answer, '需要参考');

  const sqlAfterExcelChange = evaluateJob(acceptanceJob, profile, {
    ...answers,
    'excel:pivot': { level: 'independent', updatedAt: new Date().toISOString() },
  }).results.find((result) => result.id === 'cap:sql:dedupe');
  assert.equal(
    sqlAfterExcelChange?.profileValue,
    '需要参考',
    '修改 Excel 能力不应改变 SQL 去重答案',
  );

  const sharedExcelJob = makeJob('excel-shared', '负责使用 Excel 透视表按渠道汇总数据。');
  const sharedExcelFit = evaluateJob(sharedExcelJob, profile, {
    'excel:pivot': { level: 'independent', updatedAt: new Date().toISOString() },
  });
  assert.equal(
    sharedExcelFit.capabilities.find((capability) => capability.key === 'excel:pivot')?.answer,
    'independent',
    '相同能力含义应复用已有回答',
  );
  console.log('PASS: 能力项按语义生成、答案驱动判断，Excel 与 SQL 答案互不影响并被同能力岗位复用');

  const realJdText = `工作内容:
1. 构建指标与数据分析体系，建立完整、科学的数据化运营体系；
2. 深入理解业务需求，通过数据分析为业务决策、产品方向、运营策略提供数据分析支持；完成对业务关键指标的监控及异常波动等分析工作，并不断主动思考、反馈数据发现的各类业务问题，推进解决优化；
3. 定期归纳总结、复盘，将有效的分析框架快速沉淀为数据模型、数据产品，提升相关团队作业效率；
4. 积极和业务方充分沟通，结主动发掘和探索业务的机会点，基于数据输出相关分析和建议，并积极推动落地。

任职资格:
1. 统招本科及以上学历在校生，27届优先；
2. 统计学、应用数学、经济、商业分析、运筹学、信息管理等相关专业；
3. 掌握数据获取、处理、建模分析、可视化等相关能力，掌握SQL、Python、R、SPSS、Power BI、Tableau等；
4. 具有良好的逻辑能力，能够独立的拆解、分析问题，并根据数据等信息对业务的实际发展提供支持；
5. 符合京东价值观：客户为先、创新、拼搏、担当、感恩、诚信。`;
  const realJob = makeJob('real-jd', realJdText);
  const gradItem = realJob.items.find((item) => item.field === 'graduation');
  assert.equal(gradItem?.value, '2027 届');
  assert.equal(gradItem?.requirement, 'preferred');
  assert.equal(realJob.items.find((item) => item.field === 'education')?.value, '统招本科及以上');
  assert.equal(realJob.items.find((item) => item.field === 'enrollment')?.value, '在校生');
  assert.match(realJob.items.find((item) => item.field === 'major')?.value ?? '', /统计学.*信息管理/);
  const taskValues = realJob.items.filter((item) => item.field === 'task').map((item) => item.value);
  for (const task of ['搭建业务指标体系', '排查指标异常', '拆解业务问题并给出数据建议']) {
    assert.ok(taskValues.includes(task), `真实 JD 应提取任务：${task}`);
  }
  const realSkills = realJob.items.filter((item) => item.field === 'skill').map((item) => item.value);
  for (const skill of ['SQL', 'Python', 'R', 'SPSS', 'Power BI', 'Tableau']) {
    assert.ok(realSkills.includes(skill), `真实 JD 应提取技能：${skill}`);
  }

  const realFit = evaluateJob(realJob, profile);
  const realCapabilityKeys = realFit.capabilities.map((capability) => capability.key);
  for (const key of [
    'task:metric-system',
    'task:metric-anomaly',
    'task:problem-decompose',
    'sql:broad',
    'tool:python:general',
    'tool:r:general',
    'tool:spss:general',
    'tool:power-bi:general',
    'tool:tableau:general',
  ]) {
    assert.ok(realCapabilityKeys.includes(key), `真实 JD 应生成能力项：${key}`);
  }
  assert.equal(
    realFit.capabilities.find((capability) => capability.key === 'sql:broad')?.uncertain,
    true,
  );
  for (const key of realCapabilityKeys.filter((entry) => entry.startsWith('tool:'))) {
    const capability = realFit.capabilities.find((entry) => entry.key === key);
    assert.equal(capability?.role, 'tool');
    assert.equal(capability?.toolSet, true, '工具组不推断单项必会');
  }
  assert.equal(
    realFit.results.find((result) => result.label === '毕业届别')?.status,
    'bonus',
    '2027 届优先不应是硬门槛',
  );
  assert.ok(realFit.results.some((result) => result.label === '学历要求'));
  assert.ok(realFit.results.some((result) => result.label === '在校状态'));
  assert.ok(realFit.results.some((result) => result.label === '相关专业'));
  assert.ok(
    realFit.capabilities.every((capability) => capability.quote.trim().length > 0),
    '真实 JD 的能力项都应保留原文依据',
  );

  const metricCapability = realFit.capabilities.find((capability) => capability.key === 'task:metric-anomaly');
  assert.match(metricCapability?.quote ?? '', /监控及异常波动/);
  const metricUnansweredRow = realFit.results.find(
    (result) => result.id === 'cap:task:metric-anomaly',
  );
  assert.equal(metricUnansweredRow?.status, 'info');
  assert.equal(metricUnansweredRow?.verdict, '信息不足');
  assert.equal(realFit.unmet.some((result) => result.label === '排查指标异常'), false);
  const realRecommendation = recommendForJob(realJob, profile, realFit);
  assert.equal(realRecommendation.kind, 'scenario');
  assert.equal(realRecommendation.scenarioId, 'metric-anomaly');
  assert.match(realRecommendation.basis?.requirement ?? '', /监控及异常波动/);

  const metricNoneFit = evaluateJob(realJob, profile, {
    'task:metric-anomaly': { level: 'none', updatedAt: new Date().toISOString() },
  });
  const metricNoneRow = metricNoneFit.results.find(
    (result) => result.id === 'cap:task:metric-anomaly',
  );
  assert.equal(metricNoneRow?.status, 'unmet');
  assert.equal(metricNoneRow?.verdict, '需要补强');
  assert.equal(metricNoneRow?.profileValue, '没做过');
  const metricIndependentFit = evaluateJob(realJob, profile, {
    'task:metric-anomaly': { level: 'independent', updatedAt: new Date().toISOString() },
  });
  const metricIndependentRow = metricIndependentFit.results.find(
    (result) => result.id === 'cap:task:metric-anomaly',
  );
  assert.equal(metricIndependentRow?.status, 'meet');
  assert.equal(metricIndependentRow?.verdict, '自评符合');
  assert.equal(metricIndependentRow?.profileValue, '能独立完成');
  assert.equal(
    metricIndependentRow?.exercise?.label,
    '场景题 · 支付转化率异常排查',
    '指标异常任务应关联开放场景题',
  );
  console.log('PASS: 真实京东 JD 的资格、任务、工具拆分和指标异常自评符合验收 A/B');

  const pythonCleanJob = makeJob('python-clean', '要求用 Python 清洗数据。');
  const pythonModelJob = makeJob('python-model', '要求用 Python 做统计建模。');
  const pythonCleanCap = evaluateJob(pythonCleanJob, profile).capabilities.find(
    (capability) => capability.key === 'tool:python:clean',
  );
  const pythonModelCap = evaluateJob(pythonModelJob, profile).capabilities.find(
    (capability) => capability.key === 'tool:python:modeling',
  );
  assert.equal(pythonCleanCap?.label, 'Python 数据清洗');
  assert.equal(pythonModelCap?.label, 'Python 统计建模');
  assert.notEqual(pythonCleanCap?.key, pythonModelCap?.key);
  const pythonAnswers = {
    'tool:python:clean': { level: 'none' as const, updatedAt: new Date().toISOString() },
    'tool:python:modeling': { level: 'independent' as const, updatedAt: new Date().toISOString() },
  };
  const cleanRow = evaluateJob(pythonCleanJob, profile, pythonAnswers).results.find(
    (result) => result.id === 'cap:tool:python:clean',
  );
  const modelRow = evaluateJob(pythonModelJob, profile, pythonAnswers).results.find(
    (result) => result.id === 'cap:tool:python:modeling',
  );
  assert.equal(cleanRow?.profileValue, '没做过');
  assert.equal(modelRow?.profileValue, '能独立完成');
  console.log('PASS: Python 数据清洗与统计建模使用独立答案验收 C');

  const retentionJob = makeJob('sql-retention', '要求使用 SQL 分析次日留存。');
  const retentionCapability = evaluateJob(retentionJob, profile).capabilities.find(
    (capability) => capability.key === 'sql:retention',
  );
  assert.equal(retentionCapability?.label, 'SQL 次日留存');
  const retentionRecommendation = recommendForJob(retentionJob, profile);
  assert.equal(retentionRecommendation.questionId, null);
  assert.equal(retentionRecommendation.label, '暂无对应练习');
  assert.equal(
    retentionRecommendation.basis?.requirement,
    undefined,
    '留存任务不能用去重题替代',
  );

  const multiSqlJob = makeJob('multi-sql', '要求使用 SQL 完成分组去重和多表连接。');
  const multiSqlCapabilities = evaluateJob(multiSqlJob, profile).capabilities.map(
    (capability) => capability.key,
  );
  assert.ok(multiSqlCapabilities.includes('sql:dedupe'));
  assert.ok(multiSqlCapabilities.includes('sql:join'));
  console.log('PASS: 次日留存不推荐去重题，同句分组去重与多表连接分别识别验收 D');

  console.log('\nALL TESTS PASSED');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
