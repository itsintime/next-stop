import type { ExtractedItem, Job, PracticeRecord, QuestionId } from './types';

let counter = 0;

export function uid(prefix = 'id'): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`;
}

export function locateQuote(rawText: string, quote: string): { start: number; end: number } | null {
  if (!quote.trim()) return null;
  const index = rawText.indexOf(quote);
  if (index < 0) return null;
  return { start: index, end: index + quote.length };
}

export function isQuoteVerified(rawText: string, item: ExtractedItem): boolean {
  return locateQuote(rawText, item.quote) !== null;
}

export function practiceKey(jobId: string, questionId: QuestionId): string {
  return `${jobId}:${questionId}`;
}

export function getPractice(
  practice: Record<string, PracticeRecord>,
  jobId: string,
  questionId: QuestionId,
): PracticeRecord | undefined {
  return practice[practiceKey(jobId, questionId)];
}

export function practiceLabel(record: PracticeRecord | undefined): '未练习' | '已尝试' | '已通过' {
  if (!record) return '未练习';
  return record.status === 'passed' ? '已通过' : '已尝试';
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日 ${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`;
}

export function jobInitial(name: string): string {
  return name.trim().slice(0, 1) || '岗';
}

export function sampleFirstLine(text: string): string {
  return text.trim().split(/\n/)[0]?.slice(0, 60) || '';
}

export function mergeManualItems(existing: ExtractedItem[], next: ExtractedItem[]): ExtractedItem[] {
  const manual = existing.filter((item) => item.manual);
  const manualKeys = new Set(manual.map((item) => `${item.field}:${item.requirement}:${item.value}`));
  return [...manual, ...next.filter((item) => !manualKeys.has(`${item.field}:${item.requirement}:${item.value}`))];
}

export function defaultJobName(index: number): string {
  return `岗位 ${index + 1}`;
}

export function normalizeName(name: string): string {
  return name.trim() || '未命名岗位';
}

export function isJobEmpty(job: Job): boolean {
  return !job.rawText.trim();
}
