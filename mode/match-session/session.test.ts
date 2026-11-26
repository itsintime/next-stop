import assert from 'node:assert/strict';
import type { Job } from '../../src/types';
import { extractItems } from '../../src/extract/extract';
import { evaluateMatchSession, matchInputKey, saveSessionSupplement } from './index';
import { analystJD, designJD, analystResume, designResume } from './fixtures';

const store = new Map<string, string>();
Object.defineProperty(globalThis, 'sessionStorage', {
  value: { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value) },
});

const job = (id: string, rawText: string): Job => ({ id, name: id, rawText, items: extractItems(rawText), extraction: 'ok' });
const analyst = job('岗位 A', analystJD), designer = job('岗位 B', designJD);
const row = (selectedJob: Job, resume: string, label: string) => {
  const result = evaluateMatchSession(selectedJob, resume).results.find(r => r.label === label);
  assert.ok(result, '结果应包含 ' + label);
  return result;
};
assert.equal(row(analyst, analystResume, 'SQL 或 Python').status, 'meet');
assert.equal(row(analyst, analystResume, '毕业届别').status, 'bonus');
assert.equal(evaluateMatchSession(analyst, analystResume).results.filter(r => /SQL|Python/.test(r.label)).length, 1);
assert.equal(row(analyst, analystResume.replace('SQL', 'Python'), 'SQL 或 Python').status, 'meet');
assert.equal(row(analyst, '项目经历\n未使用 SQL 处理业务数据', 'SQL 或 Python').status, 'unknown');
assert.equal(row(designer, analystResume, 'Figma').status, 'unknown');
assert.ok(evaluateMatchSession(designer, analystResume).results.every(r => !/SQL/.test(r.label)));
assert.match(row(designer, analystResume, '每周到岗').requirement, /2/);
assert.equal(row(designer, designResume, 'Figma').status, 'meet');
assert.equal(row(designer, '技能\n熟悉 Figma', 'Figma').status, 'info');
assert.equal(row(designer, designResume, '会动效设计优先').group, 'bonus');
assert.equal(row(analyst, designResume, 'SQL 或 Python').status, 'unknown');
assert.notEqual(row(analyst, designResume, '毕业届别').status, 'unmet');
assert.equal(evaluateMatchSession(job('新类型', '必须具备声学仿真经验。'), designResume).results[0]?.verdict, '待人工核对');
assert.equal(evaluateMatchSession(job('并列条件', '必须掌握 SQL 和 Python。'), analystResume).results.filter(r => /SQL|Python/.test(r.label)).length, 2);

const availability = row(analyst, analystResume, '每周到岗');
assert.equal(availability.status, 'unknown');
assert.ok(saveSessionSupplement(analyst, analystResume, availability.id, { kind: 'days', value: '2', updatedAt: '2026-11-22T00:00:00Z' }));
assert.equal(row(analyst, analystResume, '每周到岗').status, 'unmet');
assert.equal(row(designer, analystResume, '每周到岗').status, 'unknown');
assert.equal(row(analyst, designResume, '每周到岗').status, 'unknown');
assert.notEqual(matchInputKey(analyst, designResume), matchInputKey(analyst, analystResume));
const updated = { ...analyst, rawText: analyst.rawText.replace('3 天', '4 天'),
  items: analyst.items.map(item => item.field === 'days' ? { ...item, value: '每周至少到岗 4 天', quote: '每周至少到岗 4 天' } : item) };
const corrected = { ...updated, rawText: analyst.rawText };
assert.notEqual(matchInputKey(updated, analystResume), matchInputKey(analyst, analystResume));
assert.equal(row(updated, analystResume, '每周到岗').status, 'unknown');
assert.equal(row(corrected, analystResume, '每周到岗').status, 'unknown');
assert.equal(row(analyst, analystResume, '每周到岗').evidenceSource, 'user');
assert.ok(saveSessionSupplement(analyst, analystResume, availability.id, null));
assert.equal(row(analyst, analystResume, '每周到岗').status, 'unknown');
console.log('PASS: 跨岗位与简历匹配、任一工具、人工核对、输入版本及补充隔离');

assert.equal(evaluateMatchSession(designer, '').evidenceAdvice, undefined, '未导入简历不建议放弃');
assert.equal(evaluateMatchSession(designer, designResume).evidenceAdvice, undefined, '只有到岗时间未知不提示，动效优先项不计入');
const designGap = evaluateMatchSession(designer, analystResume).evidenceAdvice;
assert.equal(designGap?.coreCount, 2);
assert.deepEqual(designGap?.gaps.map(r => r.label).sort(), ['Figma', '每周到岗']);
const designAvailability = row(designer, analystResume, '每周到岗');
assert.ok(saveSessionSupplement(designer, analystResume, designAvailability.id, { kind: 'days', value: '3', updatedAt: '2026-11-22T00:00:00Z' }));
assert.equal(evaluateMatchSession(designer, analystResume).evidenceAdvice, undefined, '补充后低于门槛即撤销');
assert.ok(saveSessionSupplement(designer, analystResume, designAvailability.id, null));
assert.equal(evaluateMatchSession(designer, analystResume).evidenceAdvice?.gaps.length, 2);
const threeCore = job('三个条件', designer.rawText + '可连续实习至少 3 个月。');
assert.equal(evaluateMatchSession(threeCore, designResume).evidenceAdvice?.gaps.length, 2);
const fourCore = job('四个条件', threeCore.rawText + '必须使用 SQL 或 Python 处理业务数据。');
assert.equal(evaluateMatchSession(fourCore, designResume + '\n每周可到岗 3 天').evidenceAdvice, undefined, '2/4 未到 60%');
assert.equal(
  evaluateMatchSession(job('新类型', '必须具备声学仿真经验。'), designResume).evidenceAdvice,
  undefined,
  '系统无法可靠核对的条目不计入核心要求',
);
const fiveCore = job('五个条件', fourCore.rawText + '必须掌握 Tableau 可视化。');
const fiveCoreEvaluation = evaluateMatchSession(fiveCore, designResume + '\n每周可到岗 3 天');
assert.equal(fiveCoreEvaluation.evidenceAdvice?.coreCount, 5);
assert.equal(fiveCoreEvaluation.evidenceAdvice?.gaps.length, 3, '3/5 应触发提示');
assert.ok(evaluateMatchSession(designer, analystResume).evidenceAdvice, '视觉岗位应提示缺项');
assert.equal(evaluateMatchSession(analyst, analystResume).evidenceAdvice, undefined, '切换岗位后按当前岗位重算');
console.log('PASS: 低证据建议门槛、不计加分项、补充后自动更新');
