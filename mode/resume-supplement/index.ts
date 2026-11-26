import type { ExtractedItem, FitResult } from '../../src/types';

export type SupplementKind = 'days' | 'duration' | 'text';

export interface ResumeSupplement {
  kind: SupplementKind;
  value: string;
  updatedAt: string;
}

export type SupplementMap = Record<string, ResumeSupplement>;

const STORE_KEY = 'jd-assistant:resume-supplements:v1';

export function resumeFingerprint(text: string): string {
  let hash = 2166136261;
  for (const char of text.normalize('NFKC')) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function storage(): Storage | undefined {
  try {
    return globalThis.sessionStorage;
  } catch {
    return undefined;
  }
}

function readStore(): Record<string, ResumeSupplement> {
  try {
    const raw = storage()?.getItem(STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const result: Record<string, ResumeSupplement> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!value || typeof value !== 'object') continue;
      const item = value as Partial<ResumeSupplement>;
      if ((item.kind !== 'days' && item.kind !== 'duration' && item.kind !== 'text') || typeof item.value !== 'string') continue;
      result[key] = {
        kind: item.kind,
        value: item.value,
        updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : new Date().toISOString(),
      };
    }
    return result;
  } catch {
    return {};
  }
}

function scopePrefix(resumeText: string, jobId: string): string {
  return `${resumeFingerprint(resumeText)}|${jobId}|`;
}

export function loadSupplements(resumeText: string, jobId: string): SupplementMap {
  const prefix = scopePrefix(resumeText, jobId);
  return Object.fromEntries(
    Object.entries(readStore())
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => [key.slice(prefix.length), value]),
  );
}

export function saveSupplement(
  resumeText: string,
  jobId: string,
  resultId: string,
  supplement: ResumeSupplement | null,
): boolean {
  try {
    const store = readStore();
    const key = `${scopePrefix(resumeText, jobId)}${resultId}`;
    if (supplement) store[key] = supplement;
    else delete store[key];
    storage()?.setItem(STORE_KEY, JSON.stringify(store));
    return Boolean(storage());
  } catch {
    return false;
  }
}

export function supplementKindFor(result: FitResult, item: ExtractedItem | undefined): SupplementKind {
  if (item?.field === 'days' || result.label === '每周到岗') return 'days';
  if (item?.field === 'duration' || result.label === '连续实习') return 'duration';
  return 'text';
}

export function supplementPrompt(result: FitResult, item: ExtractedItem | undefined): string {
  const tool = item?.value ?? result.label;
  if (/sql/i.test(tool) || /sql/i.test(result.label)) {
    return '例如：你用 SQL 处理过什么数据？完成了什么分析或统计？';
  }
  return `说明你在${tool}上做了什么、用到什么工具、解决了什么问题。`;
}

export function validateSupplement(kind: SupplementKind, value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return '请填写补充信息。';
  if (kind === 'days' || kind === 'duration') {
    if (!/^\d+(?:\.\d+)?$/.test(trimmed) || Number(trimmed) <= 0) {
      return kind === 'days' ? '请填写大于 0 的每周到岗天数。' : '请填写大于 0 的连续实习月数。';
    }
  }
  return null;
}

export function formatSupplement(supplement: {
  kind: SupplementKind;
  value: string;
}): string {
  if (supplement.kind === 'days') return `${supplement.value} 天/周`;
  if (supplement.kind === 'duration') return `${supplement.value} 个月`;
  return supplement.value;
}