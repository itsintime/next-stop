import type { CapabilityRequirement, ExtractedItem, FitEvaluation, FitResult, Job } from '../../src/types';
import {
  formatSupplement,
  validateSupplement,
  type SupplementMap,
} from '../resume-supplement';

import { toolTaskEvidence, toolTaskFor } from './requirements';
import { action, extractResumeFacts, knownTask, positiveParts, SQL, usableMention, type ResumeFacts, type Source } from './facts';
export { extractResumeFacts, type ResumeFacts } from './facts';

type Evidence = { verdict: string; reason: string; line?: Source; status: FitResult['status'] };
const missing = (reason = '简历未体现这项要求，无法确认。'): Evidence => ({ verdict: '简历未提及', reason, status: 'unknown' });
const sourced = (line: Source, verdict: string, reason: string, status: FitResult['status'] = 'meet'): Evidence => ({ line, verdict, reason, status });
const monitoring = /监控|监测|追踪|跟踪|周报|日报|月报|看板/;

function usesTool(text: string, label: string): boolean {
  const tool = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(/^[a-z\d]/i.test(label) ? `(?<![a-z\\d])${tool}(?![a-z\\d])` : tool, 'i').test(text);
}

function taskEvidence(key: string, label: string, facts: ResumeFacts, item: ExtractedItem | undefined): Evidence {
  const usable = facts.sources.filter(usableMention);
  const direct = facts.tasks.find((fact) => fact.key === key)?.source;
  const claim = (line: Source) => sourced(line, '有经历支持', '简历原句中有与岗位任务对应的实际动作。');
  if (direct) return claim(direct);
  if (item?.field === 'skill' && item.uncertain && !item.alternatives?.length) {
    return { verdict: '待人工核对', reason: '暂不能可靠地比对这项要求，请查看岗位原文并核对实际经历。', status: 'unknown' };
  }
  const task = toolTaskFor(item?.quote ?? '');
  const alternatives = item?.alternatives ?? [];
  const toolMention = (text: string, tool: string) => tool === 'SQL' ? SQL.test(text) : usesTool(text, tool);
  if (alternatives.length || (task && item?.field === 'skill' && !knownTask(key) && key !== 'sql:advanced')) {
    const options = alternatives.length ? alternatives : [item!.value];
    const comparison = task ? toolTaskEvidence[task] : null;
    const actual = comparison && facts.sources.flatMap(positiveParts).find(({ text }) =>
      action.test(text) && comparison.test(text) && options.some(tool => toolMention(text, tool)));
    if (actual) return claim(actual);
    const mention = usable.find(({text}) => options.some(tool => toolMention(text, tool)));
    return mention ? sourced(mention, '仅提及', '简历提到了相关工具，但未体现这项要求对应的实际任务。', 'info') : missing();
  }
  if (key === 'task:metric-anomaly') {
    const nearby = facts.tasks.find((fact) => fact.key === 'task:metric-monitoring')?.source;
    return nearby ? sourced(nearby, '部分相关', '有指标监控的证据，简历未体现异常排查。', 'info') : missing('简历未体现指标异常排查。');
  }
  if (knownTask(key)) {
    const mention = key.startsWith('sql:') ? usable.find((line) => SQL.test(line.text)) : undefined;
    return mention ? sourced(mention, '仅提及', '简历提到 SQL，但没体现这项具体任务。', 'info') : missing();
  }
  if (key.startsWith('sql:')) {
    const line = usable.find((l) => SQL.test(l.text));
    return line ? sourced(line, '仅提及', '简历提到 SQL；岗位未明确具体任务，不能确认任务匹配。', 'info') : missing();
  }
  if (key.startsWith('excel:') || key.startsWith('tool:') || key.startsWith('skill:')) {
    const tool = key.startsWith('excel:') ? 'Excel' : item?.value ?? label;
    const task = key.split(':')[2];
    const terms = key === 'excel:pivot' ? /透视表/ : task === 'clean' ? /清洗/ :
      task === 'modeling' ? /建模|训练.{0,5}模型/ : task === 'visualization' ? /可视化|仪表盘|图表/ : null;
    const direct = terms && facts.sources.flatMap(positiveParts).find(({ text }) => usesTool(text, tool) && terms.test(text) && action.test(text));
    if (direct) return claim(direct);
    const line = facts.tools.find((fact) => fact.name.toLowerCase() === tool.toLowerCase())?.source ??
      usable.find((l) => tool !== 'R' && usesTool(l.text, tool));
    return line ? sourced(line, '仅提及', '简历提到了该工具或技能，未据此推断具体任务或熟练程度。', 'info') : missing();
  }
  return missing();
}

function qualification(item: ExtractedItem, facts: ResumeFacts): Evidence {
  const lines = facts.sources;
  if (item.field === 'graduation') {
    const accepted: string[] = item.value.match(/20\d{2}/g) ?? [];
    if (!accepted.length) return missing();
    const educationYears = facts.graduation.filter(({ source }) => source.section === '教育经历');
    const candidates = educationYears.length ? educationYears : facts.graduation;
    const distinctYears = new Set(candidates.map(({ year }) => year));
    if (distinctYears.size > 1) return missing('简历有多个毕业年份，请确认当前投递所对应的届别。');
    const candidate = candidates[0];
    if (!candidate) return missing('简历没有明确写出毕业届别或预计毕业年份。');
    const { year: actual, source: line } = candidate;
    if (!accepted.includes(actual)) return sourced(line, item.requirement === 'preferred' ? '未体现优先条件' : '届别需核对', `简历注明 ${actual} 年，请与岗位接受的届别对照。`, 'info');
    return sourced(line, item.requirement === 'preferred' ? '符合优先条件' : '有资料支持', '简历注明的毕业年份与岗位一致。', item.requirement === 'preferred' ? 'bonus' : 'meet');
  }
  if (item.field === 'education') {
    const degree = /博士|硕士|研究生|本科|专科|大专/;
    const line = facts.education.find(({text}) => degree.test(text));
    return line ? sourced(line, '有学历信息', /统招/.test(item.value) && !/统招/.test(line.text) ? '简历有学历信息，未明确写明统招，请核对。' : '简历有学历原文，请结合岗位要求核对。', 'info') : missing();
  }
  if (item.field === 'enrollment') {
    const line = lines.find(({text}) => /在校生|在读|当前在校/.test(text) && !/不在读|非在校/.test(text));
    return line ? sourced(line, '有资料支持', '简历明确写有在读或在校。') : missing('简历没有明确说明是否在校。');
  }
  if (item.field === 'major') {
    const majors = item.value.split(/[、，,\/]/).map((v) => v.replace(/等相关专业|相关专业|专业$/g, '').trim()).filter((v) => v.length >= 2);
    const line = lines.find(({text,section}) => (section === '教育经历' || /专业[：:]|本科|硕士/.test(text)) && majors.some((m) => text.includes(m)));
    if (line) return sourced(line, '有资料支持', '简历教育信息中出现岗位列举的专业。');
    const education = facts.education.find(({text}) => /专业[：:]|(?:本科|硕士|博士|专科)/.test(text));
    return education ? sourced(education, '专业待核对', '简历有教育信息，未找到岗位列举的专业，是否属于相关专业需核对。', 'info')
      : missing('无法确认专业是否属于岗位所说的相关专业。');
  }
  if (item.field === 'days' || item.field === 'duration') {
    const day = item.field === 'days';
    const value = item.value.normalize('NFKC');
    const minWords = /至少|最少|不少于|不低于/;
    const wantsMin = minWords.test(item.qualifier ?? value) || minWords.test(value);
    const num = (v: string) => /^[0-9]+(?:[.][0-9]+)?$/.test(v) ? Number(v) : ({ 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 } as Record<string, number>)[v];
    const n = '(?:[0-9]+(?:[.][0-9]+)?|[一二两三四五六七八九十]+)';
    const unit = day ? '天|日' : '个?月';
    const count = new RegExp(`(${n})\\s*(?:${unit})`);
    const requested = value.match(count);
    const eligible = day ? /每周.{0,10}(?:可|能|最多|仅).{0,10}(?:到岗|到班|出勤)|(?:可|能|到岗时间).{0,8}每周/
      : /(?:可|能|最多).{0,8}(?:连续)?实习|(?:可|能).{0,10}(?:个?月).{0,5}实习/;
    const sources = lines.filter(({ text }) => eligible.test(text) && count.test(text));
    if (!sources.length) return missing('简历未明确该岗位所需的可用时间。');
    if (sources.length > 1 && new Set(sources.map(({ text }) => text.match(count)?.[1])).size > 1) {
      return missing('简历写了不同的可用时间，请先核对。');
    }
    const line = sources[0];
    const supplied = line.text.match(count);
    const hasRange = /[\d一二两三四五六七八九十]\s*[~～–—至到-]\s*[\d一二两三四五六七八九十]/.test(line.text + ' ' + value);
    if (!item.uncertain && item.requirement !== 'preferred' && !/优先|加分|或/.test(item.quote) && wantsMin && !hasRange && requested && supplied && !/视情况|待定|大约|左右|可能/.test(line.text)) {
      const required = num(requested[1]), available = num(supplied[1]);
      if (Number.isFinite(required) && Number.isFinite(available)) {
        if (available < required && !minWords.test(line.text) && !/不低于|超过|多于|至少/.test(line.text)) return sourced(line, '不满足', '简历明确写出的可用时间低于岗位最低要求。', 'unmet');
        if (available >= required && !/最多|不超过|至多/.test(line.text)) return sourced(line, '有资料支持', '简历明确写出的可用时间达到岗位最低要求。');
      }
    }
    return sourced(line, '有可用时间信息', '简历给出了时间信息，仍需与岗位原文核对。', 'info');
  }
  return missing();
}

function applySupplement(
  row: FitResult,
  item: ExtractedItem,
  capKey: string | undefined,
  capLabel: string | undefined,
  base: Evidence,
  supplements: SupplementMap,
): Evidence & { source: 'resume' | 'user' | 'none'; supplement?: FitResult['supplement'] } {
  const supplement = supplements[row.id];
  if (supplement && !validateSupplement(supplement.kind, supplement.value)) {
    if (supplement.kind === 'days' || supplement.kind === 'duration') {
      const synthetic =
        supplement.kind === 'days'
          ? `每周可到岗 ${supplement.value} 天`
          : `可连续实习 ${supplement.value} 个月`;
      const evidence = qualification(item, extractResumeFacts(synthetic));
      const status = evidence.status === 'unknown' ? 'info' : evidence.status;
      const verdict =
        status === 'meet' ? '满足' : status === 'unmet' ? '不满足' : '证据待核对';
      return {
        ...evidence,
        status,
        verdict,
        reason: `根据用户补充（${formatSupplement(supplement)}）：${evidence.reason}`,
        source: 'user',
        supplement: { kind: supplement.kind, value: supplement.value },
      };
    }

    const evidence = capKey
      ? taskEvidence(capKey, capLabel ?? row.label, extractResumeFacts(supplement.value), item)
      : item.field === 'duty'
        ? missing('这条职责暂无可靠的自动匹配规则。')
        : qualification(item, extractResumeFacts(supplement.value));
    const vague = evidence.status === 'unknown';
    const status: FitResult['status'] = vague ? 'info' : evidence.status;
    const verdict =
      status === 'meet'
        ? capKey
          ? '有补充经历'
          : '有补充证据'
        : status === 'unmet'
          ? '不满足'
          : status === 'bonus'
            ? '符合优先条件'
            : '证据待核对';
    return {
      ...evidence,
      status,
      verdict,
      reason: `根据用户补充（${supplement.value}）：${
        vague ? '还没有形成可核对的具体经历。' : evidence.reason
      }`,
      source: 'user',
      supplement: { kind: 'text', value: supplement.value },
    };
  }

  if (base.status === 'info') {
    return { ...base, verdict: base.verdict === '专业待核对' ? base.verdict : '证据待核对', source: base.line ? 'resume' : 'none' };
  }
  return { ...base, source: base.line ? 'resume' : 'none' };
}

export function matchResume(
  job: Job,
  base: FitEvaluation,
  confirmedText: string,
  supplements: SupplementMap = {},
): FitEvaluation {
  const facts = extractResumeFacts(confirmedText);
  const hasInput = Boolean(confirmedText.trim()) || Object.keys(supplements).length > 0;
  const caps = new Map(base.capabilities.map((c: CapabilityRequirement) => [`cap:${c.key}`, c]));
  const items = new Map(job.items.map((item) => [item.id, item]));
  const results: FitResult[] = [];
  for (const row of base.results) {
    const item = row.itemId ? items.get(row.itemId) : undefined;
    if (!item) continue;
    const cap = caps.get(row.id);
    const baseEvidence = !confirmedText ? { verdict: '尚未导入简历', reason: '导入并确认简历后，才会查找证据。', status: 'unknown' as const } :
      cap ? taskEvidence(cap.key, cap.label, facts, item) : item.field === 'duty' ? missing('这条职责暂无可靠的自动匹配规则。') : qualification(item, facts);
    const evidence = applySupplement(row, item, cap?.key, cap?.label, baseEvidence, supplements);
    results.push({
      ...row,
      profileValue: baseEvidence.line ? `${baseEvidence.line.section}：${baseEvidence.line.text}` : '暂无简历证据',
      status: item.requirement === 'preferred' && evidence.status === 'meet' ? 'bonus' : evidence.status,
      verdict: evidence.verdict,
      reason: evidence.reason,
      evidenceSource: evidence.source,
      supplement: evidence.supplement,
    });
    if (cap?.key === 'task:metric-anomaly' && monitoring.test(item.quote)) {
      const relatedBase = confirmedText
        ? taskEvidence('task:metric-monitoring', '指标监控', facts, item)
        : { verdict: '尚未导入简历', reason: '导入并确认简历后，才会查找证据。', status: 'unknown' as const };
      const relatedRow = { ...row, id: 'resume:metric-monitoring', label: '指标监控', requirement: '岗位任务 · 指标监控', exercise: undefined };
      const related = applySupplement(relatedRow, item, 'task:metric-monitoring', '指标监控', relatedBase, supplements);
      results.push({
        ...relatedRow,
        profileValue: relatedBase.line ? `${relatedBase.line.section}：${relatedBase.line.text}` : '暂无简历证据',
        status: related.status,
        verdict: related.verdict,
        reason: related.reason,
        evidenceSource: related.source,
        supplement: related.supplement,
      });
    }
  }
  const unmet = results.filter((r) => r.status === 'unmet');
  const unknown = results.filter((r) => r.status === 'unknown');
  const supported = results.filter((r) => r.status === 'meet' || r.status === 'bonus');
  return { ...base, resumeBased: true, results, unmet, unknown,
    weakSkills: results.filter((r) => r.group === 'skill' && r.status !== 'meet'),
    bonus: results.filter((r) => r.group === 'bonus'),
    profileFilled: hasInput,
    headline: hasInput
      ? `${supported.length} 项有证据支持，${unknown.length} 项信息不足${unmet.length ? `，${unmet.length} 项明确不满足` : ''}`
      : '导入简历后查看逐项证据',
  };
}

// A specific task with weak evidence comes before one already supported by the resume.
export function rankResumePractice(result: FitResult, broad: boolean): number {
  const evidenceGap = result.status === 'unknown' ? 3 : result.status === 'info' ? 2 : 0;
  return broad ? 1 : 10 + evidenceGap;
}
