import type { FitEvaluation, FitResult, Job } from '../../src/types';

export interface EvidenceAdvice {
  coreCount: number;
  gaps: FitResult[];
}

const MIN_GAPS = 2;
const MIN_GAP_PERCENT = 60;

export function getEvidenceAdvice(job: Job, evaluation: FitEvaluation): EvidenceAdvice | undefined {
  if (job.extraction !== 'ok') return;
  const items = new Map(job.items.map(item => [item.id, item]));
  const core = evaluation.results.filter(row => {
    const item = row.itemId ? items.get(row.itemId) : undefined;
    if (!item || item.uncertain || item.requirement === 'preferred' || row.group === 'bonus') return false;
    if (row.verdict === '待人工核对' || row.verdict === '无法确认') return false;
    return row.group === 'hard' || item.field === 'major' || item.field === 'task'
      || (item.field === 'skill' && item.requirement === 'required');
  });
  const gaps = core.filter(row => row.status === 'unknown' || row.status === 'info');
  if (gaps.length >= MIN_GAPS && gaps.length * 100 >= core.length * MIN_GAP_PERCENT) {
    return { coreCount: core.length, gaps };
  }
}
