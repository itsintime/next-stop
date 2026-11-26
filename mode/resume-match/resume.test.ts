import assert from 'node:assert/strict';
import { extractItems } from '../../src/extract/extract';
import { evaluateJob } from '../../src/fit';
import { recommendForJob } from '../../src/recommend';
import type { Job, Profile } from '../../src/types';
import { extractResumeFacts, matchResume } from './index';
import { normalizeResume } from '../resume-import';
import {
  formatSupplement,
  loadSupplements,
  saveSupplement,
  supplementKindFor,
} from '../resume-supplement';

const profile: Profile = { graduation: '', days: '', duration: '', sql: { basic: '', dedupe: '', join: '' } };
const rawText = '工作内容：构建指标体系，完成对业务关键指标的监控及异常波动等分析工作。要求使用 SQL 分组去重。任职资格：统招本科及以上学历在校生，27届优先。每周至少到岗 4 天。';
const job: Job = { id: 'test', name: '数据分析实习', rawText, items: extractItems(rawText), extraction: 'ok' };
const evaluate = (text: string) => matchResume(job, evaluateJob(job, profile), text);
const first = evaluate('教育经历\n统计学本科，预计 2027 年毕业\n技能\nSQL\n项目经历\n制作每周转化率报表，追踪各渠道表现');
assert.equal(first.results.find(r => r.label === '毕业届别')?.verdict, '符合优先条件');
assert.equal(first.results.find(r => r.label === '每周到岗')?.verdict, '简历未提及');
assert.equal(first.results.find(r => r.label === '指标监控')?.verdict, '有经历支持');
assert.equal(first.results.find(r => r.label === '排查指标异常')?.verdict, '证据待核对');
assert.equal(first.results.find(r => r.id === 'cap:sql:dedupe')?.verdict, '证据待核对');

const second = evaluate('项目经历\n发现转化率下降，并按渠道定位原因');
assert.equal(second.results.find(r => r.label === '排查指标异常')?.verdict, '有经历支持');
assert.match(second.results.find(r => r.label === '排查指标异常')?.profileValue ?? '', /按渠道定位原因/);
assert.equal(recommendForJob(job, profile, second).questionId, 2);
assert.equal(evaluate('项目经历\n没有做过指标异常排查').results.find(r => r.label === '排查指标异常')?.verdict, '简历未提及');
assert.ok(evaluate('').results.every(r => r.verdict === '尚未导入简历'));
assert.equal(
  normalizeResume('项⽬经历\n使⽤ SQL 统计报名⼈数'),
  '项目经历\n使用 SQL 统计报名人数',
  'PDF 提取出的兼容字符应归一化',
);

const result = (text: string, label: string) => evaluate(text).results.find(r => r.label === label);
assert.equal(result('项目经历\n预计2027年上线校园数据平台', '毕业届别')?.verdict, '简历未提及');
assert.equal(result('教育背景：本科在读，预计2027年6月毕业', '毕业届别')?.verdict, '符合优先条件');
assert.equal(result('制作转化率周报，但未排查原因', '排查指标异常')?.verdict, '证据待核对');
assert.equal(result('团队负责转化率异常排查，我负责整理会议纪要', '排查指标异常')?.verdict, '简历未提及');
assert.equal(result('用 SQL 按渠道做分组统计，未对报名数据去重', 'SQL 分组去重')?.verdict, '简历未提及');
assert.equal(result('技能：熟悉 SQL', 'SQL 分组去重')?.verdict, '证据待核对');
assert.equal(result('每周最多到岗3天', '每周到岗')?.verdict, '不满足');
assert.equal(result('每周可到岗四天', '每周到岗')?.verdict, '有资料支持');
assert.equal(result('每周可到岗3.5天', '每周到岗')?.verdict, '不满足');
assert.equal(result('每周至少可到岗3天', '每周到岗')?.verdict, '证据待核对');
assert.equal(result('先前实习每周到岗3天', '每周到岗')?.verdict, '简历未提及');

const sourceText = '教育背景：本科在读，预计2027年6月毕业。\n技能：Python、PowerBI\n项目经历：用 SQL 对报名数据去重；用 SQL 对报名数据去重';
const facts = extractResumeFacts(sourceText);
assert.deepEqual(facts.tools.map(t => t.name).sort(), ['Power BI', 'Python', 'SQL']);
assert.equal(facts.tasks.filter(t => t.key === 'sql:dedupe').length, 1);
for (const source of [...facts.tasks, ...facts.tools, ...facts.graduation].map(fact => fact.source)) {
  assert.equal(sourceText.slice(source.start, source.end), source.text);
}
const testLog = 'PASS: 简历事实、补充信息、作用域隔离、到岗冲突和证据缺口推荐';

const supplementJob: Job = {
  id: 'supplement-job',
  name: '补充测试岗位',
  rawText: '工作内容：使用 SQL 分组去重统计报名人数。任职资格：统招本科及以上学历在校生，27届优先。每周至少到岗 3 天，连续实习至少 3 个月。',
  items: extractItems('工作内容：使用 SQL 分组去重统计报名人数。任职资格：统招本科及以上学历在校生，27届优先。每周至少到岗 3 天，连续实习至少 3 个月。'),
  extraction: 'ok',
};
const supplementBase = evaluateJob(supplementJob, profile);
const supplementResume = '教育经历\n统计学本科，预计 2027 年毕业\n技能\nSQL';
const baseMatch = matchResume(supplementJob, supplementBase, supplementResume);
const daysRow = baseMatch.results.find((r) => r.label === '每周到岗');
const durationRow = baseMatch.results.find((r) => r.label === '连续实习');
const sqlRow = baseMatch.results.find((r) => r.id === 'cap:sql:dedupe');
assert.ok(daysRow && durationRow && sqlRow);
assert.equal(daysRow?.status, 'unknown');
assert.equal(daysRow?.verdict, '简历未提及');
assert.equal(durationRow?.verdict, '简历未提及');
assert.equal(sqlRow?.verdict, '证据待核对');
assert.equal(supplementKindFor(daysRow!, supplementJob.items.find((i) => i.id === daysRow?.itemId)), 'days');
assert.equal(supplementKindFor(durationRow!, supplementJob.items.find((i) => i.id === durationRow?.itemId)), 'duration');
assert.equal(supplementKindFor(sqlRow!, supplementJob.items.find((i) => i.id === sqlRow?.itemId)), 'text');

const supplements = {
  [daysRow!.id]: { kind: 'days' as const, value: '4', updatedAt: new Date().toISOString() },
  [durationRow!.id]: { kind: 'duration' as const, value: '2', updatedAt: new Date().toISOString() },
  [sqlRow!.id]: {
    kind: 'text' as const,
    value: '我用 SQL 对报名数据做分组去重，统计了每个活动的有效报名人数。',
    updatedAt: new Date().toISOString(),
  },
};
const supplemented = matchResume(supplementJob, supplementBase, supplementResume, supplements);
const daysSupplemented = supplemented.results.find((r) => r.id === daysRow?.id);
const durationSupplemented = supplemented.results.find((r) => r.id === durationRow?.id);
const sqlSupplemented = supplemented.results.find((r) => r.id === sqlRow?.id);
assert.equal(daysSupplemented?.status, 'meet');
assert.equal(daysSupplemented?.verdict, '满足');
assert.equal(daysSupplemented?.evidenceSource, 'user');
assert.equal(daysSupplemented?.supplement?.value, '4');
assert.equal(daysSupplemented?.profileValue, '暂无简历证据');
assert.equal(durationSupplemented?.status, 'unmet');
assert.equal(durationSupplemented?.verdict, '不满足');
assert.equal(durationSupplemented?.evidenceSource, 'user');
assert.equal(sqlSupplemented?.status, 'meet');
assert.equal(sqlSupplemented?.verdict, '有补充经历');
assert.equal(sqlSupplemented?.evidenceSource, 'user');
assert.ok(sqlSupplemented?.profileValue.includes('技能：SQL'), '原简历证据应保留');
assert.ok(supplemented.unknown.length < baseMatch.unknown.length);

const reverted = matchResume(supplementJob, supplementBase, supplementResume);
assert.equal(reverted.results.find((r) => r.id === daysRow?.id)?.verdict, '简历未提及');
assert.equal(reverted.results.find((r) => r.id === sqlRow?.id)?.verdict, '证据待核对');

const vague = matchResume(supplementJob, supplementBase, supplementResume, {
  [sqlRow!.id]: { kind: 'text', value: '熟悉 SQL', updatedAt: new Date().toISOString() },
});
assert.equal(vague.results.find((r) => r.id === sqlRow?.id)?.status, 'info');
assert.equal(vague.results.find((r) => r.id === sqlRow?.id)?.verdict, '证据待核对');

const memory = new Map<string, string>();
Object.defineProperty(globalThis, 'sessionStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, String(value)),
    removeItem: (key: string) => memory.delete(key),
  },
});
const stored = { kind: 'days' as const, value: '4', updatedAt: new Date().toISOString() };
assert.equal(saveSupplement('resume-a', 'job-a', 'result-x', stored), true);
assert.equal(loadSupplements('resume-a', 'job-a')['result-x']?.value, '4');
assert.deepEqual(loadSupplements('resume-b', 'job-a'), {});
assert.deepEqual(loadSupplements('resume-a', 'job-b'), {});
saveSupplement('resume-a', 'job-a', 'result-x', null);
assert.deepEqual(loadSupplements('resume-a', 'job-a'), {});
assert.equal(formatSupplement(stored), '4 天/周');
assert.equal(formatSupplement({ kind: 'duration', value: '2' }), '2 个月');

console.log(testLog);
