import type { FitEvaluation, FitResult, Job, Profile } from '../../src/types';
import { evaluateJob } from '../../src/fit';
import { matchResume } from '../resume-match';
import { getEvidenceAdvice } from './evidence-advice';
export type { EvidenceAdvice } from './evidence-advice';
import { loadSupplements, resumeFingerprint, saveSupplement, validateSupplement, type ResumeSupplement } from '../resume-supplement';

const emptyProfile: Profile = {
  graduation: '', days: '', duration: '', sql: { basic: '', dedupe: '', join: '' },
};

function jobVersion(job: Job): string {
  return JSON.stringify([job.id, resumeFingerprint(JSON.stringify([job.rawText, job.items]))]);
}

export function matchInputKey(job: Job, resumeText: string): string {
  return JSON.stringify([jobVersion(job), resumeFingerprint(resumeText)]);
}

export function findMatchResultForItem(
  evaluation: FitEvaluation,
  itemId: string,
): FitResult | null {
  return (
    evaluation.results.find(
      (result) => result.itemId === itemId && result.id.startsWith('cap:'),
    ) ?? null
  );
}

// Matching runs synchronously from the current inputs; there is no older background
// result that can complete after a switch and replace the current evaluation.
export function evaluateMatchSession(job: Job, resumeText: string) {
  const evaluation = matchResume(job, evaluateJob(job, emptyProfile), resumeText, loadSupplements(resumeText, jobVersion(job)));
  return { ...evaluation, evidenceAdvice: resumeText.trim() ? getEvidenceAdvice(job, evaluation) : undefined };
}

export function saveSessionSupplement(job: Job, resumeText: string, resultId: string, supplement: ResumeSupplement | null) {
  if (supplement && validateSupplement(supplement.kind, supplement.value)) return false;
  return saveSupplement(resumeText, jobVersion(job), resultId, supplement);
}
